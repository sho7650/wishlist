/**
 * Database Schema Builder Factory
 * 
 * This factory provides database-agnostic schema creation
 * by abstracting the differences between PostgreSQL, MySQL, and SQLite.
 */

export type DatabaseDialect = 'postgres' | 'mysql' | 'sqlite';

interface SchemaDefinition {
  createTables: string;
  createIndexes: string;
}

export class DatabaseSchemaBuilder {
  /**
   * Builds the complete schema for the specified database dialect
   */
  static buildSchema(dialect: DatabaseDialect): string {
    const schema = this.getSchemaDefinition(dialect);
    return `${schema.createTables}\n\n${schema.createIndexes}`;
  }

  /**
   * Gets the schema definition for a specific dialect
   */
  private static getSchemaDefinition(dialect: DatabaseDialect): SchemaDefinition {
    switch (dialect) {
      case 'postgres':
        return this.getPostgresSchema();
      case 'mysql':
        return this.getMySQLSchema();
      case 'sqlite':
        return this.getSQLiteSchema();
      default:
        throw new Error(`Unsupported database dialect: ${dialect}`);
    }
  }

  /**
   * PostgreSQL schema definition
   */
  private static getPostgresSchema(): SchemaDefinition {
    const createTables = `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        google_id TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT,
        picture TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wishes (
        id UUID PRIMARY KEY,
        name TEXT,
        wish TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        support_count INTEGER NOT NULL DEFAULT 0
      );
      
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        wish_id UUID NOT NULL REFERENCES wishes(id),
        created_at TIMESTAMP NOT NULL
      );

      CREATE TABLE IF NOT EXISTS supports (
        id SERIAL PRIMARY KEY,
        wish_id UUID NOT NULL REFERENCES wishes(id) ON DELETE CASCADE,
        session_id TEXT,
        user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `;

    const createIndexes = `
      -- Performance optimization indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_session 
      ON supports(wish_id, session_id) WHERE session_id IS NOT NULL;
      
      CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_user 
      ON supports(wish_id, user_id) WHERE user_id IS NOT NULL;
      
      -- Fast query indexes
      CREATE INDEX IF NOT EXISTS idx_wishes_created_at 
      ON wishes(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_wishes_user_id 
      ON wishes(user_id) WHERE user_id IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS idx_supports_wish_id 
      ON supports(wish_id);
    `;

    return { createTables, createIndexes };
  }

  /**
   * MySQL schema definition
   */
  private static getMySQLSchema(): SchemaDefinition {
    const createTables = `
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        google_id VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        picture TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wishes (
        id CHAR(36) PRIMARY KEY,
        name VARCHAR(255),
        wish TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL,
        user_id INT,
        support_count INT NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
      
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        wish_id CHAR(36) NOT NULL,
        created_at TIMESTAMP NOT NULL,
        FOREIGN KEY (wish_id) REFERENCES wishes(id)
      );

      CREATE TABLE IF NOT EXISTS supports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        wish_id CHAR(36) NOT NULL,
        session_id VARCHAR(255),
        user_id INT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wish_id) REFERENCES wishes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `;

    const createIndexes = `
      -- Performance optimization indexes
      CREATE UNIQUE INDEX idx_supports_wish_session 
      ON supports(wish_id, session_id);
      
      CREATE UNIQUE INDEX idx_supports_wish_user 
      ON supports(wish_id, user_id);
      
      -- Fast query indexes
      CREATE INDEX idx_wishes_created_at 
      ON wishes(created_at DESC);
      
      CREATE INDEX idx_wishes_user_id 
      ON wishes(user_id);
      
      CREATE INDEX idx_supports_wish_id 
      ON supports(wish_id);
    `;

    return { createTables, createIndexes };
  }

  /**
   * SQLite schema definition
   */
  private static getSQLiteSchema(): SchemaDefinition {
    const createTables = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_id TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT,
        picture TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS wishes (
        id TEXT PRIMARY KEY,
        name TEXT,
        wish TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        user_id INTEGER,
        support_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
      
      CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        wish_id TEXT NOT NULL,
        created_at DATETIME NOT NULL,
        FOREIGN KEY (wish_id) REFERENCES wishes(id)
      );

      CREATE TABLE IF NOT EXISTS supports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wish_id TEXT NOT NULL,
        session_id TEXT,
        user_id INTEGER,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (wish_id) REFERENCES wishes(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
      );
    `;

    const createIndexes = `
      -- Performance optimization indexes
      CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_session 
      ON supports(wish_id, session_id) WHERE session_id IS NOT NULL;
      
      CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_user 
      ON supports(wish_id, user_id) WHERE user_id IS NOT NULL;
      
      -- Fast query indexes
      CREATE INDEX IF NOT EXISTS idx_wishes_created_at 
      ON wishes(created_at DESC);
      
      CREATE INDEX IF NOT EXISTS idx_wishes_user_id 
      ON wishes(user_id) WHERE user_id IS NOT NULL;
      
      CREATE INDEX IF NOT EXISTS idx_supports_wish_id 
      ON supports(wish_id);
    `;

    return { createTables, createIndexes };
  }

  /**
   * Helper method to detect database dialect from environment
   */
  static detectDialect(): DatabaseDialect {
    const dbType = process.env.DB_TYPE?.toLowerCase();
    
    if (dbType === 'mysql') return 'mysql';
    if (dbType === 'sqlite') return 'sqlite';
    if (dbType === 'postgres' || dbType === 'postgresql') return 'postgres';
    
    // Default to PostgreSQL (current production setup)
    return 'postgres';
  }
}