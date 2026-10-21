const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { pool } = require("../config/db");

const router = express.Router();

const OLLAMA_URL = "http://localhost:11434";
const EMBED_MODEL = "nomic-embed-text";

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 120;
const EMBED_BATCH_SIZE = 24;

const uploadDir = path.join(__dirname, "..", "uploads");
fs.mkdirSync(uploadDir, { recursive: true });

const allowedExtensions = new Set([
  ".pdf", ".docx", ".txt", ".md",
  ".html", ".htm", ".csv", ".json"
]);

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDir);
  },

  filename: (req, file, callback) => {
    const safeName = path
      .basename(file.originalname)
      .replace(/[^a-zA-Z0-9._-]/g, "_");

    callback(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 10
  },

  fileFilter: (req, file, callback) => {
    const ext = path.extname(file.originalname).toLowerCase();

    if (!allowedExtensions.has(ext)) {
      return callback(
        new Error(`Unsupported file type: ${ext}`)
      );
    }

    callback(null, true);
  }
});

// Extract text from supported file formats
async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".pdf") {
    const buffer = fs.readFileSync(filePath);
    const result = await pdfParse(buffer);
    return result.text || "";
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({
      path: filePath
    });

    return result.value || "";
  }

  if (ext === ".html" || ext === ".htm") {
    const html = fs.readFileSync(filePath, "utf8");

    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/\s+/g, " ")
      .trim();
  }

  return fs.readFileSync(filePath, "utf8");
}

// Split document text into overlapping chunks
function splitIntoChunks(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();

  if (!cleaned) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + CHUNK_SIZE, cleaned.length);

    // Prefer ending near a sentence or word boundary
    if (end < cleaned.length) {
      const minimumEnd = start + Math.floor(CHUNK_SIZE * 0.65);
      const boundary = cleaned.lastIndexOf(" ", end);

      if (boundary >= minimumEnd) {
        end = boundary;
      }
    }

    const chunk = cleaned.slice(start, end).trim();

    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= cleaned.length) {
      break;
    }

    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

// Generate embeddings using local Ollama
async function createEmbeddings(texts) {
  const response = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: texts,
      truncate: true
    }),
    signal: AbortSignal.timeout(120000)
  });

  if (!response.ok) {
    const errorText = await response.text();

    throw new Error(
      `Ollama embedding error (${response.status}): ${errorText}`
    );
  }

  const result = await response.json();
  const embeddings = result.embeddings;

  if (!Array.isArray(embeddings) ||
      embeddings.length !== texts.length) {
    throw new Error("Ollama returned an unexpected embedding response.");
  }

  for (const embedding of embeddings) {
    if (!Array.isArray(embedding) || embedding.length !== 768) {
      throw new Error(
        `Expected 768 embedding values; received ${
          embedding?.length ?? 0
        }.`
      );
    }
  }

  return embeddings;
}

// Save document chunks and their vectors to PostgreSQL
async function indexDocument(filename, filePath, fileSize, text) {
  const chunks = splitIntoChunks(text);

  if (chunks.length === 0) {
    throw new Error(
      "No readable text found. A scanned PDF may require OCR."
    );
  }

  const documentResult = await pool.query(
    `INSERT INTO public.documents
      (filename, file_path, file_size, total_chunks)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [filename, filePath, fileSize, chunks.length]
  );

  const documentId = documentResult.rows[0].id;
  let savedChunks = 0;

  try {
    for (
      let batchStart = 0;
      batchStart < chunks.length;
      batchStart += EMBED_BATCH_SIZE
    ) {
      const batch = chunks.slice(
        batchStart,
        batchStart + EMBED_BATCH_SIZE
      );

      const embeddings = await createEmbeddings(batch);

      for (let i = 0; i < batch.length; i++) {
        const chunkIndex = batchStart + i;

        await pool.query(
          `INSERT INTO public.document_chunks
            (document_id, chunk_index, content, embedding)
           VALUES ($1, $2, $3, $4::public.vector)`,
          [
            documentId,
            chunkIndex,
            batch[i],
            JSON.stringify(embeddings[i])
          ]
        );

        savedChunks++;
      }
    }

    return {
      documentId,
      totalChunks: savedChunks
    };
  } catch (error) {
    // Remove incomplete database records if indexing fails
    await pool.query(
      "DELETE FROM public.documents WHERE id = $1",
      [documentId]
    );

    throw error;
  }
}

// Upload and index documents
router.post("/upload", (req, res) => {
  upload.array("files", 10)(req, res, async (uploadError) => {
    if (uploadError) {
      return res.status(400).json({
        success: false,
        message: uploadError.message
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Please select at least one file."
      });
    }

    const results = [];

    try {
      for (const file of req.files) {
        try {
          const text = await extractText(
            file.path,
            file.originalname
          );

          if (!text.trim()) {
            results.push({
              filename: file.originalname,
              success: false,
              message:
                "No readable text found. Scanned PDFs may require OCR."
            });
            continue;
          }

          const indexed = await indexDocument(
            file.originalname,
            file.path,
            file.size,
            text
          );

          results.push({
            filename: file.originalname,
            success: true,
            documentId: indexed.documentId,
            characters: text.length,
            totalChunks: indexed.totalChunks,
            status: "indexed"
          });
        } catch (error) {
          console.error(
            `Indexing failed for ${file.originalname}:`,
            error.message
          );

          results.push({
            filename: file.originalname,
            success: false,
            message: error.message
          });
        }
      }

      const successful = results.filter(
        (item) => item.success
      ).length;

      return res.status(
        successful === results.length ? 200 : 207
      ).json({
        success: successful > 0,
        message:
          `${successful} of ${results.length} file(s) indexed successfully.`,
        documents: results
      });
    } catch (error) {
      console.error("Upload processing failed:", error.message);

      return res.status(500).json({
        success: false,
        message: "Document processing failed."
      });
    }
  });
});

module.exports = router;