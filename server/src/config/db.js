
require("dotenv").config();

const { Pool } = require("pg");

// 1. Check database URL
if (!process.env.SUPABASE_DB_URL) {
  throw new Error("SUPABASE_DB_URL is missing in .env");
}

// 2. Create Supabase PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: {
    rejectUnauthorized: false
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// 3. Handle unexpected database errors
pool.on("error", (error) => {
  console.error(
    "Unexpected PostgreSQL pool error:",
    error.message
  );
});

// 4. Test database connection
async function connectDB() {
  try {
    const result = await pool.query(
      "SELECT NOW() AS current_time"
    );

    console.log(
      "Supabase PostgreSQL connected successfully!"
    );
    console.log(
      "Database time:",
      result.rows[0].current_time
    );
  } catch (error) {
    console.error(
      "Supabase PostgreSQL connection failed:",
      error.message
    );
    throw error;
  }
}

// 5. Export connection function and pool
module.exports = connectDB;
module.exports.pool = pool;
