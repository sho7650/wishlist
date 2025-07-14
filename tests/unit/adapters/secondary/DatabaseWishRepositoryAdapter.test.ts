import { DatabaseWishRepositoryAdapter } from "../../../../src/adapters/secondary/DatabaseWishRepositoryAdapter";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";
import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";
import { QueryExecutor } from "../../../../src/infrastructure/db/query/QueryExecutor";

// QueryExecutorをモック
const mockQueryExecutor: jest.Mocked<QueryExecutor> = {
  insert: jest.fn(),
  select: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  upsert: jest.fn(),
  selectWithJoin: jest.fn(),
  incrementSupportCount: jest.fn(),
  decrementSupportCount: jest.fn(),
  updateSupportCount: jest.fn(),
  raw: jest.fn(),
};

describe("DatabaseWishRepositoryAdapter", () => {
  let repository: DatabaseWishRepositoryAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new DatabaseWishRepositoryAdapter(mockQueryExecutor);
  });

  describe("save", () => {
    it("should save a wish to the database", async () => {
      const wish = Wish.create({
        id: WishId.fromString("123"),
        content: WishContent.fromString("テストの願い事"),
        authorId: UserId.fromNumber(1),
        name: "テスト太郎"
      });

      mockQueryExecutor.upsert.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.save(wish, 1);

      expect(mockQueryExecutor.upsert).toHaveBeenCalledWith(
        'wishes',
        {
          id: "123",
          name: "テスト太郎",
          wish: "テストの願い事",
          created_at: expect.any(String),
          user_id: 1,
          support_count: 0,
        },
        ['id']
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
      mockQueryExecutor.upsert.mockRejectedValue(error);

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

      // Mock both select calls (main query and supporters query)
      mockQueryExecutor.select
        .mockResolvedValueOnce({ rows: [mockRow] })  // Main wish query
        .mockResolvedValueOnce({ rows: [] });        // Supporters query

      const result = await repository.findById(wishId);

      expect(result).toBeDefined();
      expect(result!.id).toBe("123");
      expect(result!.name).toBe("テスト太郎");
      expect(result!.wish).toBe("テストの願い事");
      expect(result!.supportCount).toBe(5);

      expect(mockQueryExecutor.select).toHaveBeenCalledWith('wishes', {
        where: { id: "123" }
      });
    });

    it("should return null when wish is not found", async () => {
      const wishId = WishId.fromString("nonexistent");
      mockQueryExecutor.select.mockResolvedValue({ rows: [] });

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

      mockQueryExecutor.select
        .mockResolvedValueOnce({ rows: [mockRow] })  // Main query
        .mockResolvedValueOnce({ rows: [] });        // Supporters query

      const result = await repository.findByUserId(userId);

      expect(result).toBeDefined();
      expect(result!.id).toBe("123");
      expect(result!.name).toBe("テスト太郎");

      expect(mockQueryExecutor.select).toHaveBeenCalledWith('wishes', {
        where: { user_id: 1 },
        orderBy: [{ column: 'created_at', direction: 'DESC' }],
        limit: 1
      });
    });

    it("should return null when no wish found for user", async () => {
      const userId = UserId.fromNumber(999);
      mockQueryExecutor.select.mockResolvedValue({ rows: [] });

      const result = await repository.findByUserId(userId);

      expect(result).toBeNull();
    });
  });

  describe("findBySessionId", () => {
    it("should return a wish for the session", async () => {
      const sessionId = SessionId.fromString("session123");
      const mockRow = {
        id: "123",
        name: null,
        wish: "セッションの願い事",
        created_at: new Date("2025-01-01"),
        user_id: null,
        support_count: 2,
      };

      mockQueryExecutor.selectWithJoin
        .mockResolvedValueOnce({ rows: [mockRow] });  // Main query

      mockQueryExecutor.select
        .mockResolvedValueOnce({ rows: [{ session_id: "session123" }] })  // Session query
        .mockResolvedValueOnce({ rows: [] });  // Supporters query

      const result = await repository.findBySessionId(sessionId);

      expect(result).toBeDefined();
      expect(result!.id).toBe("123");
      expect(result!.wish).toBe("セッションの願い事");

      expect(mockQueryExecutor.selectWithJoin).toHaveBeenCalledWith({
        mainTable: 'wishes',
        joins: [
          { table: 'sessions', on: 'wishes.id = sessions.wish_id', type: 'INNER' }
        ],
        select: ['wishes.*'],
        where: { 'sessions.session_id': "session123" }
      });
    });
  });

  describe("findLatest", () => {
    it("should return latest wishes", async () => {
      const mockRows = [
        {
          id: "123",
          name: "テスト太郎",
          wish: "最新の願い事",
          created_at: new Date("2025-01-02"),
          user_id: 1,
          support_count: 1,
        },
        {
          id: "124",
          name: "テスト花子",
          wish: "2番目の願い事",
          created_at: new Date("2025-01-01"),
          user_id: 2,
          support_count: 0,
        },
      ];

      mockQueryExecutor.select
        .mockResolvedValueOnce({ rows: mockRows })  // Main query
        .mockResolvedValue({ rows: [] });  // Supporters queries

      const result = await repository.findLatest(2, 0);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("123");
      expect(result[1].id).toBe("124");

      expect(mockQueryExecutor.select).toHaveBeenCalledWith('wishes', {
        orderBy: [{ column: 'created_at', direction: 'DESC' }],
        limit: 2,
        offset: 0
      });
    });
  });

  describe("addSupport", () => {
    it("should add support for a wish", async () => {
      const wishId = WishId.fromString("123");
      const sessionId = SessionId.fromString("session123");

      // Mock hasSupported to return false (not already supported)
      mockQueryExecutor.select.mockResolvedValueOnce({ rows: [] });
      
      // Mock insert and updateSupportCount
      mockQueryExecutor.insert.mockResolvedValue({ rows: [], rowCount: 1 });
      mockQueryExecutor.updateSupportCount.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.addSupport(wishId, sessionId);

      expect(mockQueryExecutor.insert).toHaveBeenCalledWith('supports', {
        wish_id: "123",
        session_id: "session123",
        user_id: null,
        created_at: expect.any(String)
      });

      expect(mockQueryExecutor.updateSupportCount).toHaveBeenCalledWith("123");
    });

    it("should skip if already supported", async () => {
      const wishId = WishId.fromString("123");
      const sessionId = SessionId.fromString("session123");

      // Mock hasSupported to return true (already supported)
      mockQueryExecutor.select.mockResolvedValue({ rows: [{ id: 1 }] });

      await repository.addSupport(wishId, sessionId);

      // Should not call insert or update
      expect(mockQueryExecutor.insert).not.toHaveBeenCalled();
      expect(mockQueryExecutor.updateSupportCount).not.toHaveBeenCalled();
    });
  });

  describe("removeSupport", () => {
    it("should remove support by session ID", async () => {
      const wishId = WishId.fromString("123");
      const sessionId = SessionId.fromString("session123");

      mockQueryExecutor.delete.mockResolvedValue({ rows: [], rowCount: 1 });
      mockQueryExecutor.updateSupportCount.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.removeSupport(wishId, sessionId);

      expect(mockQueryExecutor.delete).toHaveBeenCalledWith('supports', {
        wish_id: "123",
        session_id: "session123"
      });

      expect(mockQueryExecutor.updateSupportCount).toHaveBeenCalledWith("123");
    });

    it("should remove support by user ID", async () => {
      const wishId = WishId.fromString("123");
      const userId = UserId.fromNumber(1);

      mockQueryExecutor.delete.mockResolvedValue({ rows: [], rowCount: 1 });
      mockQueryExecutor.updateSupportCount.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.removeSupport(wishId, undefined, userId);

      expect(mockQueryExecutor.delete).toHaveBeenCalledWith('supports', {
        wish_id: "123",
        user_id: 1
      });
    });
  });

  describe("hasSupported", () => {
    it("should return true if user has supported", async () => {
      const wishId = WishId.fromString("123");
      const userId = UserId.fromNumber(1);

      mockQueryExecutor.select.mockResolvedValue({ rows: [{ id: 1 }] });

      const result = await repository.hasSupported(wishId, undefined, userId);

      expect(result).toBe(true);
      expect(mockQueryExecutor.select).toHaveBeenCalledWith('supports', {
        columns: ['1'],
        where: {
          wish_id: "123",
          user_id: 1
        },
        limit: 1
      });
    });

    it("should return false if session has not supported", async () => {
      const wishId = WishId.fromString("123");
      const sessionId = SessionId.fromString("session123");

      mockQueryExecutor.select.mockResolvedValue({ rows: [] });

      const result = await repository.hasSupported(wishId, sessionId);

      expect(result).toBe(false);
      expect(mockQueryExecutor.select).toHaveBeenCalledWith('supports', {
        columns: ['1'],
        where: {
          wish_id: "123",
          session_id: "session123"
        },
        limit: 1
      });
    });

    it("should return false if no identifier provided", async () => {
      const wishId = WishId.fromString("123");

      const result = await repository.hasSupported(wishId);

      expect(result).toBe(false);
      expect(mockQueryExecutor.select).not.toHaveBeenCalled();
    });
  });
});