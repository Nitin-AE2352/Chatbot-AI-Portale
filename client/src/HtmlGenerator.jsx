import { useState } from "react";
import "./HtmlGenerator.css";

const API_URL = "http://localhost:5000/api";

export default function HtmlGenerator() {
  const [topic, setTopic] = useState("");
  const [html, setHtml] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generatePage(event) {
    event.preventDefault();

    if (!topic.trim() || loading) return;

    setLoading(true);
    setError("");
    setHtml("");
    setSources([]);

    try {
      const response = await fetch(`${API_URL}/html/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ topic: topic.trim() })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "HTML generation failed.");
      }

      if (!data.html || !data.html.includes("<html")) {
        throw new Error("The generated page is empty or incomplete.");
      }

      setHtml(data.html);
      setSources(data.sources || []);
    } catch (err) {
      setError(err.message || "Could not generate the HTML page.");
    } finally {
      setLoading(false);
    }
  }

  function downloadHtml() {
    if (!html) return;

    const blob = new Blob([html], {
      type: "text/html;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "document-report.html";
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
  }

  return (
    <section className="html-generator">
      <div className="html-heading">
        <div>
          <h2>HTML Page Generator</h2>
          <p>
            Generate an HTML report using your indexed documents.
          </p>
        </div>
        <span className="html-badge">AI Builder</span>
      </div>

      <form className="html-form" onSubmit={generatePage}>
        <label htmlFor="html-topic">
          What page would you like to create?
        </label>

        <textarea
          id="html-topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Example: Create a summary of the HR Code of Conduct"
          rows={3}
          maxLength={1500}
          required
          disabled={loading}
        />

        <button type="submit" disabled={loading || !topic.trim()}>
          {loading ? "Generating page..." : "Generate HTML page"}
        </button>
      </form>

      {loading && (
        <p className="html-loading" role="status">
          Searching documents and building your page. This may take a little time.
        </p>
      )}

      {error && (
        <div className="html-error" role="alert">
          {error}
        </div>
      )}

      {html && (
        <div className="html-result">
          <div className="html-result-heading">
            <h3>Generated page preview</h3>
            <button type="button" onClick={downloadHtml}>
              Download HTML
            </button>
          </div>

          <iframe
            className="html-preview"
            title="Generated document report"
            srcDoc={html}
            sandbox=""
            referrerPolicy="no-referrer"
          />

          {sources.length > 0 && (
            <div className="html-source-list">
              <strong>Source documents</strong>
              <ul>
                {sources.map((source) => (
                  <li key={source}>{source}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}