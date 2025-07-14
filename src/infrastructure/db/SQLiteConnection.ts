import { DatabaseConnection, DatabaseResult } from "./DatabaseConnection";
import { Logger } from "../../utils/Logger";
import * as sqlite3 from "sqlite3";

export class SQLiteConnection implements DatabaseConnection {
  private db: sqlite3.Database;

  constructor() {
    const dbPath = process.env.SQLITE_DB_PATH || './wishlist.db';
    Logger.info(`Connecting to SQLite database: ${dbPath}`);
    this.db = new sqlite3.Database(dbPath);
  }

  async query(text: string, params: any[]): Promise<DatabaseResult> {
    Logger.debug(`[SQLite] Executing query: ${text.substring(0, 100)}...`);
    Logger.debug(`[SQLite] Parameters:`, params);

    return new Promise((resolve, reject) => {
      this.db.all(text, params, (err, rows) => {
        if (err) {
          Logger.error(`[SQLite] Query error: ${err.message}`);
          reject(err);
        } else {
          Logger.debug(`[SQLite] Query result: ${rows?.length || 0} rows`);
          resolve({
            rows: rows || [],
            rowCount: rows?.length || 0
          });
        }
      });
    });
  }

  async initializeDatabase(): Promise<void> {
    Logger.info("Initializing SQLite database tables...");

    const createTablesQueries = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_id TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT,
        picture TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
      
      `CREATE TABLE IF NOT EXISTS wishes (
        id TEXT PRIMARY KEY,
        name TEXT,
        wish TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        support_count INTEGER NOT NULL DEFAULT 0
      )`,
      
      `CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        wish_id TEXT NOT NULL REFERENCES wishes(id),
        created_at TIMESTAMP NOT NULL
      )`,

      `CREATE TABLE IF NOT EXISTS supports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wish_id TEXT NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
        session_id TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,

      // SQLite indexes
      `CREATE INDEX IF NOT EXISTS idx_wishes_created_at ON wishes(created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_wishes_user_id ON wishes(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_supports_wish_id ON supports(wish_id)`,
      
      // SQLite unique constraints
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_session 
       ON supports(wish_id, session_id) WHERE session_id IS NOT NULL`,
      
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_user 
       ON supports(wish_id, user_id) WHERE user_id IS NOT NULL`
    ];

    for (const query of createTablesQueries) {
      await this.query(query, []);
    }
    
    Logger.info("SQLite database initialized successfully");
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) {
          Logger.error(`[SQLite] Error closing database: ${err.message}`);
          reject(err);
        } else {
          Logger.info("SQLite connection closed");
          resolve();
        }
      });
    });
  }
}