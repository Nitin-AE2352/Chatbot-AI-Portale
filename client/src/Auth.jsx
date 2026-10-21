
import { useState } from "react";
import "./Auth.css";

const API_URL = "http://localhost:5000/api/auth";

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setError(false);

    if (mode === "register" && name.trim().length < 2) {
      setError(true);
      setMessage("Please enter your full name.");
      return;
    }

    if (password.length < 8) {
      setError(true);
      setMessage("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const endpoint =
        mode === "register" ? "/register" : "/login";

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...(mode === "register" ? { name: name.trim() } : {}),
          email: email.trim(),
          password,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Request failed.");
      }

      if (mode === "register") {
        setMode("login");
        setPassword("");
        setMessage("Registration successful! Please log in.");
        setError(false);
      } else {
        if (!result.token || !result.user) {
          throw new Error("The server returned an invalid login response.");
        }

        // Keep the session in this browser.
        localStorage.setItem("authToken", result.token);
        localStorage.setItem("authUser", JSON.stringify(result.user));

        if (typeof onLogin === "function") {
          onLogin({
            token: result.token,
            user: result.user,
          });
        }
      }
    } catch (err) {
      setError(true);
      setMessage(
        err.message === "Failed to fetch"
          ? "Backend se connection nahi ho raha. Server check karo."
          : err.message
      );
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setMessage("");
    setError(false);
    setPassword("");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">AI</div>
          <h1>Chatbot AI Portal</h1>
          <p>Ask questions. Explore your documents.</p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Login
          </button>

          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => switchMode("register")}
          >
            Register
          </button>
        </div>

        <h2>
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h2>

        <p className="auth-subtitle">
          {mode === "login"
            ? "Enter your details to access the portal."
            : "Register with your name, email and password."}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <label>
              Full name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Enter your full name"
                minLength={2}
                maxLength={120}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label>
            Email address
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
            />
          </label>

          {message && (
            <div
              className={`auth-message ${error ? "is-error" : "is-success"}`}
              role="status"
            >
              {message}
            </div>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
                ? "Login to Portal"
                : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          {mode === "login"
            ? "Don't have an account?"
            : "Already have an account?"}{" "}
          <button
            type="button"
            onClick={() =>
              switchMode(mode === "login" ? "register" : "login")
            }
          >
            {mode === "login" ? "Register here" : "Login here"}
          </button>
        </p>
      </section>
    </main>
  );
}
