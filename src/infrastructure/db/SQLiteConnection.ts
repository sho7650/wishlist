import { DatabaseConnection, DatabaseResult } from "./DatabaseConnection";
import { Logger } from "../../utils/Logger";
import Database from "better-sqlite3";

export class SQLiteConnection implements DatabaseConnection {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const finalDbPath = dbPath || process.env.SQLITE_DB_PATH || './wishlist.db';
    Logger.info(`Connecting to SQLite database: ${finalDbPath}`);
    this.db = new Database(finalDbPath);
  }

  async query(text: string, params: any[]): Promise<DatabaseResult> {
    Logger.debug(`[SQLite] Executing query: ${text.substring(0, 100)}...`);
    Logger.debug(`[SQLite] Parameters:`, params);

    try {
      // better-sqlite3 is synchronous, so we wrap it in async
      let result: any;
      let changes = 0;
      
      if (text.trim().toUpperCase().startsWith('SELECT')) {
        // For SELECT queries, use prepare().all()
        const stmt = this.db.prepare(text);
        result = stmt.all(params);
        changes = result?.length || 0;
      } else {
        // For INSERT/UPDATE/DELETE, use prepare().run()
        const stmt = this.db.prepare(text);
        const info = stmt.run(params);
        changes = info.changes;
        
        // For non-SELECT queries, check if we need to return inserted data
        if (text.toUpperCase().includes('RETURNING')) {
          // SQLite doesn't support RETURNING, so we need to handle this differently
          // For now, return empty result for non-SELECT queries
          result = [];
        } else {
          result = [];
        }
      }
      
      Logger.debug(`[SQLite] Query result: ${result?.length || 0} rows, ${changes} changes`);
      
      return {
        rows: result || [],
        rowCount: changes
      };
    } catch (err: any) {
      Logger.error(`[SQLite] Query error: ${err.message}`);
      throw err;
    }
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
    try {
      this.db.close();
      Logger.info("SQLite connection closed");
    } catch (err: any) {
      Logger.error(`[SQLite] Error closing database: ${err.message}`);
      throw err;
    }
  }
}