
import { useState } from "react";
import "./Auth.css";

const API_URL = "http://localhost:5000/api/auth";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState(
    window.location.pathname === "/register" ? "register" : "login"
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function changeMode(nextMode) {
    setMode(nextMode);
    window.history.pushState(
      {},
      "",
      nextMode === "register" ? "/register" : "/login"
    );
    setMessage("");
    setError("");
    setPassword("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (loading) return;

    setLoading(true);
    setError("");
    setMessage("");

    try {
      const endpoint = mode === "register" ? "/register" : "/login";

      const body = {
        ...(mode === "register" ? { name: name.trim() } : {}),
        email: email.trim().toLowerCase(),
        password,
      };

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message || `Request failed (${response.status}).`
        );
      }

      if (mode === "register") {
        setMode("login");
        window.history.pushState({}, "", "/login");
        setPassword("");
        setMessage("Registration successful! Ab apne account se login karo.");
        return;
      }

      if (!data.token || !data.user) {
        throw new Error(
          "Login response mein token ya user missing hai. Backend login route check karo."
        );
      }

      // App.jsx ke saath same storage keys use karo.
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authUser", JSON.stringify(data.user));

      // App.jsx session update karega aur chatbot portal kholega.
      if (typeof onLogin === "function") {
        onLogin({
          token: data.token,
          user: data.user,
        });
      } else {
        // Fallback: page reload karke portal kholne ki koshish.
        window.location.replace("/");
      }
    } catch (err) {
      console.error("Login/Register error:", err);

      setError(
        err.message === "Failed to fetch"
          ? "Backend se connection nahi ho raha. Check karo server localhost:5000 par chal raha hai."
          : err.message || "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f4f7fb",
        padding: 20,
        fontFamily: "Arial, sans-serif",
        color: "#172033",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 420,
          boxSizing: "border-box",
          padding: 28,
          background: "white",
          borderRadius: 14,
          boxShadow: "0 5px 25px #00000010",
        }}
      >
        <h1>{mode === "register" ? "Create Account" : "Welcome Back"}</h1>

        <p>
          {mode === "register"
            ? "Register to use the Chatbot AI Portal."
            : "Login to your existing account."}
        </p>

        <form onSubmit={handleSubmit}>
          {mode === "register" && (
            <>
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                required
                minLength={2}
                maxLength={120}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                style={inputStyle}
                disabled={loading}
              />
            </>
          )}

          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            style={inputStyle}
            disabled={loading}
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            maxLength={128}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            style={inputStyle}
            disabled={loading}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              padding: 13,
              marginTop: 12,
              background: "#2457d6",
              color: "white",
              border: 0,
              borderRadius: 7,
              cursor: loading ? "wait" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading
              ? "Please wait..."
              : mode === "register"
                ? "Register"
                : "Login"}
          </button>
        </form>

        {error && (
          <p role="alert" style={{ color: "#c62828" }}>
            {error}
          </p>
        )}

        {message && (
          <p role="status" style={{ color: "#167647" }}>
            {message}
          </p>
        )}

        <p style={{ marginTop: 20 }}>
          {mode === "register"
            ? "Already have an account? "
            : "Don't have an account? "}

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              changeMode(mode === "register" ? "login" : "register")
            }
            style={{
              border: 0,
              background: "transparent",
              color: "#2457d6",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {mode === "register" ? "Login" : "Register"}
          </button>
        </p>

        <a href="/">Back to Chatbot Portal</a>
      </section>
    </main>
  );
}

const inputStyle = {
  display: "block",
  width: "100%",
  boxSizing: "border-box",
  padding: 12,
  margin: "8px 0 16px",
  border: "1px solid #d5dbe5",
  borderRadius: 7,
  fontSize: 15,
};
