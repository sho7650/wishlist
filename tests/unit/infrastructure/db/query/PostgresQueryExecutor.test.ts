import { PostgresQueryExecutor } from "../../../../../src/infrastructure/db/query/PostgresQueryExecutor";
import { DatabaseConnection, DatabaseResult } from "../../../../../src/infrastructure/db/DatabaseConnection";

describe("PostgresQueryExecutor", () => {
  let mockConnection: jest.Mocked<DatabaseConnection>;
  let queryExecutor: PostgresQueryExecutor;

  beforeEach(() => {
    mockConnection = {
      query: jest.fn(),
      initializeDatabase: jest.fn(),
      close: jest.fn(),
    };
    queryExecutor = new PostgresQueryExecutor(mockConnection);
  });

  describe("insert", () => {
    it("should execute INSERT query with correct parameters", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      const data = { id: "123", name: "Test", value: 42 };
      await queryExecutor.insert("test_table", data);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO test_table (id, name, value)"),
        ["123", "Test", 42]
      );
    });
  });

  describe("select", () => {
    it("should execute SELECT query with basic options", async () => {
      const mockResult: DatabaseResult = { rows: [{ id: "123" }], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      await queryExecutor.select("test_table", {
        where: { id: "123" },
        limit: 10,
        offset: 5
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM test_table WHERE id = $1 LIMIT $2 OFFSET $3"),
        ["123", 10, 5]
      );
    });

    it("should execute SELECT query with ORDER BY", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 0 };
      mockConnection.query.mockResolvedValue(mockResult);

      await queryExecutor.select("test_table", {
        orderBy: [
          { column: "created_at", direction: "DESC" },
          { column: "name", direction: "ASC" }
        ]
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("ORDER BY created_at DESC, name ASC"),
        []
      );
    });

    it("should execute SELECT query with specific columns", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 0 };
      mockConnection.query.mockResolvedValue(mockResult);

      await queryExecutor.select("test_table", {
        columns: ["id", "name", "created_at"]
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        "SELECT id, name, created_at FROM test_table",
        []
      );
    });
  });

  describe("update", () => {
    it("should execute UPDATE query with correct parameters", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      const data = { name: "Updated", value: 100 };
      const conditions = { id: "123" };

      await queryExecutor.update("test_table", data, conditions);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE test_table\s+SET name = \$1, value = \$2\s+WHERE id = \$3/),
        ["Updated", 100, "123"]
      );
    });
  });

  describe("delete", () => {
    it("should execute DELETE query with correct parameters", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      const conditions = { id: "123", status: "inactive" };
      await queryExecutor.delete("test_table", conditions);

      expect(mockConnection.query).toHaveBeenCalledWith(
        "DELETE FROM test_table WHERE id = $1 AND status = $2",
        ["123", "inactive"]
      );
    });
  });

  describe("upsert", () => {
    it("should execute UPSERT query with PostgreSQL ON CONFLICT syntax", async () => {
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
      expect(query).toContain("name = EXCLUDED.name");
      expect(query).toContain("value = EXCLUDED.value");
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
  });

  describe("selectWithJoin", () => {
    it("should execute complex JOIN query", async () => {
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
      expect(query).toContain("WHERE wishes.status = $1");
      expect(query).toContain("GROUP BY wishes.id, users.id");
      expect(query).toContain("ORDER BY wishes.created_at DESC");
      expect(query).toContain("LIMIT $2 OFFSET $3");

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
      expect(query).toContain("WHERE id = $1");
    });

    it("should decrement support count with GREATEST to prevent negative values", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      await queryExecutor.decrementSupportCount("wish-123");

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE wishes"),
        ["wish-123"]
      );
      
      const query = mockConnection.query.mock.calls[0][0] as string;
      expect(query).toContain("GREATEST(support_count - 1, 0)");
      expect(query).toContain("WHERE id = $1");
    });

    it("should update support count from supports table", async () => {
      const mockResult: DatabaseResult = { rows: [], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      await queryExecutor.updateSupportCount("wish-123");

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE wishes"),
        ["wish-123"]
      );
      
      const query = mockConnection.query.mock.calls[0][0] as string;
      expect(query).toContain("SELECT COUNT(*) FROM supports WHERE wish_id = $1");
      expect(query).toContain("WHERE id = $1");
    });
  });

  describe("raw", () => {
    it("should execute raw query", async () => {
      const mockResult: DatabaseResult = { rows: [{ count: 5 }], rowCount: 1 };
      mockConnection.query.mockResolvedValue(mockResult);

      const result = await queryExecutor.raw("SELECT COUNT(*) as count FROM test_table WHERE status = $1", ["active"]);

      expect(mockConnection.query).toHaveBeenCalledWith(
        "SELECT COUNT(*) as count FROM test_table WHERE status = $1",
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