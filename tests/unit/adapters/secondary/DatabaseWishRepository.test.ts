import { DatabaseWishRepository } from "../../../../src/adapters/secondary/DatabaseWishRepository";
import { Wish } from "../../../../src/domain/entities/Wish";

// データベース接続をモック
const mockDbConnection = {
  query: jest.fn(),
  initializeDatabase: jest.fn(),
  close: jest.fn(),
};

describe("DatabaseWishRepository", () => {
  let repository: DatabaseWishRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DatabaseWishRepository(mockDbConnection);
  });

  describe("save", () => {
    it("should save a wish to the database", async () => {
      // モックの設定
      const wish = new Wish({
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        createdAt: new Date("2025-01-01"),
        userId: 1,
      });

      mockDbConnection.query.mockResolvedValue({ rows: [], rowCount: 1 });

      // 実行
      await repository.save(wish, wish.userId);

      // 検証
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO wishes"),
        [wish.id, wish.name, wish.wish, wish.createdAt, wish.userId, wish.supportCount]
      );
    });

    it("should handle wish without name", async () => {
      // 名前がない願い事
      const wish = new Wish({
        id: "123",
        wish: "テストの願い事",
        createdAt: new Date("2025-01-01"),
        userId: 1, // ユーザーIDを追加
      });

      mockDbConnection.query.mockResolvedValue({ rows: [], rowCount: 1 });

      // 実行
      await repository.save(wish, wish.userId);

      // 検証
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO wishes"),
        [wish.id, null, wish.wish, wish.createdAt, wish.userId, wish.supportCount]
      );
    });

    it("should handle errors in save", async () => {
      const wish = new Wish({
        id: "123",
        wish: "テストの願い事",
        createdAt: new Date("2025-01-01"),
      });

      mockDbConnection.query.mockRejectedValue(new Error("Database error"));

      await expect(repository.save(wish)).rejects.toThrow("Database error");
    });
  });

  describe("findById", () => {
    it("should find a wish by id", async () => {
      // モックの設定
      const mockRow = {
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        created_at: new Date("2025-01-01"),
        user_id: 1, // ユーザーIDを追加
        support_count: 5,
      };

      mockDbConnection.query.mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
      });

      // 実行
      const result = await repository.findById("123");

      // 検証
      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM wishes WHERE id = $1"),
        ["123"]
      );

      expect(result).toBeInstanceOf(Wish);
      expect(result?.id).toBe("123");
      expect(result?.name).toBe("テスト太郎");
      expect(result?.wish).toBe("テストの願い事");
      expect(result?.createdAt).toEqual(new Date("2025-01-01"));
      expect(result?.supportCount).toBe(5);
    });

    it("should return null when wish not found", async () => {
      // 願い事が見つからない場合
      mockDbConnection.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      // 実行
      const result = await repository.findById("non-existent-id");

      // 検証
      expect(result).toBeNull();
    });
  });

  describe("findLatestWithSupportStatus", () => {
    it("should find latest wishes with support status", async () => {
      const mockRows = [
        {
          id: "1",
          name: "User 1",
          wish: "Wish 1",
          created_at: new Date("2025-01-01"),
          user_id: 1,
          support_count: 5,
          is_supported: true,
        },
        {
          id: "2",
          name: "User 2", 
          wish: "Wish 2",
          created_at: new Date("2025-01-02"),
          user_id: 2,
          support_count: 3,
          is_supported: false,
        },
      ];

      mockDbConnection.query.mockResolvedValue({
        rows: mockRows,
        rowCount: 2,
      });

      const result = await repository.findLatestWithSupportStatus(10, 0, "session123", 456);

      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("LEFT JOIN supports s ON w.id = s.wish_id"),
        [10, 0, 456, "session123"]
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(Wish);
      expect(result[0].isSupported).toBe(true);
      expect(result[1].isSupported).toBe(false);
    });

    it("should handle errors in findLatestWithSupportStatus", async () => {
      const error = new Error("Database error");
      mockDbConnection.query.mockRejectedValue(error);

      await expect(repository.findLatestWithSupportStatus(10, 0)).rejects.toThrow("Database error");
    });
  });

  describe("addSupport", () => {
    it("should add support when not already supported", async () => {
      // hasSupported returns false, then addSupport succeeds
      mockDbConnection.query
        .mockResolvedValueOnce({ rows: [{ exists: false }] }) // hasSupported
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // insert support
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // update count

      await repository.addSupport("wish123", "session123", 456);

      expect(mockDbConnection.query).toHaveBeenCalledTimes(3);
    });

    it("should not add support when already supported", async () => {
      // hasSupported returns true
      mockDbConnection.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      await repository.addSupport("wish123", "session123", 456);

      expect(mockDbConnection.query).toHaveBeenCalledTimes(1); // Only hasSupported call
    });

    it("should handle errors in addSupport", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Database error"));

      await expect(repository.addSupport("wish123")).rejects.toThrow("Database error");
    });
  });

  describe("removeSupport", () => {
    it("should remove support successfully", async () => {
      mockDbConnection.query
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }) // delete support
        .mockResolvedValueOnce({ rows: [], rowCount: 1 }); // update count

      await repository.removeSupport("wish123", "session123", 456);

      expect(mockDbConnection.query).toHaveBeenCalledTimes(2);
    });

    it("should handle errors in removeSupport", async () => {
      mockDbConnection.query.mockRejectedValue(new Error("Database error"));

      await expect(repository.removeSupport("wish123")).rejects.toThrow("Database error");
    });
  });

  describe("hasSupported", () => {
    it("should return true when user has supported", async () => {
      mockDbConnection.query.mockResolvedValue({ rows: [{ exists: true }] });

      const result = await repository.hasSupported("wish123", "session123", 456);

      expect(result).toBe(true);
    });

    it("should return false when user has not supported", async () => {
      mockDbConnection.query.mockResolvedValue({ rows: [{ exists: false }] });

      const result = await repository.hasSupported("wish123", "session123", 456);

      expect(result).toBe(false);
    });
  });

  describe("findLatest", () => {
    it("should find latest wishes with limit and offset", async () => {
      const mockRows = [
        {
          id: "1",
          name: "ユーザー1",
          wish: "願い事1",
          created_at: new Date("2025-01-01"),
          user_id: 1,
          support_count: 0,
        },
        {
          id: "2",
          name: "ユーザー2",
          wish: "願い事2",
          created_at: new Date("2025-01-02"),
          user_id: 2,
          support_count: 0,
        },
      ];

      mockDbConnection.query.mockResolvedValue({
        rows: mockRows,
        rowCount: 2,
      });

      const result = await repository.findLatest(10, 20);

      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM wishes ORDER BY created_at DESC LIMIT $1 OFFSET $2"),
        [10, 20]
      );

      expect(result.length).toBe(2);
      expect(result[0]).toBeInstanceOf(Wish);
      expect(result[0].id).toBe("1");
      expect(result[1].id).toBe("2");
    });

    it("should use default offset when not provided", async () => {
      mockDbConnection.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      await repository.findLatest(10);

      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT $1 OFFSET $2"),
        [10, 0]
      );
    });
  });

  describe("findBySessionId", () => {
    it("should find a wish by session id", async () => {
      const mockRow = {
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        created_at: new Date("2025-01-01"),
        user_id: 1,
        support_count: 0,
      };

      mockDbConnection.query.mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
      });

      const result = await repository.findBySessionId("test-session-id");

      expect(mockDbConnection.query).toHaveBeenCalledTimes(1);
      const [query, params] = mockDbConnection.query.mock.calls[0];

      expect(query).toContain("SELECT w.*");
      expect(query).toContain("FROM wishes w");
      expect(query).toContain("JOIN sessions s ON w.id = s.wish_id");
      expect(query).toContain("WHERE s.session_id = $1");
      expect(params).toEqual(["test-session-id"]);

      expect(result).toBeInstanceOf(Wish);
      expect(result?.id).toBe("123");
    });

    it("should return null when session not found", async () => {
      mockDbConnection.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await repository.findBySessionId("non-existent-session");

      expect(result).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("should find a wish by user id", async () => {
      const mockRow = {
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        created_at: new Date("2025-01-01"),
        user_id: 1,
        support_count: 0,
      };

      mockDbConnection.query.mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
      });

      const result = await repository.findByUserId(1);

      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM wishes WHERE user_id = $1 LIMIT 1"),
        [1]
      );

      expect(result).toBeInstanceOf(Wish);
      expect(result?.id).toBe("123");
      expect(result?.userId).toBe(1);
    });

    it("should return null when user has no wish", async () => {
      mockDbConnection.query.mockResolvedValue({
        rows: [],
        rowCount: 0,
      });

      const result = await repository.findByUserId(999);

      expect(result).toBeNull();
    });
  });

  describe("parseDate", () => {
    it("should handle Date objects", async () => {
      const mockRow = {
        id: "123",
        name: "Test",
        wish: "Test wish",
        created_at: new Date("2025-01-01"),
        user_id: 1,
        support_count: 0,
      };

      mockDbConnection.query.mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
      });

      const result = await repository.findById("123");
      expect(result?.createdAt).toBeInstanceOf(Date);
    });

    it("should handle string dates", async () => {
      const mockRow = {
        id: "123", 
        name: "Test",
        wish: "Test wish",
        created_at: "2025-01-01T00:00:00.000Z",
        user_id: 1,
        support_count: 0,
      };

      mockDbConnection.query.mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
      });

      const result = await repository.findById("123");
      expect(result?.createdAt).toBeInstanceOf(Date);
    });

    it("should handle invalid date strings", async () => {
      const mockRow = {
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        created_at: "invalid-date",
        user_id: 1,
        support_count: 0,
      };

      mockDbConnection.query.mockResolvedValue({
        rows: [mockRow],
        rowCount: 1,
      });

      const result = await repository.findById("123");
      expect(result?.createdAt).toBeInstanceOf(Date);
    });
  });
});