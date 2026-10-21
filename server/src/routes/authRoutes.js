
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function createToken(user) {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing in server/.env");
  }

  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Name, email and password are required.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 120) {
      return res.status(400).json({
        message: "Name must be between 2 and 120 characters.",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({
        message: "Please enter a valid email address.",
      });
    }

    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        message: "Password must be between 8 and 128 characters.",
      });
    }

    const existing = await pool.query(
      "SELECT id FROM users WHERE email = $1 LIMIT 1",
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        message: "This email is already registered. Please log in.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, name, email, role`,
      [cleanName, cleanEmail, hashedPassword]
    );

    return res.status(201).json({
      success: true,
      message: "Registration successful. You can now log in.",
      user: publicUser(result.rows[0]),
    });
  } catch (error) {
    console.error("Registration error:", error.message);
    console.error("Registration error code:", error.code || null);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "This email is already registered. Please log in.",
      });
    }

    return res.status(500).json({
      message: "Registration failed.",
      error: error.message || "Unknown server error",
      code: error.code || null,
    });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: "Email and password are required.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const result = await pool.query(
      `SELECT id, name, email, password_hash, role
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [cleanEmail]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    if (
      typeof user.password_hash !== "string" ||
      !user.password_hash.startsWith("$2")
    ) {
      console.error("Stored password_hash is not a valid bcrypt hash.");

      return res.status(500).json({
        message: "Stored password format is invalid. Contact the administrator.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        message: "Invalid email or password.",
      });
    }

    const token = createToken(user);

    return res.json({
      success: true,
      message: "Login successful.",
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error.message);
    console.error("Login error code:", error.code || null);

    return res.status(500).json({
      message: "Login failed.",
      error: error.message || "Unknown server error",
      code: error.code || null,
    });
  }
});

// CURRENT USER
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    return res.json({
      success: true,
      user: publicUser(result.rows[0]),
    });
  } catch (error) {
    console.error("Fetch profile error:", error.message);

    return res.status(500).json({
      message: "Could not load user profile.",
    });
  }
});

module.exports = router;
