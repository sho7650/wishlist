import { DatabaseSchemaBuilder, DatabaseDialect } from "../../../../src/infrastructure/db/DatabaseSchemaBuilder";

describe("DatabaseSchemaBuilder", () => {
  describe("buildSchema", () => {
    describe("PostgreSQL schema generation", () => {
      it("should generate complete PostgreSQL schema with tables and indexes", () => {
        const schema = DatabaseSchemaBuilder.buildSchema("postgres");
        
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS users");
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS wishes");
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS sessions");
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS supports");
        
        // PostgreSQL specific features
        expect(schema).toContain("SERIAL PRIMARY KEY");
        expect(schema).toContain("UUID PRIMARY KEY");
        expect(schema).toContain("TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
        expect(schema).toContain("REFERENCES users(id) ON DELETE SET NULL");
        expect(schema).toContain("REFERENCES wishes(id) ON DELETE CASCADE");
        
        // Indexes
        expect(schema).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_session");
        expect(schema).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_user");
        expect(schema).toContain("CREATE INDEX IF NOT EXISTS idx_wishes_created_at");
        expect(schema).toContain("CREATE INDEX IF NOT EXISTS idx_wishes_user_id");
        expect(schema).toContain("CREATE INDEX IF NOT EXISTS idx_supports_wish_id");
        
        // PostgreSQL conditional indexes
        expect(schema).toContain("WHERE session_id IS NOT NULL");
        expect(schema).toContain("WHERE user_id IS NOT NULL");
      });
      
      it("should contain both tables and indexes sections", () => {
        const schema = DatabaseSchemaBuilder.buildSchema("postgres");
        
        // Should contain template literal structure with tables first, then indexes
        expect(schema).toContain("CREATE TABLE");
        expect(schema).toContain("CREATE INDEX");
        
        // Tables should appear before indexes
        const tableIndex = schema.indexOf("CREATE TABLE");
        const indexIndex = schema.indexOf("CREATE INDEX");
        expect(tableIndex).toBeLessThan(indexIndex);
        
        // Should contain separation between sections
        expect(schema).toContain("\n\n");
      });
    });

    describe("MySQL schema generation", () => {
      it("should generate complete MySQL schema with tables and indexes", () => {
        const schema = DatabaseSchemaBuilder.buildSchema("mysql");
        
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS users");
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS wishes");
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS sessions");
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS supports");
        
        // MySQL specific features
        expect(schema).toContain("INT AUTO_INCREMENT PRIMARY KEY");
        expect(schema).toContain("CHAR(36) PRIMARY KEY");
        expect(schema).toContain("VARCHAR(255)");
        expect(schema).toContain("FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");
        expect(schema).toContain("FOREIGN KEY (wish_id) REFERENCES wishes(id) ON DELETE CASCADE");
        expect(schema).toContain("FOREIGN KEY (wish_id) REFERENCES wishes(id)");
        
        // Indexes (MySQL doesn't use IF NOT EXISTS for regular indexes)
        expect(schema).toContain("CREATE UNIQUE INDEX idx_supports_wish_session");
        expect(schema).toContain("CREATE UNIQUE INDEX idx_supports_wish_user");
        expect(schema).toContain("CREATE INDEX idx_wishes_created_at");
        expect(schema).toContain("CREATE INDEX idx_wishes_user_id");
        expect(schema).toContain("CREATE INDEX idx_supports_wish_id");
        
        // MySQL doesn't support conditional indexes
        expect(schema).not.toContain("WHERE session_id IS NOT NULL");
        expect(schema).not.toContain("WHERE user_id IS NOT NULL");
      });
    });

    describe("SQLite schema generation", () => {
      it("should generate complete SQLite schema with tables and indexes", () => {
        const schema = DatabaseSchemaBuilder.buildSchema("sqlite");
        
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS users");
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS wishes");
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS sessions");
        expect(schema).toContain("CREATE TABLE IF NOT EXISTS supports");
        
        // SQLite specific features
        expect(schema).toContain("INTEGER PRIMARY KEY AUTOINCREMENT");
        expect(schema).toContain("TEXT PRIMARY KEY");
        expect(schema).toContain("DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
        expect(schema).toContain("FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL");
        expect(schema).toContain("FOREIGN KEY (wish_id) REFERENCES wishes(id) ON DELETE CASCADE");
        expect(schema).toContain("FOREIGN KEY (wish_id) REFERENCES wishes(id)");
        
        // Indexes with IF NOT EXISTS
        expect(schema).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_session");
        expect(schema).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_supports_wish_user");
        expect(schema).toContain("CREATE INDEX IF NOT EXISTS idx_wishes_created_at");
        expect(schema).toContain("CREATE INDEX IF NOT EXISTS idx_wishes_user_id");
        expect(schema).toContain("CREATE INDEX IF NOT EXISTS idx_supports_wish_id");
        
        // SQLite supports conditional indexes
        expect(schema).toContain("WHERE session_id IS NOT NULL");
        expect(schema).toContain("WHERE user_id IS NOT NULL");
      });
    });

    describe("Error handling", () => {
      it("should throw error for unsupported database dialect", () => {
        // Test with invalid dialect - need to cast to avoid TypeScript error
        const invalidDialect = "oracle" as DatabaseDialect;
        
        expect(() => {
          DatabaseSchemaBuilder.buildSchema(invalidDialect);
        }).toThrow("Unsupported database dialect: oracle");
      });

      it("should throw error for null/undefined dialect", () => {
        expect(() => {
          DatabaseSchemaBuilder.buildSchema(null as any);
        }).toThrow("Unsupported database dialect: null");
        
        expect(() => {
          DatabaseSchemaBuilder.buildSchema(undefined as any);
        }).toThrow("Unsupported database dialect: undefined");
      });
    });
  });

  describe("detectDialect", () => {
    const originalEnv = process.env.DB_TYPE;

    afterEach(() => {
      // Restore original environment
      if (originalEnv === undefined) {
        delete process.env.DB_TYPE;
      } else {
        process.env.DB_TYPE = originalEnv;
      }
    });

    it("should return 'mysql' when DB_TYPE is 'mysql'", () => {
      process.env.DB_TYPE = "mysql";
      expect(DatabaseSchemaBuilder.detectDialect()).toBe("mysql");
    });

    it("should return 'mysql' when DB_TYPE is 'MYSQL' (case insensitive)", () => {
      process.env.DB_TYPE = "MYSQL";
      expect(DatabaseSchemaBuilder.detectDialect()).toBe("mysql");
    });

    it("should return 'sqlite' when DB_TYPE is 'sqlite'", () => {
      process.env.DB_TYPE = "sqlite";
      expect(DatabaseSchemaBuilder.detectDialect()).toBe("sqlite");
    });

    it("should return 'sqlite' when DB_TYPE is 'SQLITE' (case insensitive)", () => {
      process.env.DB_TYPE = "SQLITE";
      expect(DatabaseSchemaBuilder.detectDialect()).toBe("sqlite");
    });

    it("should return 'postgres' when DB_TYPE is 'postgres'", () => {
      process.env.DB_TYPE = "postgres";
      expect(DatabaseSchemaBuilder.detectDialect()).toBe("postgres");
    });

    it("should return 'postgres' when DB_TYPE is 'postgresql'", () => {
      process.env.DB_TYPE = "postgresql";
      expect(DatabaseSchemaBuilder.detectDialect()).toBe("postgres");
    });

    it("should default to 'postgres' when DB_TYPE is undefined", () => {
      delete process.env.DB_TYPE;
      expect(DatabaseSchemaBuilder.detectDialect()).toBe("postgres");
    });

    it("should default to 'postgres' when DB_TYPE is empty string", () => {
      process.env.DB_TYPE = "";
      expect(DatabaseSchemaBuilder.detectDialect()).toBe("postgres");
    });

    it("should default to 'postgres' when DB_TYPE is unrecognized value", () => {
      process.env.DB_TYPE = "oracle";
      expect(DatabaseSchemaBuilder.detectDialect()).toBe("postgres");
    });

    it("should default to 'postgres' when DB_TYPE is null", () => {
      process.env.DB_TYPE = "null";
      expect(DatabaseSchemaBuilder.detectDialect()).toBe("postgres");
    });
  });

  describe("Schema content validation", () => {
    it("should ensure all schemas contain required tables", () => {
      const dialects: DatabaseDialect[] = ["postgres", "mysql", "sqlite"];
      const requiredTables = ["users", "wishes", "sessions", "supports"];
      
      dialects.forEach(dialect => {
        const schema = DatabaseSchemaBuilder.buildSchema(dialect);
        
        requiredTables.forEach(table => {
          expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
        });
      });
    });

    it("should ensure all schemas contain required indexes", () => {
      const dialects: DatabaseDialect[] = ["postgres", "mysql", "sqlite"];
      const requiredIndexes = [
        "idx_supports_wish_session",
        "idx_supports_wish_user", 
        "idx_wishes_created_at",
        "idx_wishes_user_id",
        "idx_supports_wish_id"
      ];
      
      dialects.forEach(dialect => {
        const schema = DatabaseSchemaBuilder.buildSchema(dialect);
        
        requiredIndexes.forEach(index => {
          expect(schema).toContain(index);
        });
      });
    });

    it("should ensure schemas contain proper foreign key constraints", () => {
      const dialects: DatabaseDialect[] = ["postgres", "mysql", "sqlite"];
      
      dialects.forEach(dialect => {
        const schema = DatabaseSchemaBuilder.buildSchema(dialect);
        
        if (dialect === "postgres") {
          expect(schema).toContain("REFERENCES users(id) ON DELETE SET NULL");
          expect(schema).toContain("REFERENCES wishes(id) ON DELETE CASCADE");
          expect(schema).toContain("REFERENCES wishes(id)");
        } else {
          expect(schema).toContain("FOREIGN KEY");
          expect(schema).toContain("REFERENCES users(id) ON DELETE SET NULL");
          expect(schema).toContain("REFERENCES wishes(id) ON DELETE CASCADE");
        }
      });
    });
  });

  describe("Schema differences validation", () => {
    it("should use different primary key strategies for each dialect", () => {
      const postgresSchema = DatabaseSchemaBuilder.buildSchema("postgres");
      const mysqlSchema = DatabaseSchemaBuilder.buildSchema("mysql");
      const sqliteSchema = DatabaseSchemaBuilder.buildSchema("sqlite");
      
      // PostgreSQL uses SERIAL
      expect(postgresSchema).toContain("SERIAL PRIMARY KEY");
      expect(postgresSchema).toContain("UUID PRIMARY KEY");
      
      // MySQL uses AUTO_INCREMENT and CHAR for UUIDs
      expect(mysqlSchema).toContain("INT AUTO_INCREMENT PRIMARY KEY");
      expect(mysqlSchema).toContain("CHAR(36) PRIMARY KEY");
      
      // SQLite uses AUTOINCREMENT and TEXT for UUIDs
      expect(sqliteSchema).toContain("INTEGER PRIMARY KEY AUTOINCREMENT");
      expect(sqliteSchema).toContain("TEXT PRIMARY KEY");
    });

    it("should use appropriate data types for each dialect", () => {
      const postgresSchema = DatabaseSchemaBuilder.buildSchema("postgres");
      const mysqlSchema = DatabaseSchemaBuilder.buildSchema("mysql");
      const sqliteSchema = DatabaseSchemaBuilder.buildSchema("sqlite");
      
      // PostgreSQL uses TEXT and TIMESTAMP
      expect(postgresSchema).toContain("TEXT UNIQUE NOT NULL");
      expect(postgresSchema).toContain("TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
      
      // MySQL uses VARCHAR and TIMESTAMP
      expect(mysqlSchema).toContain("VARCHAR(255) UNIQUE NOT NULL");
      expect(mysqlSchema).toContain("TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP");
      
      // SQLite uses TEXT and DATETIME
      expect(sqliteSchema).toContain("TEXT UNIQUE NOT NULL");
      expect(sqliteSchema).toContain("DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP");
    });

    it("should handle conditional indexes correctly", () => {
      const postgresSchema = DatabaseSchemaBuilder.buildSchema("postgres");
      const mysqlSchema = DatabaseSchemaBuilder.buildSchema("mysql");
      const sqliteSchema = DatabaseSchemaBuilder.buildSchema("sqlite");
      
      // PostgreSQL and SQLite support conditional indexes
      expect(postgresSchema).toContain("WHERE session_id IS NOT NULL");
      expect(sqliteSchema).toContain("WHERE session_id IS NOT NULL");
      
      // MySQL doesn't support conditional indexes
      expect(mysqlSchema).not.toContain("WHERE session_id IS NOT NULL");
    });
  });
});