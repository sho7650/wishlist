import { SQLiteConnection } from "../../../../src/infrastructure/db/SQLiteConnection";
import fs from "fs";
import path from "path";

describe("SQLiteConnection", () => {
  let connection: SQLiteConnection;
  const testDbPath = "./test-wishlist.db";

  beforeEach(() => {
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Set environment variable for test database
    process.env.SQLITE_DB_PATH = testDbPath;
    connection = new SQLiteConnection();
  });

  afterEach(async () => {
    await connection.close();
    
    // Clean up test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    delete process.env.SQLITE_DB_PATH;
  });

  describe("query", () => {
    it("should execute CREATE TABLE query", async () => {
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const result = await connection.query(createTableQuery, []);
      expect(result).toEqual({
        rows: [],
        rowCount: 0
      });
    });

    it("should execute INSERT and SELECT queries", async () => {
      // Create table
      await connection.query(`
        CREATE TABLE test_table (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL
        )
      `, []);

      // Insert data
      const insertResult = await connection.query(
        "INSERT INTO test_table (name) VALUES (?)",
        ["Test Name"]
      );
      expect(insertResult.rowCount).toBe(1); // INSERT affected 1 row

      // Select data
      const selectResult = await connection.query(
        "SELECT * FROM test_table WHERE name = ?",
        ["Test Name"]
      );
      
      expect(selectResult.rows).toHaveLength(1);
      expect(selectResult.rows[0]).toEqual({
        id: 1,
        name: "Test Name"
      });
      expect(selectResult.rowCount).toBe(1);
    });

    it("should handle query errors", async () => {
      // Test various types of invalid SQL
      await expect(
        connection.query("SELECT FROM", [])
      ).rejects.toThrow(/SQL syntax error/);

      await expect(
        connection.query("INVALID SQL SYNTAX GARBAGE", [])
      ).rejects.toThrow(/SQL syntax error/);

      await expect(
        connection.query("SELECT * FROM non_existent_table_12345", [])
      ).rejects.toThrow();

      // Test empty/null queries
      await expect(
        connection.query("", [])
      ).rejects.toThrow(/Invalid SQL query/);

      await expect(
        connection.query("   ", [])
      ).rejects.toThrow(/Invalid SQL query/);
    });
  });

  describe("initializeDatabase", () => {
    it("should create all required tables and indexes", async () => {
      await connection.initializeDatabase();

      // Verify tables exist by querying sqlite_master
      const result = await connection.query(
        "SELECT name FROM sqlite_master WHERE type='table'",
        []
      );

      const tableNames = result.rows.map(row => row.name);
      expect(tableNames).toContain("users");
      expect(tableNames).toContain("wishes");
      expect(tableNames).toContain("sessions");
      expect(tableNames).toContain("supports");
    });
  });

  describe("close", () => {
    it("should close the database connection", async () => {
      await expect(connection.close()).resolves.not.toThrow();
    });
  });
});