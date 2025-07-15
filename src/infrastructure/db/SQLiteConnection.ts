import { DatabaseConnection, DatabaseResult } from "./DatabaseConnection";
import { Logger } from "../../utils/Logger";
import Database from "better-sqlite3";
import { DatabaseSchemaBuilder } from "./DatabaseSchemaBuilder";

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
      // Validate SQL text before preparing statement
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        throw new Error('Invalid SQL query: empty or null query text');
      }

      // better-sqlite3 is synchronous, so we wrap it in async
      let result: any;
      let changes = 0;
      let stmt: Database.Statement;

      // Prepare statement (this can throw for invalid SQL)
      try {
        stmt = this.db.prepare(text);
      } catch (prepareError: any) {
        Logger.error(`[SQLite] SQL preparation error: ${prepareError.message}`);
        throw new Error(`SQL syntax error: ${prepareError.message}`);
      }
      
      if (text.trim().toUpperCase().startsWith('SELECT')) {
        // For SELECT queries, use prepare().all()
        result = stmt.all(params);
        changes = result?.length || 0;
      } else {
        // For INSERT/UPDATE/DELETE, use prepare().run()
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
      // Ensure we always throw an error for invalid queries
      throw err;
    }
  }

  async initializeDatabase(): Promise<void> {
    Logger.info("Initializing SQLite database tables...");

    // Use DatabaseSchemaBuilder for consistent schema management
    const schemaQuery = DatabaseSchemaBuilder.buildSchema('sqlite');
    
    // Execute the unified schema
    this.db.exec(schemaQuery);
    
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