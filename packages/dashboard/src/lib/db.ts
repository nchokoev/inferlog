import { Pool } from "pg";

// Singleton pool – safe to import in server components / API routes
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export default pool;
