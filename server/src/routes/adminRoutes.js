
const express = require("express");
const router = express.Router();

// IMPORTANT:
// Is path ko apne existing PostgreSQL connection module ke
// actual path se match karo.
const pool = require("../config/db");

// Existing JWT middleware ko reuse karo.
// Agar tumhare project mein middleware ka naam/path alag hai,
// neeche ke imports ko uske hisaab se badlo.
const { authenticateToken, requireAdmin } = require("../middleware/authMiddleware");

// All routes below require a valid login AND admin role.
router.use(authenticateToken);
router.use(requireAdmin);

// Helper: record important admin actions.
async function writeAuditLog(client, adminId, action, targetUserId, details = {}) {
  await client.query(
    `INSERT INTO public.admin_audit_logs
       (admin_id, action, target_user_id, details)
     VALUES ($1, $2, $3, $4)`,
    [adminId, action, targetUserId || null, JSON.stringify(details)]
  );
}

// GET /api/admin/stats
// Existing endpoint preserved.
router.get("/stats", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (
          WHERE is_active = TRUE
        )::int AS active_users,
        COUNT(*) FILTER (
          WHERE role = 'admin'
        )::int AS total_admins
      FROM public.users
    `);

    res.json({ stats: result.rows[0] });
  } catch (error) {
    console.error("Admin stats error:", error);
    res.status(500).json({ message: "Failed to load admin statistics." });
  }
});

// GET /api/admin/overview
router.get("/overview", async (req, res) => {
  try {
    const [usersResult, logsResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)::int AS total_users,
          COUNT(*) FILTER (
            WHERE is_active = TRUE
          )::int AS active_users,
          COUNT(*) FILTER (
            WHERE is_active = FALSE
          )::int AS inactive_users,
          COUNT(*) FILTER (
            WHERE role = 'admin'
          )::int AS total_admins
        FROM public.users
      `),
      pool.query(`
        SELECT id, admin_id, action, target_user_id, details, created_at
        FROM public.admin_audit_logs
        ORDER BY created_at DESC
        LIMIT 10
      `),
    ]);

    // Document count depends on your actual document table.
    // If your RAG documents table is known, add its count here.
    res.json({
      stats: usersResult.rows[0],
      recentActivity: logsResult.rows,
    });
  } catch (error) {
    console.error("Admin overview error:", error);
    res.status(500).json({ message: "Failed to load admin overview." });
  }
});

// GET /api/admin/users
// Existing endpoint preserved.
router.get("/users", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const role = String(req.query.role || "").trim();
    const status = String(req.query.status || "").trim();

    const values = [];
    const conditions = [];

    if (search) {
      values.push(`%${search}%`);
      conditions.push(
        `(email ILIKE $${values.length} OR COALESCE(full_name, '') ILIKE $${values.length})`
      );
    }

    if (role === "admin" || role === "user") {
      values.push(role);
      conditions.push(`role = $${values.length}`);
    }

    if (status === "active") {
      conditions.push("is_active = TRUE");
    } else if (status === "inactive") {
      conditions.push("is_active = FALSE");
    }

    const where = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT id, email, full_name, role, is_active, created_at
       FROM public.users
       ${where}
       ORDER BY created_at DESC
       LIMIT 200`,
      values
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error("Admin users error:", error);
    res.status(500).json({ message: "Failed to load users." });
  }
});

// PATCH /api/admin/users/:id
// Update a user's role or active status.
router.patch("/users/:id", async (req, res) => {
  const { id } = req.params;
  const { role, is_active } = req.body;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ message: "Invalid user ID." });
  }

  if (
    role === undefined &&
    is_active === undefined
  ) {
    return res.status(400).json({
      message: "Provide role or is_active to update.",
    });
  }

  if (role !== undefined && !["admin", "user"].includes(role)) {
    return res.status(400).json({ message: "Invalid role." });
  }

  if (
    is_active !== undefined &&
    typeof is_active !== "boolean"
  ) {
    return res.status(400).json({
      message: "is_active must be true or false.",
    });
  }

  // Never let an administrator disable or demote their own account
  // through this endpoint.
  if (String(req.user.id) === String(id)) {
    return res.status(400).json({
      message: "You cannot change your own role or status here.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT id, email, role, is_active
       FROM public.users
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (currentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found." });
    }

    const current = currentResult.rows[0];

    // Prevent disabling or demoting the last active admin.
    const willRemoveAdmin =
      current.role === "admin" &&
      current.is_active === true &&
      (role === "user" || is_active === false);

    if (willRemoveAdmin) {
      const adminsResult = await client.query(`
        SELECT COUNT(*)::int AS count
        FROM public.users
        WHERE role = 'admin' AND is_active = TRUE
      `);

      if (adminsResult.rows[0].count <= 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "The last active admin cannot be demoted or disabled.",
        });
      }
    }

    const updatedResult = await client.query(
      `UPDATE public.users
       SET role = COALESCE($1, role),
           is_active = COALESCE($2, is_active)
       WHERE id = $3
       RETURNING id, email, full_name, role, is_active, created_at`,
      [role ?? null, is_active ?? null, id]
    );

    await writeAuditLog(
      client,
      req.user.id,
      "USER_UPDATED",
      id,
      {
        before: {
          role: current.role,
          is_active: current.is_active,
        },
        after: {
          role: updatedResult.rows[0].role,
          is_active: updatedResult.rows[0].is_active,
        },
      }
    );

    await client.query("COMMIT");

    res.json({
      message: "User updated successfully.",
      user: updatedResult.rows[0],
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Admin update user error:", error);
    res.status(500).json({ message: "Failed to update user." });
  } finally {
    client.release();
  }
});

// DELETE /api/admin/users/:id
router.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  if (!/^\d+$/.test(id)) {
    return res.status(400).json({ message: "Invalid user ID." });
  }

  if (String(req.user.id) === String(id)) {
    return res.status(400).json({
      message: "You cannot delete your own account.",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const userResult = await client.query(
      `SELECT id, email, role, is_active
       FROM public.users
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (userResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "User not found." });
    }

    const target = userResult.rows[0];

    if (target.role === "admin" && target.is_active) {
      const countResult = await client.query(`
        SELECT COUNT(*)::int AS count
        FROM public.users
        WHERE role = 'admin' AND is_active = TRUE
      `);

      if (countResult.rows[0].count <= 1) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "The last active admin cannot be deleted.",
        });
      }
    }

    // Record the action before deleting the user.
    await writeAuditLog(
      client,
      req.user.id,
      "USER_DELETED",
      id,
      { email: target.email, role: target.role }
    );

    await client.query(
      "DELETE FROM public.users WHERE id = $1",
      [id]
    );

    await client.query("COMMIT");

    res.json({ message: "User deleted successfully." });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Admin delete user error:", error);
    res.status(500).json({
      message: "Failed to delete user. Check related foreign keys.",
    });
  } finally {
    client.release();
  }
});

// GET /api/admin/audit-logs
router.get("/audit-logs", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.id,
        l.admin_id,
        u.email AS admin_email,
        l.action,
        l.target_user_id,
        l.details,
        l.created_at
      FROM public.admin_audit_logs l
      LEFT JOIN public.users u ON u.id = l.admin_id
      ORDER BY l.created_at DESC
      LIMIT 200
    `);

    res.json({ logs: result.rows });
  } catch (error) {
    console.error("Audit logs error:", error);
    res.status(500).json({ message: "Failed to load audit logs." });
  }
});

module.exports = router;
