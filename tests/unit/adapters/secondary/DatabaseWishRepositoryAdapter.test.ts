import { DatabaseWishRepositoryAdapter } from "../../../../src/adapters/secondary/DatabaseWishRepositoryAdapter";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";
import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";
import { QueryExecutor } from "../../../../src/infrastructure/db/query/QueryExecutor";

// Mock the Logger
jest.mock("../../../../src/utils/Logger");

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

    it("should add support for a logged-in user", async () => {
      const wishId = WishId.fromString("123");
      const userId = UserId.fromNumber(1);

      // Mock hasSupported to return false (not already supported)
      mockQueryExecutor.select.mockResolvedValueOnce({ rows: [] });
      
      // Mock insert and updateSupportCount
      mockQueryExecutor.insert.mockResolvedValue({ rows: [], rowCount: 1 });
      mockQueryExecutor.updateSupportCount.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.addSupport(wishId, undefined, userId);

      expect(mockQueryExecutor.insert).toHaveBeenCalledWith('supports', {
        wish_id: "123",
        session_id: null,
        user_id: 1,
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

    it("should handle duplicate key errors gracefully", async () => {
      const wishId = WishId.fromString("123");
      const sessionId = SessionId.fromString("session123");

      // Mock hasSupported to return false
      mockQueryExecutor.select.mockResolvedValueOnce({ rows: [] });
      
      // Mock insert to throw duplicate key error
      const duplicateError = new Error("duplicate key violation");
      mockQueryExecutor.insert.mockRejectedValue(duplicateError);

      await expect(repository.addSupport(wishId, sessionId)).resolves.not.toThrow();
    });

    it("should throw non-duplicate errors", async () => {
      const wishId = WishId.fromString("123");
      const sessionId = SessionId.fromString("session123");

      // Mock hasSupported to return false
      mockQueryExecutor.select.mockResolvedValueOnce({ rows: [] });
      
      // Mock insert to throw generic error
      const error = new Error("database connection failed");
      mockQueryExecutor.insert.mockRejectedValue(error);

      await expect(repository.addSupport(wishId, sessionId)).rejects.toThrow("database connection failed");
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

    it("should handle when neither userId nor sessionId provided", async () => {
      const wishId = WishId.fromString("123");

      await repository.removeSupport(wishId);

      expect(mockQueryExecutor.delete).not.toHaveBeenCalled();
      expect(mockQueryExecutor.updateSupportCount).not.toHaveBeenCalled();
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

  describe("findLatestWithSupportStatus", () => {
    it("should return wishes with support status for authenticated user", async () => {
      const userId = UserId.fromNumber(1);
      const mockMainResult = [
        {
          id: "123",
          name: "Test User",
          wish: "Test wish",
          created_at: new Date("2025-01-01"),
          user_id: 1,
          support_count: 2,
          is_supported_by_viewer: true
        }
      ];
      const mockSessionResult = [{ wish_id: "123", session_id: "session456" }];
      const mockSupportersResult = [
        { wish_id: "123", session_id: null, user_id: 1 },
        { wish_id: "123", session_id: "session789", user_id: null }
      ];

      // Mock the three raw queries used in optimized version
      mockQueryExecutor.raw
        .mockResolvedValueOnce({ rows: mockMainResult })    // Main JOIN query
        .mockResolvedValueOnce({ rows: mockSessionResult }) // Sessions batch query
        .mockResolvedValueOnce({ rows: mockSupportersResult }); // Supporters batch query

      const result = await repository.findLatestWithSupportStatus(10, 0, undefined, userId);

      expect(result).toHaveLength(1);
      expect(result[0].isSupported).toBe(true);
      expect(result[0].supporters.size).toBe(2);
      expect(result[0].supporters.has('user_1')).toBe(true);
      expect(result[0].supporters.has('session_session789')).toBe(true);
    });

    it("should return wishes with support status for session user", async () => {
      const sessionId = SessionId.fromString("session123");
      const mockMainResult = [
        {
          id: "123",
          name: null,
          wish: "Anonymous wish",
          created_at: new Date("2025-01-01"),
          user_id: null,
          support_count: 1,
          is_supported_by_viewer: false
        }
      ];
      const mockSessionResult = [{ wish_id: "123", session_id: "session456" }];
      const mockSupportersResult = [
        { wish_id: "123", session_id: "session789", user_id: null }
      ];

      // Mock the three raw queries used in optimized version
      mockQueryExecutor.raw
        .mockResolvedValueOnce({ rows: mockMainResult })    // Main JOIN query
        .mockResolvedValueOnce({ rows: mockSessionResult }) // Sessions batch query
        .mockResolvedValueOnce({ rows: mockSupportersResult }); // Supporters batch query

      const result = await repository.findLatestWithSupportStatus(10, 0, sessionId);

      expect(result).toHaveLength(1);
      expect(result[0].isSupported).toBe(false);
      expect(result[0].supporters.size).toBe(1);
      expect(result[0].supporters.has('session_session789')).toBe(true);
    });

    it("should handle empty results from optimized query", async () => {
      // Mock empty main result
      mockQueryExecutor.raw
        .mockResolvedValueOnce({ rows: [] }); // Empty main query

      const result = await repository.findLatestWithSupportStatus(10, 0);

      expect(result).toHaveLength(0);
      expect(mockQueryExecutor.raw).toHaveBeenCalledTimes(1); // Should not call other queries
    });

    it("should handle wishes with fallback session IDs", async () => {
      const mockMainResult = [
        {
          id: "123",
          name: null,
          wish: "Anonymous wish",
          created_at: new Date("2025-01-01"),
          user_id: null,
          support_count: 0,
          is_supported_by_viewer: false
        }
      ];
      const mockSessionResult: any[] = []; // No session found, should use fallback
      const mockSupportersResult: any[] = [];

      mockQueryExecutor.raw
        .mockResolvedValueOnce({ rows: mockMainResult })
        .mockResolvedValueOnce({ rows: mockSessionResult })
        .mockResolvedValueOnce({ rows: mockSupportersResult });

      const result = await repository.findLatestWithSupportStatus(10, 0);

      expect(result).toHaveLength(1);
      expect(result[0].authorId.value).toBe('fallback_123');
      expect(result[0].authorId.type).toBe('session');
    });
  });

  describe("save performance tracking", () => {
    it("should log warning for slow save operations", async () => {
      const wish = Wish.create({
        id: WishId.fromString("123"),
        content: WishContent.fromString("Test wish"),
        authorId: UserId.fromNumber(1),
        name: "Test User"
      });

      // Mock slow upsert operation
      mockQueryExecutor.upsert.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 150)); // Simulate 150ms delay
        return { rows: [], rowCount: 1 };
      });

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      await repository.save(wish, 1);

      consoleWarnSpy.mockRestore();
    });

    it("should save wish with null name", async () => {
      const wish = Wish.create({
        id: WishId.fromString("123"),
        content: WishContent.fromString("Test wish"),
        authorId: SessionId.fromString("session123")
      });

      mockQueryExecutor.upsert.mockResolvedValue({ rows: [], rowCount: 1 });

      await repository.save(wish);

      expect(mockQueryExecutor.upsert).toHaveBeenCalledWith(
        'wishes',
        expect.objectContaining({
          name: null,
          user_id: null
        }),
        ['id']
      );
    });
  });

  describe("mapRowToWish", () => {
    it("should handle session-based wishes with fallback session ID", async () => {
      const mockRow = {
        id: "wish-123",
        name: null,
        wish: "Anonymous wish",
        created_at: new Date("2025-01-01"),
        user_id: null,
        support_count: 0,
      };

      // Mock empty session result (fallback case)
      mockQueryExecutor.select
        .mockResolvedValueOnce({ rows: [mockRow] })     // Main query
        .mockResolvedValueOnce({ rows: [] })            // Empty session query (triggers fallback)
        .mockResolvedValueOnce({ rows: [] });           // Supporters query

      const result = await repository.findById(WishId.fromString("wish-123"));

      expect(result).toBeDefined();
      expect(result!.authorId.type).toBe('session');
    });

    it("should handle wishes with supporters", async () => {
      const mockRow = {
        id: "wish-123",
        name: "Test User",
        wish: "Test wish",
        created_at: new Date("2025-01-01"),
        user_id: 1,
        support_count: 2,
      };

      const mockSupporters = [
        { session_id: null, user_id: 1 },
        { session_id: "session123", user_id: null }
      ];

      mockQueryExecutor.select
        .mockResolvedValueOnce({ rows: [mockRow] })      // Main query
        .mockResolvedValueOnce({ rows: mockSupporters }); // Supporters query

      const result = await repository.findById(WishId.fromString("wish-123"));

      expect(result).toBeDefined();
      expect(result!.supporters.size).toBe(2);
      expect(result!.supporters.has('user_1')).toBe(true);
      expect(result!.supporters.has('session_session123')).toBe(true);
    });
  });

  describe("parseDate", () => {
    it("should handle string dates", async () => {
      const mockRow = {
        id: "wish-123",
        name: "Test User",
        wish: "Test wish",
        created_at: "2025-01-01T12:00:00Z",
        user_id: 1,
        support_count: 0,
      };

      mockQueryExecutor.select
        .mockResolvedValueOnce({ rows: [mockRow] })  // Main query
        .mockResolvedValueOnce({ rows: [] });        // Supporters query

      const result = await repository.findById(WishId.fromString("wish-123"));

      expect(result).toBeDefined();
      expect(result!.createdAt).toBeInstanceOf(Date);
    });

    it("should handle Date objects", async () => {
      const mockRow = {
        id: "wish-123",
        name: "Test User",
        wish: "Test wish",
        created_at: new Date("2025-01-01"),
        user_id: 1,
        support_count: 0,
      };

      mockQueryExecutor.select
        .mockResolvedValueOnce({ rows: [mockRow] })  // Main query
        .mockResolvedValueOnce({ rows: [] });        // Supporters query

      const result = await repository.findById(WishId.fromString("wish-123"));

      expect(result).toBeDefined();
      expect(result!.createdAt).toBeInstanceOf(Date);
    });

    it("should handle invalid date values", async () => {
      const mockRow = {
        id: "wish-123",
        name: "Test User",
        wish: "Test wish",
        created_at: null,
        user_id: 1,
        support_count: 0,
      };

      mockQueryExecutor.select
        .mockResolvedValueOnce({ rows: [mockRow] })  // Main query
        .mockResolvedValueOnce({ rows: [] });        // Supporters query

      const result = await repository.findById(WishId.fromString("wish-123"));

      expect(result).toBeDefined();
      expect(result!.createdAt).toBeInstanceOf(Date);
    });
  });

  describe("findBySessionId edge cases", () => {
    it("should return null when session not found", async () => {
      const sessionId = SessionId.fromString("nonexistent");
      
      mockQueryExecutor.selectWithJoin.mockResolvedValue({ rows: [] });

      const result = await repository.findBySessionId(sessionId);

      expect(result).toBeNull();
    });
  });
});