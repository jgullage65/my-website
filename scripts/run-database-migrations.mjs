import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "@neondatabase/serverless";

const root=join(dirname(fileURLToPath(import.meta.url)),"..");
const directory=join(root,"db","migrations");
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try {
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
  for(const name of (await readdir(directory)).filter(name=>name.endsWith(".sql")).sort()) {
    const client=await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext('my-website-schema-migrations'))");
      const applied=await client.query("SELECT 1 FROM schema_migrations WHERE name=$1",[name]);
      if(applied.rows[0]) { await client.query("COMMIT"); continue; }
      await client.query(await readFile(join(directory,name),"utf8"));
      await client.query("INSERT INTO schema_migrations(name) VALUES($1)",[name]);
      await client.query("COMMIT"); process.stdout.write(`applied ${name}\n`);
    } catch(error) { await client.query("ROLLBACK").catch(()=>undefined); throw error; }
    finally { client.release(); }
  }
} finally { await pool.end(); }
