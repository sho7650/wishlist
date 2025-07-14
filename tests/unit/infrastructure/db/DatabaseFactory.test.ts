import { DatabaseFactory, DatabaseType } from "../../../../src/infrastructure/db/DatabaseFactory";
import { PostgresConnection } from "../../../../src/infrastructure/db/PostgresConnection";
import { MySQLConnection } from "../../../../src/infrastructure/db/MySQLConnection";
import { SQLiteConnection } from "../../../../src/infrastructure/db/SQLiteConnection";
import { PostgresQueryExecutor } from "../../../../src/infrastructure/db/query/PostgresQueryExecutor";
import { MySQLQueryExecutor } from "../../../../src/infrastructure/db/query/MySQLQueryExecutor";
import { SQLiteQueryExecutor } from "../../../../src/infrastructure/db/query/SQLiteQueryExecutor";

// Mock the database connection classes
jest.mock("../../../../src/infrastructure/db/PostgresConnection");
jest.mock("../../../../src/infrastructure/db/MySQLConnection");
jest.mock("../../../../src/infrastructure/db/SQLiteConnection");
jest.mock("../../../../src/infrastructure/db/query/PostgresQueryExecutor");
jest.mock("../../../../src/infrastructure/db/query/MySQLQueryExecutor");
jest.mock("../../../../src/infrastructure/db/query/SQLiteQueryExecutor");

describe("DatabaseFactory", () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createConnection", () => {
    it("should create PostgreSQL connection by default", () => {
      delete process.env.DB_TYPE;

      const connection = DatabaseFactory.createConnection();

      expect(PostgresConnection).toHaveBeenCalledTimes(1);
      expect(connection).toBeInstanceOf(PostgresConnection);
    });

    it("should create PostgreSQL connection when DB_TYPE=postgres", () => {
      process.env.DB_TYPE = "postgres";

      const connection = DatabaseFactory.createConnection();

      expect(PostgresConnection).toHaveBeenCalledTimes(1);
      expect(connection).toBeInstanceOf(PostgresConnection);
    });

    it("should create MySQL connection when DB_TYPE=mysql", () => {
      process.env.DB_TYPE = "mysql";

      const connection = DatabaseFactory.createConnection();

      expect(MySQLConnection).toHaveBeenCalledTimes(1);
      expect(connection).toBeInstanceOf(MySQLConnection);
    });

    it("should create SQLite connection when DB_TYPE=sqlite", () => {
      process.env.DB_TYPE = "sqlite";

      const connection = DatabaseFactory.createConnection();

      expect(SQLiteConnection).toHaveBeenCalledTimes(1);
      expect(connection).toBeInstanceOf(SQLiteConnection);
    });

    it("should be case-insensitive for DB_TYPE", () => {
      process.env.DB_TYPE = "MYSQL";

      const connection = DatabaseFactory.createConnection();

      expect(MySQLConnection).toHaveBeenCalledTimes(1);
      expect(connection).toBeInstanceOf(MySQLConnection);
    });

    it("should fallback to PostgreSQL for unknown DB_TYPE", () => {
      process.env.DB_TYPE = "unknown_db";

      const connection = DatabaseFactory.createConnection();

      expect(PostgresConnection).toHaveBeenCalledTimes(1);
      expect(connection).toBeInstanceOf(PostgresConnection);
    });

    it("should fallback to PostgreSQL for empty DB_TYPE", () => {
      process.env.DB_TYPE = "";

      const connection = DatabaseFactory.createConnection();

      expect(PostgresConnection).toHaveBeenCalledTimes(1);
      expect(connection).toBeInstanceOf(PostgresConnection);
    });
  });

  describe("createQueryExecutor", () => {
    let mockConnection: any;

    beforeEach(() => {
      mockConnection = {
        query: jest.fn(),
        initializeDatabase: jest.fn(),
        close: jest.fn(),
      };
    });

    it("should create PostgreSQL query executor by default", () => {
      delete process.env.DB_TYPE;

      const executor = DatabaseFactory.createQueryExecutor(mockConnection);

      expect(PostgresQueryExecutor).toHaveBeenCalledWith(mockConnection);
      expect(executor).toBeInstanceOf(PostgresQueryExecutor);
    });

    it("should create PostgreSQL query executor when DB_TYPE=postgres", () => {
      process.env.DB_TYPE = "postgres";

      const executor = DatabaseFactory.createQueryExecutor(mockConnection);

      expect(PostgresQueryExecutor).toHaveBeenCalledWith(mockConnection);
      expect(executor).toBeInstanceOf(PostgresQueryExecutor);
    });

    it("should create MySQL query executor when DB_TYPE=mysql", () => {
      process.env.DB_TYPE = "mysql";

      const executor = DatabaseFactory.createQueryExecutor(mockConnection);

      expect(MySQLQueryExecutor).toHaveBeenCalledWith(mockConnection);
      expect(executor).toBeInstanceOf(MySQLQueryExecutor);
    });

    it("should create SQLite query executor when DB_TYPE=sqlite", () => {
      process.env.DB_TYPE = "sqlite";

      const executor = DatabaseFactory.createQueryExecutor(mockConnection);

      expect(SQLiteQueryExecutor).toHaveBeenCalledWith(mockConnection);
      expect(executor).toBeInstanceOf(SQLiteQueryExecutor);
    });

    it("should be case-insensitive for DB_TYPE", () => {
      process.env.DB_TYPE = "SQLITE";

      const executor = DatabaseFactory.createQueryExecutor(mockConnection);

      expect(SQLiteQueryExecutor).toHaveBeenCalledWith(mockConnection);
      expect(executor).toBeInstanceOf(SQLiteQueryExecutor);
    });

    it("should fallback to PostgreSQL query executor for unknown DB_TYPE", () => {
      process.env.DB_TYPE = "unknown_db";

      const executor = DatabaseFactory.createQueryExecutor(mockConnection);

      expect(PostgresQueryExecutor).toHaveBeenCalledWith(mockConnection);
      expect(executor).toBeInstanceOf(PostgresQueryExecutor);
    });
  });

  describe("getSupportedDatabaseTypes", () => {
    it("should return all supported database types", () => {
      const supportedTypes = DatabaseFactory.getSupportedDatabaseTypes();

      expect(supportedTypes).toEqual(['postgres', 'mysql', 'sqlite']);
      expect(supportedTypes).toHaveLength(3);
    });

    it("should return the same array each time", () => {
      const types1 = DatabaseFactory.getSupportedDatabaseTypes();
      const types2 = DatabaseFactory.getSupportedDatabaseTypes();

      expect(types1).toEqual(types2);
    });
  });

  describe("database type validation", () => {
    it("should handle mixed case and whitespace in DB_TYPE", () => {
      process.env.DB_TYPE = "  MySQL  ";

      const connection = DatabaseFactory.createConnection();

      expect(PostgresConnection).toHaveBeenCalledTimes(1); // Should fallback due to whitespace
    });

    it("should validate supported types correctly", () => {
      const supportedTypes: DatabaseType[] = ['postgres', 'mysql', 'sqlite'];

      supportedTypes.forEach(dbType => {
        process.env.DB_TYPE = dbType;
        
        // Should not throw and should create appropriate connection
        expect(() => DatabaseFactory.createConnection()).not.toThrow();
      });
    });
  });
});
