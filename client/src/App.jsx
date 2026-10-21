
import { useRef, useState } from "react";
import "./App.css";
import ChatPanel from "./ChatPanel";
import HtmlGenerator from "./HtmlGenerator";
import AdminDashboard from "./AdminDashboard";
import AuthPage from "./AuthPage";

const API_URL = "http://localhost:5000/api";

const ACCEPTED_FILES = ".pdf,.docx,.txt,.md,.html,.htm,.csv,.json";

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".docx",
  ".txt",
  ".md",
  ".html",
  ".htm",
  ".csv",
  ".json",
]);

function MainPortal() {
  const fileInputRef = useRef(null);

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);

    const valid = incoming.filter((file) => {
      const extension = "." + file.name.split(".").pop().toLowerCase();
      return ALLOWED_EXTENSIONS.has(extension);
    });

    setMessage(
      valid.length !== incoming.length
        ? "Some files were skipped because their type is unsupported."
        : ""
    );

    setSelectedFiles((previous) => {
      const combined = [...previous, ...valid];
      const unique = new Map(
        combined.map((file) => [
          `${file.name}-${file.size}-${file.lastModified}`,
          file,
        ])
      );

      return Array.from(unique.values()).slice(0, 10);
    });
  }

  function removeSelected(index) {
    setSelectedFiles((previous) =>
      previous.filter((_, i) => i !== index)
    );
  }

  async function uploadDocuments() {
    if (!selectedFiles.length) {
      setMessage("Please select files before uploading.");
      return;
    }

    if (selectedFiles.some((file) => file.size > 20 * 1024 * 1024)) {
      setMessage("Each file must be 20 MB or smaller.");
      return;
    }

    const formData = new FormData();
    selectedFiles.forEach((file) => formData.append("files", file));

    setUploading(true);
    setMessage("Uploading files, extracting text and indexing...");

    try {
      const token = localStorage.getItem("authToken");

      const response = await fetch(`${API_URL}/documents/upload`, {
        method: "POST",
        headers: token
          ? { Authorization: `Bearer ${token}` }
          : {},
        body: formData,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok && response.status !== 207) {
        throw new Error(
          result.message || `Upload failed (${response.status}).`
        );
      }

      const uploaded = (result.documents || []).map((doc) => ({
        ...doc,
        uploadedAt: new Date().toLocaleString(),
      }));

      setDocuments((previous) => [...uploaded, ...previous]);
      setSelectedFiles([]);

      const successful = uploaded.filter((doc) => doc.success === true);
      const failed = uploaded.length - successful.length;

      setMessage(
        successful.length === 0
          ? result.message ||
              "No files were indexed successfully. Check the errors."
          : failed > 0
            ? `${successful.length} file(s) indexed successfully; ${failed} failed.`
            : result.message || "All documents indexed successfully."
      );
    } catch (error) {
      setMessage(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  function getDocumentStatus(doc) {
    if (doc.success === false) {
      return { label: "Failed", className: "warning" };
    }

    if (doc.status === "indexed" && doc.totalChunks > 0) {
      return {
        label: `Indexed · ${doc.totalChunks} chunks`,
        className: "success",
      };
    }

    if (doc.status === "text_extracted") {
      return { label: "Text extracted", className: "warning" };
    }

    return { label: "Uploaded", className: "warning" };
  }

  return (
    <div className="portal">
      <header className="topbar">
        <div>
          <h1>Chatbot AI Portal</h1>
          <p>Upload documents and ask questions with AI</p>
        </div>

        <span className="connection">Backend: localhost:5000</span>

        <a href="/admin" className="secondary-button">
          Admin Dashboard
        </a>
      </header>

      <main className="content">
        <section className="welcome">
          <h2>Your Document AI Assistant</h2>
          <p>
            Upload documents and ask questions in Hindi, Hinglish or English.
          </p>
        </section>

        <section className="panel">
          <h2>Upload documents</h2>
          <p className="muted">
            Up to 10 files per upload; maximum 20 MB per file.
            Supported formats: PDF, DOCX, TXT, MD, HTML, CSV and JSON.
          </p>

          <div
            className={`dropzone ${dragging ? "dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
          >
            <div className="upload-icon">↑</div>
            <h3>Drag and drop files here</h3>
            <p>or choose files from your computer</p>

            <button
              type="button"
              className="secondary-button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              Browse files
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_FILES}
              multiple
              hidden
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {selectedFiles.length > 0 && (
            <div className="file-section">
              <h3>Selected files ({selectedFiles.length})</h3>

              {selectedFiles.map((file, index) => (
                <div
                  className="file-row"
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                >
                  <div className="file-info">
                    <span className="file-icon">▤</span>
                    <div>
                      <strong>{file.name}</strong>
                      <p>{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="remove-button"
                    onClick={() => removeSelected(index)}
                    disabled={uploading}
                  >
                    Remove
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="primary-button"
                onClick={uploadDocuments}
                disabled={uploading}
              >
                {uploading
                  ? "Processing and indexing..."
                  : "Upload and index documents"}
              </button>
            </div>
          )}

          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <h2>Uploaded documents</h2>
              <p className="muted">
                Files processed during this browser session
              </p>
            </div>
            <span className="count">{documents.length}</span>
          </div>

          {documents.length === 0 ? (
            <div className="empty-state">
              <h3>No documents uploaded in this session</h3>
              <p>
                Previously indexed database documents may still be searchable.
              </p>
            </div>
          ) : (
            <div className="document-list">
              {documents.map((doc, index) => {
                const status = getDocumentStatus(doc);

                return (
                  <div
                    className="file-row"
                    key={`${doc.documentId || doc.id || doc.filename}-${index}`}
                  >
                    <div className="file-info">
                      <span className="file-icon">▤</span>
                      <div>
                        <strong>{doc.filename || "Unnamed document"}</strong>
                        <p>
                          {doc.fileSize
                            ? `${(doc.fileSize / 1024).toFixed(1)} KB`
                            : "File size unavailable"}
                          {" · "}
                          {Number(doc.characters || 0).toLocaleString()} characters
                        </p>
                        {doc.message && (
                          <p className="muted">{doc.message}</p>
                        )}
                      </div>
                    </div>

                    <span className={`status ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <ChatPanel />
        </section>

        <section className="panel">
          <HtmlGenerator />
        </section>

        <section className="info-panel">
          <strong>How the RAG assistant works</strong>
          <p>
            Documents are converted into text chunks and embeddings.
            The backend searches relevant chunks and uses the AI model
            to generate document-based answers.
          </p>
        </section>
      </main>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState(() => {
    const token = localStorage.getItem("authToken");
    const userText = localStorage.getItem("authUser");

    if (!token || !userText) {
      return null;
    }

    try {
      return {
        token,
        user: JSON.parse(userText),
      };
    } catch {
      localStorage.removeItem("authToken");
      localStorage.removeItem("authUser");
      return null;
    }
  });

  const [path, setPath] = useState(window.location.pathname);

  function handleLogin(newSession) {
    if (!newSession?.token || !newSession?.user) {
      console.error("Invalid login session received:", newSession);
      return;
    }

    localStorage.setItem("authToken", newSession.token);
    localStorage.setItem("authUser", JSON.stringify(newSession.user));

    window.history.replaceState({}, "", "/");
    setPath("/");
    setSession(newSession);
  }

  function logout() {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");

    window.history.replaceState({}, "", "/login");
    setPath("/login");
    setSession(null);
  }

  if (!session) {
    return <AuthPage onLogin={handleLogin} />;
  }

  if (path === "/admin" && session.user?.role !== "admin") {
    return (
      <main style={{ padding: 32 }}>
        <h2>Admin access required</h2>
        <p>Your account does not have administrator permission.</p>
        <button onClick={logout}>Log out</button>
      </main>
    );
  }

  if (path === "/admin") {
    return <AdminDashboard />;
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 12,
          padding: "10px 24px",
          flexWrap: "wrap",
        }}
      >
        <span>
          Logged in as {session.user?.name || "User"}
          {session.user?.email ? ` (${session.user.email})` : ""}
        </span>

        <button type="button" onClick={logout}>
          Log out
        </button>
      </div>

      <MainPortal />
    </>
  );
}
