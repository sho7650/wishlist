import { SQLiteQueryExecutor } from "../../../../../src/infrastructure/db/query/SQLiteQueryExecutor";
import { DatabaseConnection, DatabaseResult } from "../../../../../src/infrastructure/db/DatabaseConnection";

describe("SQLiteQueryExecutor", () => {
  let mockConnection: jest.Mocked<DatabaseConnection>;
  let queryExecutor: SQLiteQueryExecutor;

  beforeEach(() => {
    mockConnection = {
      query: jest.fn(),
      initializeDatabase: jest.fn(),
      close: jest.fn(),
    };
    queryExecutor = new SQLiteQueryExecutor(mockConnection);
  });

  describe("insert", () => {
    it("should execute INSERT query with SQLite syntax", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      const data = { id: "123", name: "Test", value: 42 };
      await queryExecutor.insert("test_table", data);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO test_table (id, name, value)"),
        ["123", "Test", 42]
      );
      
      const query = mockConnection.query.mock.calls[0][0] as string;
      expect(query).toContain("VALUES (?, ?, ?)");
    });
  });

  describe("select", () => {
    it("should execute SELECT query with SQLite parameter syntax", async () => {
      const mockResult: DatabaseResult = { rows: [{ id: "123" }], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      await queryExecutor.select("test_table", {
        where: { id: "123" },
        limit: 10,
        offset: 5
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        "SELECT * FROM test_table WHERE id = ? LIMIT ? OFFSET ?",
        ["123", 10, 5]
      );
    });
  });

  describe("update", () => {
    it("should execute UPDATE query with SQLite parameter syntax", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      const data = { name: "Updated", value: 100 };
      const conditions = { id: "123" };

      await queryExecutor.update("test_table", data, conditions);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE test_table\s+SET name = \?, value = \?\s+WHERE id = \?/),
        ["Updated", 100, "123"]
      );
    });
  });

  describe("delete", () => {
    it("should execute DELETE query with SQLite parameter syntax", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      const conditions = { id: "123", status: "inactive" };
      await queryExecutor.delete("test_table", conditions);

      expect(mockConnection.query).toHaveBeenCalledWith(
        "DELETE FROM test_table WHERE id = ? AND status = ?",
        ["123", "inactive"]
      );
    });
  });

  describe("upsert", () => {
    it("should execute UPSERT query with SQLite ON CONFLICT syntax", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      const data = { id: "123", name: "Test", value: 42 };
      const conflictColumns = ["id"];

      await queryExecutor.upsert("test_table", data, conflictColumns);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("ON CONFLICT (id) DO UPDATE SET"),
        ["123", "Test", 42]
      );
      
      const query = mockConnection.query.mock.calls[0][0] as string;
      expect(query).toContain("name = excluded.name");
      expect(query).toContain("value = excluded.value");
      expect(query).not.toContain("id = excluded.id"); // Should not update conflict column
    });

    it("should handle conflict-only columns with DO NOTHING", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 0 };
      mockConnection.query.mockResolvedValue(mockResult);

      const data = { id: "123" };
      const conflictColumns = ["id"];

      await queryExecutor.upsert("test_table", data, conflictColumns);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("ON CONFLICT (id) DO NOTHING"),
        ["123"]
      );
    });

    it("should exclude created_at from updates but include it in insert", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      const data = { id: "123", name: "Test", created_at: "2024-01-01T00:00:00Z", value: 42 };
      const conflictColumns = ["id"];

      await queryExecutor.upsert("test_table", data, conflictColumns);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("ON CONFLICT (id) DO UPDATE SET"),
        ["123", "Test", "2024-01-01T00:00:00Z", 42]
      );
      
      const query = mockConnection.query.mock.calls[0][0] as string;
      expect(query).toContain("name = excluded.name");
      expect(query).toContain("value = excluded.value");
      expect(query).not.toContain("created_at = excluded.created_at"); // Should not update created_at
      expect(query).not.toContain("id = excluded.id"); // Should not update conflict column
      
      // But should include created_at in the INSERT part
      expect(query).toContain("INSERT INTO test_table (id, name, created_at, value)");
    });
  });

  describe("selectWithJoin", () => {
    it("should execute complex JOIN query with SQLite syntax", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 0 };
      mockConnection.query.mockResolvedValue(mockResult);

      const config = {
        mainTable: "wishes",
        joins: [
          { table: "supports", on: "wishes.id = supports.wish_id", type: "LEFT" as const },
          { table: "users", on: "wishes.user_id = users.id", type: "INNER" as const }
        ],
        select: ["wishes.*", "COUNT(supports.id) as support_count", "users.name"],
        where: { "wishes.status": "active" },
        groupBy: ["wishes.id", "users.id"],
        orderBy: [{ column: "wishes.created_at", direction: "DESC" as const }],
        limit: 20,
        offset: 0
      };

      await queryExecutor.selectWithJoin(config);

      const query = mockConnection.query.mock.calls[0][0] as string;
      expect(query).toContain("LEFT JOIN supports ON wishes.id = supports.wish_id");
      expect(query).toContain("INNER JOIN users ON wishes.user_id = users.id");
      expect(query).toContain("WHERE wishes.status = ?");
      expect(query).toContain("GROUP BY wishes.id, users.id");
      expect(query).toContain("ORDER BY wishes.created_at DESC");
      expect(query).toContain("LIMIT ? OFFSET ?");

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.any(String),
        ["active", 20, 0]
      );
    });
  });

  describe("support count operations", () => {
    it("should increment support count", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      await queryExecutor.incrementSupportCount("wish-123");

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE wishes"),
        ["wish-123"]
      );
      
      const query = mockConnection.query.mock.calls[0][0] as string;
      expect(query).toContain("support_count = support_count + 1");
      expect(query).toContain("WHERE id = ?");
    });

    it("should decrement support count with MAX function (SQLite)", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      await queryExecutor.decrementSupportCount("wish-123");

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE wishes"),
        ["wish-123"]
      );
      
      const query = mockConnection.query.mock.calls[0][0] as string;
      expect(query).toContain("MAX(support_count - 1, 0)"); // SQLite uses MAX instead of GREATEST
      expect(query).toContain("WHERE id = ?");
    });

    it("should update support count from supports table", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      await queryExecutor.updateSupportCount("wish-123");

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE wishes"),
        ["wish-123", "wish-123"]
      );
      
      const query = mockConnection.query.mock.calls[0][0] as string;
      expect(query).toContain("SELECT COUNT(*) FROM supports WHERE wish_id = ?");
      expect(query).toContain("WHERE id = ?");
    });
  });

  describe("raw", () => {
    it("should execute raw query", async () => {
      const mockResult: DatabaseResult = { rows: [{ count: 5 }], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      const result = await queryExecutor.raw("SELECT COUNT(*) as count FROM test_table WHERE status = ?", ["active"]);

      expect(mockConnection.query).toHaveBeenCalledWith(
        "SELECT COUNT(*) as count FROM test_table WHERE status = ?",
        ["active"]
      );
      expect(result).toEqual(mockResult);
    });

    it("should handle query errors and re-throw", async () => {
      const error = new Error("Database connection failed");
      mockConnection.query.mockRejectedValue(error);

      await expect(
        queryExecutor.raw("INVALID SQL", [])
      ).rejects.toThrow("Database connection failed");
    });
  });
});