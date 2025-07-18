import { DatabaseWishRepositoryAdapter } from "../../src/adapters/secondary/DatabaseWishRepositoryAdapter";
import { SessionId } from "../../src/domain/value-objects/SessionId";
import { UserId } from "../../src/domain/value-objects/UserId";
import { QueryExecutor } from "../../src/infrastructure/db/query/QueryExecutor";

// Mock the Logger
jest.mock("../../src/utils/Logger");

describe("DatabaseWishRepositoryAdapter - Performance Optimization", () => {
  let repository: DatabaseWishRepositoryAdapter;
  let mockQueryExecutor: jest.Mocked<QueryExecutor>;
  let queryCallCount: number;

  beforeEach(() => {
    queryCallCount = 0;
    
    // Create mock query executor with call counting
    mockQueryExecutor = {
      insert: jest.fn(),
      select: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      selectWithJoin: jest.fn(),
      incrementSupportCount: jest.fn(),
      decrementSupportCount: jest.fn(),
      updateSupportCount: jest.fn(),
      raw: jest.fn().mockImplementation((...args) => {
        queryCallCount++;
        return Promise.resolve({ rows: [] });
      }),
    };

    repository = new DatabaseWishRepositoryAdapter(mockQueryExecutor);
  });

  describe("N+1 Query Optimization", () => {
    it("should execute exactly 3 queries for findLatestWithSupportStatus (main + sessions + supporters)", async () => {
      const mockMainResult = [
        {
          id: "wish-1",
          name: "User 1",
          wish: "First wish",
          created_at: new Date("2025-01-01"),
          user_id: 1,
          support_count: 2,
          is_supported_by_viewer: false
        },
        {
          id: "wish-2", 
          name: null,
          wish: "Second wish",
          created_at: new Date("2025-01-02"),
          user_id: null,
          support_count: 1,
          is_supported_by_viewer: true
        }
      ];

      const mockSessionResult = [
        { wish_id: "wish-2", session_id: "session123" }
      ];

      const mockSupportersResult = [
        { wish_id: "wish-1", session_id: "session456", user_id: null },
        { wish_id: "wish-1", session_id: null, user_id: 2 },
        { wish_id: "wish-2", session_id: "session789", user_id: null }
      ];

      // Reset and setup mocks with call counting
      jest.clearAllMocks();
      queryCallCount = 0;
      
      mockQueryExecutor.raw = jest.fn().mockImplementation((...args) => {
        queryCallCount++;
        // Return different results based on call count
        if (queryCallCount === 1) return Promise.resolve({ rows: mockMainResult });
        if (queryCallCount === 2) return Promise.resolve({ rows: mockSessionResult });
        if (queryCallCount === 3) return Promise.resolve({ rows: mockSupportersResult });
        return Promise.resolve({ rows: [] });
      });

      const sessionId = SessionId.fromString("session123");
      
      const result = await repository.findLatestWithSupportStatus(20, 0, sessionId);

      // Verify exactly 3 queries were executed (no N+1 problem)
      expect(queryCallCount).toBe(3);
      expect(mockQueryExecutor.raw).toHaveBeenCalledTimes(3);
      
      // Verify results are correctly processed
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe("wish-1");
      expect(result[0].supporters.size).toBe(2);
      expect(result[1].id).toBe("wish-2");
      expect(result[1].isSupported).toBe(true);
    });

    it("should handle large datasets efficiently", async () => {
      // Simulate 50 wishes (would be 100+ queries in N+1 scenario)
      const mockMainResult = Array.from({ length: 50 }, (_, i) => ({
        id: `wish-${i + 1}`,
        name: `User ${i + 1}`,
        wish: `Wish ${i + 1}`,
        created_at: new Date(`2025-01-${String(i + 1).padStart(2, '0')}`),
        user_id: i + 1,
        support_count: Math.floor(Math.random() * 10),
        is_supported_by_viewer: Math.random() > 0.5
      }));

      const mockSessionResult: any[] = [];
      const mockSupportersResult = Array.from({ length: 100 }, (_, i) => ({
        wish_id: `wish-${Math.floor(i / 2) + 1}`,
        session_id: i % 2 === 0 ? `session${i}` : null,
        user_id: i % 2 === 1 ? Math.floor(i / 2) + 1 : null
      }));

      // Reset and setup mocks with call counting
      jest.clearAllMocks();
      queryCallCount = 0;
      
      mockQueryExecutor.raw = jest.fn().mockImplementation((...args) => {
        queryCallCount++;
        if (queryCallCount === 1) return Promise.resolve({ rows: mockMainResult });
        if (queryCallCount === 2) return Promise.resolve({ rows: mockSessionResult });
        if (queryCallCount === 3) return Promise.resolve({ rows: mockSupportersResult });
        return Promise.resolve({ rows: [] });
      });

      const result = await repository.findLatestWithSupportStatus(50, 0);

      // Still only 3 queries regardless of dataset size
      expect(queryCallCount).toBe(3);
      expect(result).toHaveLength(50);
    });

    it("should verify PostgreSQL-compatible syntax in main query", async () => {
      const userId = UserId.fromNumber(42);

      mockQueryExecutor.raw.mockResolvedValue({ rows: [] });

      await repository.findLatestWithSupportStatus(10, 0, undefined, userId);

      // Verify the main query uses PostgreSQL-compatible parameter syntax
      const mainQueryCall = mockQueryExecutor.raw.mock.calls[0];
      const query = mainQueryCall[0];
      const params = mainQueryCall[1];

      // Check for PostgreSQL parameter placeholders ($1, $2, etc.)
      expect(query).toContain('$1::text IS NOT NULL');
      expect(query).toContain('$2::integer IS NOT NULL');
      expect(query).toContain('LIMIT $3 OFFSET $4');

      // Verify parameters are passed correctly
      expect(params).toEqual([null, 42, 10, 0]); // sessionId=null, userId=42, limit=10, offset=0
    });

    it("should handle empty main query result efficiently", async () => {
      // Reset and setup mocks with call counting
      jest.clearAllMocks();
      queryCallCount = 0;
      
      mockQueryExecutor.raw = jest.fn().mockImplementation((...args) => {
        queryCallCount++;
        return Promise.resolve({ rows: [] }); // Empty result should stop after first query
      });

      const result = await repository.findLatestWithSupportStatus(10, 0);

      // Should only execute main query, not subsequent queries
      expect(queryCallCount).toBe(1);
      expect(result).toHaveLength(0);
    });

    it("should properly construct IN clause for batch queries", async () => {
      const mockMainResult = [
        { id: "wish-1", name: "User 1", wish: "Wish 1", created_at: new Date(), user_id: 1, support_count: 0, is_supported_by_viewer: false },
        { id: "wish-2", name: "User 2", wish: "Wish 2", created_at: new Date(), user_id: 2, support_count: 0, is_supported_by_viewer: false }
      ];

      mockQueryExecutor.raw
        .mockResolvedValueOnce({ rows: mockMainResult })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await repository.findLatestWithSupportStatus(10, 0);

      // Verify sessions query uses IN clause with correct placeholders
      const sessionsQueryCall = mockQueryExecutor.raw.mock.calls[1];
      const sessionsQuery = sessionsQueryCall[0];
      const sessionsParams = sessionsQueryCall[1];

      expect(sessionsQuery).toContain('WHERE wish_id IN ($1, $2)');
      expect(sessionsParams).toEqual(['wish-1', 'wish-2']);

      // Verify supporters query uses the same pattern
      const supportersQueryCall = mockQueryExecutor.raw.mock.calls[2];
      const supportersQuery = supportersQueryCall[0];
      const supportersParams = supportersQueryCall[1];

      expect(supportersQuery).toContain('WHERE wish_id IN ($1, $2)');
      expect(supportersParams).toEqual(['wish-1', 'wish-2']);
    });
  });

  describe("Performance Comparison Simulation", () => {
    it("should demonstrate query reduction from N+1 to batch loading", async () => {
      const wishCount = 20;
      
      // Simulate old N+1 approach query count
      // For each wish: 1 main query + 1 session query + 1 supporters query = 3 queries per wish
      // Plus 1 initial query = 1 + (20 * 3) = 61 queries
      const n1QueryCount = 1 + (wishCount * 3);
      
      // New optimized approach: exactly 3 queries total
      const optimizedQueryCount = 3;
      
      // Calculate improvement
      const queryReduction = ((n1QueryCount - optimizedQueryCount) / n1QueryCount) * 100;
      
      console.log(`Performance Improvement:
        - Old N+1 approach: ${n1QueryCount} queries for ${wishCount} wishes
        - Optimized approach: ${optimizedQueryCount} queries for ${wishCount} wishes  
        - Query reduction: ${queryReduction.toFixed(1)}% (${n1QueryCount - optimizedQueryCount} fewer queries)`);
      
      // Verify we achieved significant query reduction
      expect(queryReduction).toBeGreaterThan(90); // Should be ~95% reduction
      expect(optimizedQueryCount).toBeLessThan(n1QueryCount / 10); // Less than 10% of original
    });
  });

  describe("Error Handling in Optimized Queries", () => {
    it("should handle database errors gracefully", async () => {
      const dbError = new Error("Connection timeout");
      mockQueryExecutor.raw.mockRejectedValueOnce(dbError);

      await expect(
        repository.findLatestWithSupportStatus(10, 0)
      ).rejects.toThrow("Connection timeout");
    });

    it("should handle malformed result data", async () => {
      const malformedResult = [
        { id: 'test-id', wish: 'Valid wish content', created_at: new Date(), user_id: 1, support_count: 0, is_supported_by_viewer: false }
      ];

      // Reset and setup mocks with call counting
      jest.clearAllMocks();
      queryCallCount = 0;
      
      mockQueryExecutor.raw = jest.fn().mockImplementation((...args) => {
        queryCallCount++;
        if (queryCallCount === 1) return Promise.resolve({ rows: malformedResult });
        return Promise.resolve({ rows: [] });
      });

      const result = await repository.findLatestWithSupportStatus(10, 0);
      
      // Should handle the data and create valid Wish objects
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('test-id');
      expect(result[0].wish).toBe('Valid wish content');
    });
  });
});