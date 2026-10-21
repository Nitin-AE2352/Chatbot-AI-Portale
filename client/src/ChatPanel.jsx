import { useState } from "react";
import "./ChatPanel.css";

const CHAT_API = "http://localhost:5000/api/chat";

export default function ChatPanel() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendQuestion(event) {
    event.preventDefault();

    const text = question.trim();
    if (!text || loading) return;

    setMessages((previous) => [
      ...previous,
      { role: "user", content: text }
    ]);

    setQuestion("");
    setLoading(true);
    setError("");

    try {
      const response = await fetch(CHAT_API, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ question: text })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to get an answer.");
      }

      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.answer || "No answer was returned.",
          sources: data.sources || []
        }
      ]);
    } catch (err) {
      setError(
        err.message ||
        "Backend se connection nahi ho pa raha. Server aur Ollama check karein."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="chat-panel">
      <div className="chat-heading">
        <div>
          <h2>Ask Your Documents</h2>
          <p>PDF aur doosre uploaded documents se sawaal poochhein.</p>
        </div>
        <span className="chat-status">AI Assistant</span>
      </div>

      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <div className="chat-empty-icon">✦</div>
            <h3>What would you like to know?</h3>
            <p>Try asking a question based on your uploaded files.</p>
            <div className="chat-examples">
              <button
                type="button"
                onClick={() =>
                  setQuestion("Employees ki weekly off kab hoti hai?")
                }
              >
                Employees ki weekly off kab hoti hai?
              </button>
              <button
                type="button"
                onClick={() =>
                  setQuestion("What does the confidentiality agreement say?")
                }
              >
                What does the confidentiality agreement say?
              </button>
            </div>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            className={`chat-message ${message.role}`}
            key={`${message.role}-${index}`}
          >
            <div className="chat-role">
              {message.role === "user" ? "You" : "AI Assistant"}
            </div>

            <div className="chat-bubble">
              {message.content}
            </div>

            {message.sources?.length > 0 && (
              <details className="chat-sources">
                <summary>Sources used ({message.sources.length})</summary>
                <ul>
                  {[
                    ...new Map(
                      message.sources.map((source) => [
                        source.filename,
                        source
                      ])
                    ).values()
                  ].map((source, sourceIndex) => (
                    <li key={`${source.filename}-${sourceIndex}`}>
                      <strong>{source.filename}</strong>
                      <span>
                        {" "}· Chunk {source.chunk}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        ))}

        {loading && (
          <div className="chat-message assistant">
            <div className="chat-role">AI Assistant</div>
            <div className="chat-bubble chat-thinking">
              Searching documents and preparing an answer…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="chat-error" role="alert">
          {error}
        </div>
      )}

      <form className="chat-form" onSubmit={sendQuestion}>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask in Hindi, Hinglish or English..."
          rows={2}
          maxLength={2000}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !question.trim()}>
          {loading ? "Thinking..." : "Send ↑"}
        </button>
      </form>

      <p className="chat-disclaimer">
        Answers are generated from indexed documents. Please verify important details.
      </p>
    </section>
  );
}