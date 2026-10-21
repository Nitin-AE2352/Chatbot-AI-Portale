
import { useEffect, useState } from "react";

const API_URL = "http://localhost:5000/api";

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f4f7fb",
    padding: "32px",
    fontFamily: "Arial, sans-serif",
    color: "#172033",
    boxSizing: "border-box",
  },
  card: {
    background: "#fff",
    padding: "24px",
    borderRadius: "12px",
    margin: "24px 0",
    boxShadow: "0 2px 10px #0000000d",
  },
  input: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    margin: "8px 0 16px",
    border: "1px solid #d5dbe5",
    borderRadius: "7px",
    fontSize: "15px",
  },
  button: {
    padding: "12px 20px",
    background: "#2457d6",
    color: "white",
    border: 0,
    borderRadius: "7px",
    cursor: "pointer",
    fontSize: "15px",
  },
  secondaryButton: {
    padding: "10px 16px",
    background: "#e8edf7",
    color: "#172033",
    border: 0,
    borderRadius: "7px",
    cursor: "pointer",
  },
  cell: {
    textAlign: "left",
    padding: "14px",
    borderBottom: "1px solid #eee",
  },
};

async function readResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error(
        "Admin access required. Is account ka role 'admin' nahi hai."
      );
    }

    if (response.status === 401) {
      throw new Error(
        "Login session invalid ya expired hai. Dobara login karo."
      );
    }

    throw new Error(data.message || "Request failed.");
  }

  return data;
}

export default function AdminDashboard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(
    () => localStorage.getItem("token") || ""
  );

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);

  async function loadDashboard(accessToken) {
    const headers = {
      Authorization: `Bearer ${accessToken}`,
    };

    const [statsResponse, usersResponse] = await Promise.all([
      fetch(`${API_URL}/admin/stats`, { headers }),
      fetch(`${API_URL}/admin/users`, { headers }),
    ]);

    const statsData = await readResponse(statsResponse);
    const usersData = await readResponse(usersResponse);

    setStats(statsData.stats);
    setUsers(usersData.users || []);
    setToken(accessToken);
    setLoggedIn(true);

    return true;
  }

  async function handleLogin(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setStats(null);
    setUsers([]);
    setLoggedIn(false);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      const data = await readResponse(response);

      if (!data.token) {
        throw new Error(
          "Login response mein token nahi mila. Backend login API check karo."
        );
      }

      // Dashboard APIs se admin permissions verify karo.
      await loadDashboard(data.token);

      // Token tabhi save hoga jab admin dashboard load ho jaye.
      localStorage.setItem("token", data.token);
      setPassword("");
    } catch (err) {
      localStorage.removeItem("token");
      setToken("");
      setLoggedIn(false);
      setStats(null);
      setUsers([]);
      setError(err.message || "Login nahi ho paya.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setError("");

    try {
      await loadDashboard(token);
    } catch (err) {
      setError(err.message || "Dashboard load nahi hua.");

      if (
        err.message.includes("Admin access required") ||
        err.message.includes("session invalid") ||
        err.message.includes("expired")
      ) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("token");
    setToken("");
    setPassword("");
    setStats(null);
    setUsers([]);
    setLoggedIn(false);
    setError("");
  }

  // Pehle se saved admin session ho to dashboard load karne ki koshish karo.
  useEffect(() => {
    const savedToken = localStorage.getItem("token");

    if (!savedToken) return;

    let cancelled = false;

    async function restoreSession() {
      setLoading(true);

      try {
        const headers = {
          Authorization: `Bearer ${savedToken}`,
        };

        const [statsResponse, usersResponse] = await Promise.all([
          fetch(`${API_URL}/admin/stats`, { headers }),
          fetch(`${API_URL}/admin/users`, { headers }),
        ]);

        const statsData = await readResponse(statsResponse);
        const usersData = await readResponse(usersResponse);

        if (cancelled) return;

        setToken(savedToken);
        setStats(statsData.stats);
        setUsers(usersData.users || []);
        setLoggedIn(true);
      } catch (err) {
        if (cancelled) return;

        localStorage.removeItem("token");
        setToken("");
        setLoggedIn(false);
        setError(
          "Saved session valid nahi hai. Apne admin account se dobara login karo."
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main style={styles.page}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ marginBottom: "8px" }}>Admin Dashboard</h1>
          <p>Chatbot AI Portal — Administration</p>
        </div>

        {loggedIn && (
          <button style={styles.secondaryButton} onClick={handleLogout}>
            Logout
          </button>
        )}
      </header>

      {!loggedIn && (
        <section style={{ ...styles.card, maxWidth: "460px" }}>
          <h2>Admin Login</h2>
          <p>Apne registered admin account se login karo.</p>

          <form onSubmit={handleLogin}>
            <label htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              style={styles.input}
            />

            <label htmlFor="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              style={styles.input}
            />

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Please wait..." : "Login as Admin"}
            </button>
          </form>
        </section>
      )}

      {loading && <p>Dashboard load ho raha hai...</p>}

      {error && (
        <div
          role="alert"
          style={{
            background: "#fff0f0",
            color: "#b42318",
            padding: "14px",
            borderRadius: "8px",
            margin: "16px 0",
          }}
        >
          {error}
        </div>
      )}

      {loggedIn && stats && (
        <>
          <section
            style={{
              ...styles.card,
              maxWidth: "320px",
            }}
          >
            <p>Total Registered Users</p>
            <h2 style={{ fontSize: "40px", margin: "8px 0" }}>
              {stats.totalUsers ?? 0}
            </h2>
          </section>

          <section style={styles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <h2>Users Management</h2>
              <button
                style={styles.secondaryButton}
                onClick={handleRefresh}
                disabled={loading}
              >
                Refresh
              </button>
            </div>

            <p>Registered accounts aur unke assigned roles.</p>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  background: "white",
                }}
              >
                <thead>
                  <tr>
                    {["Name", "Email", "Role", "Joined"].map((heading) => (
                      <th key={heading} style={styles.cell}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td style={styles.cell}>{user.name || "—"}</td>
                      <td style={styles.cell}>{user.email || "—"}</td>
                      <td style={styles.cell}>
                        <span
                          style={{
                            background:
                              user.role === "admin" ? "#e0eaff" : "#edf0f4",
                            padding: "5px 10px",
                            borderRadius: "20px",
                          }}
                        >
                          {user.role || "user"}
                        </span>
                      </td>
                      <td style={styles.cell}>
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}

                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} style={styles.cell}>
                        No registered users found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p style={{ marginTop: "30px" }}>
        <a href="/">← Back to Chatbot Portal</a>
      </p>
    </main>
  );
}
