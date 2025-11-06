import Database from 'better-sqlite3';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Inline schema to avoid reading from disk in serverless bundles
const SQLITE_SCHEMA = `
-- Lovepass Mail Database Schema
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ens TEXT NOT NULL,
    net TEXT NOT NULL DEFAULT 'mainnet',
    from_addr TEXT NOT NULL,
    to_addr TEXT NOT NULL,
    subject TEXT,
    body TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    meta JSON
);

-- Index for efficient listing by ENS, network, and time
CREATE INDEX IF NOT EXISTS idx_messages_ens_net_created
ON messages(ens, net, created_at DESC);

-- Index for efficient lookups by recipient
CREATE INDEX IF NOT EXISTS idx_messages_to_addr
ON messages(to_addr);
`;

// Environment detection - try multiple common variable names
// Temporary: also check if LOVEPASS_DB_PATH contains a postgres:// URL for testing
const POSTGRES_URL = process.env.POSTGRES_URL || 
                    process.env.DATABASE_URL || 
                    process.env.NEON_DATABASE_URL || 
                    process.env.LOVEPASS_POSTGRES_URL ||
                    (process.env.LOVEPASS_DB_PATH?.startsWith('postgresql://') ? process.env.LOVEPASS_DB_PATH : null);
const USE_POSTGRES = !!POSTGRES_URL;

// Compute SQLite DB path with a resilient production fallback to /tmp
const rawDbPathEnv = process.env.LOVEPASS_DB_PATH;
let DB_PATH = rawDbPathEnv || path.join(process.cwd(), 'lovepass.db');
if (!USE_POSTGRES) {
  const isProd = process.env.NODE_ENV === 'production';
  const looksLikePg = typeof DB_PATH === 'string' && DB_PATH.startsWith('postgresql://');
  if (isProd && !looksLikePg) {
    DB_PATH = '/tmp/lovepass.db';
  }
}

let dbInstance = null;
let pgPool = null;

// Mask sensitive parts of connection string for logging
function maskConnectionString(url) {
  if (!url) return 'none';
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.username ? '***:***@' : ''}${parsed.host}${parsed.pathname}`;
  } catch {
    return 'invalid-url';
  }
}

// SQLite implementation
class SQLiteAdapter {
  constructor() {
    this.db = null;
  }

  init() {
    if (this.db) return;

    // Ensure directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Open/create database
    this.db = new Database(DB_PATH);
    
    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');

    // Apply schema (inline to work in serverless)
    this.db.exec(SQLITE_SCHEMA);

    const isProd = process.env.NODE_ENV === 'production';
    if (isProd) {
      console.log(`[db] DB ready: sqlite`);
    } else {
      console.log(`[db] SQLite ready: ${DB_PATH}`);
    }
  }

  insertMessage({ ens, net, from_addr, to_addr, subject, body, meta = null }) {
    this.init();
    const stmt = this.db.prepare(`
      INSERT INTO messages (ens, net, from_addr, to_addr, subject, body, meta)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      ens, 
      net, 
      from_addr, 
      to_addr, 
      subject, 
      body, 
      meta ? JSON.stringify(meta) : null
    );
    
    return result.lastInsertRowid;
  }

  listMessages({ ens, net, limit = 50, offset = 0 }) {
    this.init();
    const stmt = this.db.prepare(`
      SELECT 
        id, ens, net, from_addr, to_addr, subject, body, created_at, meta
      FROM messages 
      WHERE ens = ? AND net = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `);
    
    const rows = stmt.all(ens, net, limit, offset);
    
    // Parse JSON meta field
    return rows.map(row => ({
      ...row,
      meta: row.meta ? JSON.parse(row.meta) : null
    }));
  }

  countMessages({ ens, net }) {
    this.init();
    const stmt = this.db.prepare(`
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE ens = ? AND net = ?
    `);
    
    const result = stmt.get(ens, net);
    return result.count;
  }
}

// PostgreSQL implementation
class PostgresAdapter {
  constructor() {
    this.pool = null;
  }

  async init() {
    if (this.pool) return;

    this.pool = new pg.Pool({
      connectionString: POSTGRES_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Create table if not exists
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        ens TEXT NOT NULL,
        net TEXT NOT NULL DEFAULT 'mainnet',
        from_addr TEXT NOT NULL,
        to_addr TEXT NOT NULL,
        subject TEXT,
        body TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        meta JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_messages_ens_net_created 
      ON messages(ens, net, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_messages_to_addr 
      ON messages(to_addr);
    `;

    await this.pool.query(createTableQuery);
    
    const isProd = process.env.NODE_ENV === 'production';
    const maskedUrl = maskConnectionString(POSTGRES_URL);
    if (isProd) {
      console.log(`[db] DB ready: postgres | ${maskedUrl}`);
    } else {
      console.log(`[db] Postgres ready: ${maskedUrl}`);
    }
  }

  async insertMessage({ ens, net, from_addr, to_addr, subject, body, meta = null }) {
    await this.init();
    const query = `
      INSERT INTO messages (ens, net, from_addr, to_addr, subject, body, meta)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `;
    
    const result = await this.pool.query(query, [
      ens, net, from_addr, to_addr, subject, body, meta
    ]);
    
    return result.rows[0].id;
  }

  async listMessages({ ens, net, limit = 50, offset = 0 }) {
    await this.init();
    const query = `
      SELECT 
        id, ens, net, from_addr, to_addr, subject, body, created_at, meta
      FROM messages 
      WHERE ens = $1 AND net = $2
      ORDER BY created_at DESC
      LIMIT $3 OFFSET $4
    `;
    
    const result = await this.pool.query(query, [ens, net, limit, offset]);
    return result.rows;
  }

  async countMessages({ ens, net }) {
    await this.init();
    const query = `
      SELECT COUNT(*) as count 
      FROM messages 
      WHERE ens = $1 AND net = $2
    `;
    
    const result = await this.pool.query(query, [ens, net]);
    return parseInt(result.rows[0].count);
  }
}

// Factory function to get the appropriate adapter
function getAdapter() {
  if (USE_POSTGRES) {
    if (!pgPool) {
      pgPool = new PostgresAdapter();
    }
    return pgPool;
  } else {
    if (!dbInstance) {
      dbInstance = new SQLiteAdapter();
    }
    return dbInstance;
  }
}

// Public API - these functions handle async/sync differences transparently
export async function init() {
  const adapter = getAdapter();
  if (USE_POSTGRES) {
    await adapter.init();
  } else {
    adapter.init();
  }
}

export async function insertMessage(params) {
  const adapter = getAdapter();
  if (USE_POSTGRES) {
    return await adapter.insertMessage(params);
  } else {
    return adapter.insertMessage(params);
  }
}

export async function listMessages(params) {
  const adapter = getAdapter();
  if (USE_POSTGRES) {
    return await adapter.listMessages(params);
  } else {
    return adapter.listMessages(params);
  }
}

export async function countMessages(params) {
  const adapter = getAdapter();
  if (USE_POSTGRES) {
    return await adapter.countMessages(params);
  } else {
    return adapter.countMessages(params);
  }
}

// Utility function to get current driver info
export function getDriverInfo() {
  return {
    driver: USE_POSTGRES ? 'postgres' : 'sqlite',
    host: USE_POSTGRES ? maskConnectionString(POSTGRES_URL) : DB_PATH
  };
}

// Graceful shutdown
process.on('exit', () => {
  if (dbInstance?.db) {
    dbInstance.db.close();
  }
  if (pgPool?.pool) {
    pgPool.pool.end();
  }
});

process.on('SIGINT', () => {
  if (dbInstance?.db) {
    dbInstance.db.close();
  }
  if (pgPool?.pool) {
    pgPool.pool.end();
  }
  process.exit(0);
});
