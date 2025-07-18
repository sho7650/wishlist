import { DatabaseWishRepositoryAdapter } from '../../src/adapters/secondary/DatabaseWishRepositoryAdapter';
import { QueryExecutor } from '../../src/infrastructure/db/query/QueryExecutor';
import { SessionId } from '../../src/domain/value-objects/SessionId';
import { UserId } from '../../src/domain/value-objects/UserId';

/**
 * Simplified performance test focusing on query count optimization
 * Validates that the N+1 query optimization actually reduces database calls
 */
describe('Optimized Query Performance', () => {
  let mockQueryExecutor: jest.Mocked<QueryExecutor>;
  let repository: DatabaseWishRepositoryAdapter;

  beforeEach(() => {
    mockQueryExecutor = {
      select: jest.fn(),
      raw: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      selectWithJoin: jest.fn(),
      incrementSupportCount: jest.fn(),
      decrementSupportCount: jest.fn(),
      updateSupportCount: jest.fn(),
    } as jest.Mocked<QueryExecutor>;

    repository = new DatabaseWishRepositoryAdapter(mockQueryExecutor);
  });

  describe('N+1 Query Elimination', () => {
    it('should use optimized batch queries instead of individual queries', async () => {
      // Mock the optimized implementation's three queries
      const wishCount = 20;
      
      const mainQueryResult = {
        rows: Array.from({ length: wishCount }, (_, i) => ({
          id: `wish_${i}`,
          name: `Test Wish ${i}`,
          wish: `This is test wish number ${i}`,
          user_id: i % 2 === 0 ? i + 1 : null,
          created_at: new Date().toISOString(),
          support_count: 2,
          is_supported_by_viewer: i % 3 === 0 ? 1 : 0
        }))
      };

      const sessionQueryResult = {
        rows: Array.from({ length: 5 }, (_, i) => ({
          wish_id: `wish_${i * 2 + 1}`,
          session_id: `session_${i * 2 + 1}`
        }))
      };

      const supportersQueryResult = {
        rows: Array.from({ length: 30 }, (_, i) => ({
          wish_id: `wish_${Math.floor(i / 3)}`,
          session_id: i % 2 === 0 ? `session_${i}` : null,
          user_id: i % 2 === 1 ? i + 1 : null
        }))
      };

      mockQueryExecutor.raw
        .mockResolvedValueOnce(mainQueryResult)     // Main JOIN query
        .mockResolvedValueOnce(sessionQueryResult)  // Batch sessions query
        .mockResolvedValueOnce(supportersQueryResult); // Batch supporters query

      const result = await repository.findLatestWithSupportStatus(
        wishCount,
        0,
        SessionId.fromString('test_session'),
        undefined
      );

      // Verify optimization impact
      expect(result).toHaveLength(wishCount);
      expect(mockQueryExecutor.raw).toHaveBeenCalledTimes(3);
      
      // Verify query patterns
      const [mainCall, sessionCall, supporterCall] = mockQueryExecutor.raw.mock.calls;
      
      // Main query should be a JOIN query
      expect(mainCall[0]).toContain('SELECT');
      expect(mainCall[0]).toContain('LEFT JOIN supports');
      
      // Session query should be a batch IN query
      expect(sessionCall[0]).toContain('SELECT wish_id, session_id');
      expect(sessionCall[0]).toContain('WHERE wish_id IN');
      
      // Supporters query should be a batch IN query
      expect(supporterCall[0]).toContain('SELECT wish_id, session_id, user_id');
      expect(supporterCall[0]).toContain('WHERE wish_id IN');

      // Performance calculation
      const originalQueries = wishCount * 3 + 1; // Original N+1 pattern
      const optimizedQueries = 3; // New batch pattern
      const improvement = Math.round((1 - optimizedQueries / originalQueries) * 100);

      console.log(`\n📊 Performance Optimization Results:`);
      console.log(`   Wishes processed: ${wishCount}`);
      console.log(`   Original queries: ${originalQueries} (N+1 pattern)`);
      console.log(`   Optimized queries: ${optimizedQueries} (batch pattern)`);
      console.log(`   Improvement: ${improvement}% reduction`);
    });

    it('should handle empty results efficiently', async () => {
      mockQueryExecutor.raw.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findLatestWithSupportStatus(10, 0);

      expect(result).toEqual([]);
      expect(mockQueryExecutor.raw).toHaveBeenCalledTimes(1); // Early return on empty
    });

    it('should maintain same interface as original method', async () => {
      // Test all parameter combinations
      const mockResult = { rows: [] };
      
      mockQueryExecutor.raw.mockResolvedValue(mockResult);

      // Test various parameter combinations
      await repository.findLatestWithSupportStatus(10, 0);
      await repository.findLatestWithSupportStatus(10, 0, SessionId.fromString('test'));
      await repository.findLatestWithSupportStatus(10, 0, undefined, UserId.fromNumber(1));

      // Should work without errors and use consistent optimization
      expect(mockQueryExecutor.raw).toHaveBeenCalledTimes(3); // 1 call each (early return on empty)
    });

    it('should demonstrate scalability benefits', async () => {
      const testSizes = [10, 50, 100];
      
      for (const size of testSizes) {
        jest.clearAllMocks();
        
        const mockResult = {
          rows: Array.from({ length: size }, (_, i) => ({
            id: `wish_${i}`,
            name: `Wish ${i}`,
            wish: `Content ${i}`,
            user_id: i,
            created_at: new Date().toISOString(),
            support_count: 1,
            is_supported_by_viewer: 0
          }))
        };

        mockQueryExecutor.raw
          .mockResolvedValueOnce(mockResult)
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] });

        await repository.findLatestWithSupportStatus(size, 0);

        // Verify consistent query count regardless of size
        expect(mockQueryExecutor.raw).toHaveBeenCalledTimes(3);
        
        const originalQueries = size * 3 + 1;
        const optimizedQueries = 3;
        const improvement = Math.round((1 - optimizedQueries / originalQueries) * 100);
        
        console.log(`   ${size} wishes: ${originalQueries} → ${optimizedQueries} queries (${improvement}% better)`);
      }
    });
  });

  describe('Query Structure Validation', () => {
    it('should use proper SQL JOIN syntax in main query', async () => {
      mockQueryExecutor.raw.mockResolvedValue({ rows: [] });

      await repository.findLatestWithSupportStatus(10, 0, SessionId.fromString('test'));

      const mainQuery = mockQueryExecutor.raw.mock.calls[0][0];
      
      // Verify JOIN structure
      expect(mainQuery).toContain('LEFT JOIN supports');
      expect(mainQuery).toContain('vs.wish_id');
      expect(mainQuery).toContain('vs.session_id');
      expect(mainQuery).toContain('vs.user_id');
      
      // Verify performance optimizations
      expect(mainQuery).toContain('ORDER BY w.created_at DESC');
      expect(mainQuery).toContain('LIMIT');
      expect(mainQuery).toContain('OFFSET');
    });

    it('should use efficient IN clauses for batch queries', async () => {
      const mockResult = {
        rows: [
          { id: 'wish_1', name: 'Test', wish: 'Test', user_id: 1, created_at: new Date(), support_count: 0, is_supported_by_viewer: 0 }
        ]
      };

      mockQueryExecutor.raw
        .mockResolvedValueOnce(mockResult)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      await repository.findLatestWithSupportStatus(1, 0);

      // Verify batch query structure
      const sessionQuery = mockQueryExecutor.raw.mock.calls[1][0];
      const supporterQuery = mockQueryExecutor.raw.mock.calls[2][0];
      
      expect(sessionQuery).toContain('WHERE wish_id IN');
      expect(supporterQuery).toContain('WHERE wish_id IN');
    });
  });
});

/**
 * Performance Optimization Summary
 * 
 * This test suite validates the N+1 query optimization implementation:
 * 
 * BEFORE (N+1 Anti-pattern):
 * - 1 main query to fetch wishes
 * - N individual queries for session IDs (where N = anonymous wishes)
 * - N individual queries for supporters (where N = total wishes)
 * - Total: 1 + N*2 to N*3 queries depending on data
 * 
 * AFTER (Batch Loading):
 * - 1 JOIN query for wishes + viewer support status
 * - 1 batch query for all session IDs
 * - 1 batch query for all supporters
 * - Total: 3 queries regardless of data size
 * 
 * IMPACT:
 * - 20 wishes: 61 queries → 3 queries (95% reduction)
 * - 100 wishes: 301 queries → 3 queries (99% reduction)
 * - O(n) → O(1) scalability improvement
 */