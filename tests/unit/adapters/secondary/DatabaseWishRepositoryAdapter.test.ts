import { DatabaseWishRepositoryAdapter } from "../../../../src/adapters/secondary/DatabaseWishRepositoryAdapter";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";
import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";

// データベース接続をモック
const mockDbConnection = {
  query: jest.fn(),
  initializeDatabase: jest.fn(),
  close: jest.fn(),
};

describe("DatabaseWishRepositoryAdapter", () => {
  let repository: DatabaseWishRepositoryAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DatabaseWishRepositoryAdapter(mockDbConnection);
  });

  describe("save", () => {
    it("should save a wish to the database", async () => {
      const wish = Wish.create({
        id: WishId.fromString("123"),
        content: WishContent.fromString("テストの願い事"),
        authorId: UserId.fromNumber(1),
        name: "テスト太郎"
      });

      mockDbConnection.query.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.save(wish, 1);

      expect(mockDbConnection.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO wishes"),
        expect.arrayContaining([
          "123",
          "テスト太郎",
          "テストの願い事",
          expect.any(Date),
          1,
          0,
        ])
      );
    });

    it("should handle save errors gracefully", async () => {
      const wish = Wish.create({
        id: WishId.fromString("123"),
        content: WishContent.fromString("テストの願い事"),
        authorId: UserId.fromNumber(1),
        name: "テスト太郎"
      });

      const error = new Error("Database error");
      mockDbConnection.query.mockRejectedValue(error);

      await expect(repository.save(wish, 1)).rejects.toThrow("Database error");
    });
  });

  describe("findById", () => {
    it("should return a wish when found", async () => {
      const wishId = WishId.fromString("123");
      const mockRow = {
        id: "123",
        name: "テスト太郎",
        wish: "テストの願い事",
        created_at: new Date("2025-01-01"),
        user_id: 1,
        support_count: 5,
      };

      mockDbConnection.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findById(wishId);

      expect(result).toBeDefined();
      expect(result!.id).toBe("123");
      expect(result!.name).toBe("テスト太郎");
      expect(result!.wish).toBe("テストの願い事");
      expect(result!.supportCount).toBe(5);
    });

    it("should return null when wish is not found", async () => {
      const wishId = WishId.fromString("nonexistent");
      mockDbConnection.query.mockResolvedValue({ rows: [] });

      const result = await repository.findById(wishId);

      expect(result).toBeNull();
    });
  });

  describe("findByUserId", () => {
    it("should return a wish for the user", async () => {
      const userId = UserId.fromNumber(1);
      const mockRow = {
        id: "123",
        name: "テスト太郎",
        wish: "ユーザーの願い事",
        created_at: new Date("2025-01-01"),
        user_id: 1,
        support_count: 3,
      };

      mockDbConnection.query.mockResolvedValue({ rows: [mockRow] });

      const result = await repository.findByUserId(userId);

      expect(result).toBeDefined();
      expect(result!.userId).toBe(1);
      expect(result!.wish).toBe("ユーザーの願い事");
    });

    it("should return null when user has no wishes", async () => {
      const userId = UserId.fromNumber(999);
      mockDbConnection.query.mockResolvedValue({ rows: [] });

      const result = await repository.findByUserId(userId);

      expect(result).toBeNull();
    });
  });

  describe("findBySessionId", () => {
    it("should return a wish for the session", async () => {
      const sessionId = SessionId.fromString("session-123");
      const mockRow = {
        id: "456",
        name: null,
        wish: "匿名の願い事",
        created_at: new Date("2025-01-01"),
        user_id: null,
        support_count: 2,
      };

      // Mock multiple query calls: findBySessionId, sessions lookup, and supporters lookup
      mockDbConnection.query
        .mockResolvedValueOnce({ rows: [mockRow] }) // findBySessionId query
        .mockResolvedValueOnce({ rows: [{ session_id: "session-123" }] }) // sessions lookup
        .mockResolvedValueOnce({ rows: [] }); // supporters lookup

      const result = await repository.findBySessionId(sessionId);

      expect(result).toBeDefined();
      expect(result!.id).toBe("456");
      expect(result!.wish).toBe("匿名の願い事");
      expect(result!.userId).toBeUndefined();
    });
  });

  describe("addSupport", () => {
    it("should add support for a user", async () => {
      const wishId = WishId.fromString("123");
      const userId = UserId.fromNumber(2);

      // Mock hasSupported to return false (not already supported)
      mockDbConnection.query.mockResolvedValueOnce({ rows: [] });
      // Mock insert support
      mockDbConnection.query.mockResolvedValueOnce({ rowCount: 1 });
      // Mock update support count
      mockDbConnection.query.mockResolvedValueOnce({ rowCount: 1 });

      await repository.addSupport(wishId, undefined, userId);

      expect(mockDbConnection.query).toHaveBeenCalledTimes(3);
      expect(mockDbConnection.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining("INSERT INTO supports"),
        ["123", null, 2]
      );
    });

    it("should add support for a session", async () => {
      const wishId = WishId.fromString("123");
      const sessionId = SessionId.fromString("session-456");

      // Mock hasSupported to return false
      mockDbConnection.query.mockResolvedValueOnce({ rows: [] });
      // Mock insert support
      mockDbConnection.query.mockResolvedValueOnce({ rowCount: 1 });
      // Mock update support count
      mockDbConnection.query.mockResolvedValueOnce({ rowCount: 1 });

      await repository.addSupport(wishId, sessionId, undefined);

      expect(mockDbConnection.query).toHaveBeenNthCalledWith(2,
        expect.stringContaining("INSERT INTO supports"),
        ["123", "session-456", null]
      );
    });

    it("should skip adding support if already supported", async () => {
      const wishId = WishId.fromString("123");
      const userId = UserId.fromNumber(2);

      // Mock hasSupported to return true (already supported)
      mockDbConnection.query.mockResolvedValueOnce({ rows: [{ exists: true }] });

      await repository.addSupport(wishId, undefined, userId);

      // Should only call hasSupported, not insert
      expect(mockDbConnection.query).toHaveBeenCalledTimes(1);
    });
  });

  describe("removeSupport", () => {
    it("should remove support from a user", async () => {
      const wishId = WishId.fromString("123");
      const userId = UserId.fromNumber(2);

      // Mock delete support
      mockDbConnection.query.mockResolvedValueOnce({ rowCount: 1 });
      // Mock update support count
      mockDbConnection.query.mockResolvedValueOnce({ rowCount: 1 });

      await repository.removeSupport(wishId, undefined, userId);

      expect(mockDbConnection.query).toHaveBeenCalledTimes(2);
      expect(mockDbConnection.query).toHaveBeenNthCalledWith(1,
        expect.stringContaining("DELETE FROM supports"),
        ["123", 2]
      );
    });
  });

  describe("hasSupported", () => {
    it("should return true when user has supported", async () => {
      const wishId = WishId.fromString("123");
      const userId = UserId.fromNumber(2);

      mockDbConnection.query.mockResolvedValue({ rows: [{}] });

      const result = await repository.hasSupported(wishId, undefined, userId);

      expect(result).toBe(true);
    });

    it("should return false when user has not supported", async () => {
      const wishId = WishId.fromString("123");
      const userId = UserId.fromNumber(2);

      mockDbConnection.query.mockResolvedValue({ rows: [] });

      const result = await repository.hasSupported(wishId, undefined, userId);

      expect(result).toBe(false);
    });

    it("should return false when neither userId nor sessionId provided", async () => {
      const wishId = WishId.fromString("123");

      const result = await repository.hasSupported(wishId, undefined, undefined);

      expect(result).toBe(false);
      expect(mockDbConnection.query).not.toHaveBeenCalled();
    });
  });

  describe("findLatest", () => {
    it("should return latest wishes", async () => {
      const mockRows = [
        {
          id: "123",
          name: "テスト1",
          wish: "願い事1",
          created_at: new Date("2025-01-02"),
          user_id: 1,
          support_count: 5,
        },
        {
          id: "456",
          name: null,
          wish: "願い事2",
          created_at: new Date("2025-01-01"),
          user_id: null,
          support_count: 3,
        },
      ];

      // Mock the main query
      mockDbConnection.query.mockResolvedValueOnce({ rows: mockRows });
      // Mock session lookup for anonymous wishes
      mockDbConnection.query.mockResolvedValue({ rows: [{ session_id: "session-123" }] });
      // Mock supporters lookup
      mockDbConnection.query.mockResolvedValue({ rows: [] });

      const result = await repository.findLatest(10, 0);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("123");
      expect(result[1].id).toBe("456");
    });
  });
});