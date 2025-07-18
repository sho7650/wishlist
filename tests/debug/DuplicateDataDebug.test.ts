import { DatabaseWishRepositoryAdapter } from "../../src/adapters/secondary/DatabaseWishRepositoryAdapter";
import { UserId } from "../../src/domain/value-objects/UserId";
import { SessionId } from "../../src/domain/value-objects/SessionId";
import { QueryExecutor } from "../../src/infrastructure/db/query/QueryExecutor";
import { Logger } from "../../src/utils/Logger";

// Mock the Logger to capture debug logs
jest.mock("../../src/utils/Logger");

describe("Data Duplication Debug Test", () => {
  let repository: DatabaseWishRepositoryAdapter;
  let mockQueryExecutor: jest.Mocked<QueryExecutor>;
  let loggerSpy: jest.SpyInstance;
  let originalLogLevel: string | undefined;

  beforeEach(() => {
    // Save original log level and set to debug
    originalLogLevel = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'debug';
    
    // Spy on Logger.debug to capture debug messages
    loggerSpy = jest.spyOn(Logger, 'debug').mockImplementation();

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
      raw: jest.fn(),
    };

    repository = new DatabaseWishRepositoryAdapter(mockQueryExecutor);
  });

  afterEach(() => {
    // Restore original log level
    if (originalLogLevel !== undefined) {
      process.env.LOG_LEVEL = originalLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
    jest.clearAllMocks();
  });

  describe("Duplicate Detection in Optimized Query", () => {
    it("should detect and log when main query returns duplicate wish IDs", async () => {
      // Simulate main query with duplicate wish IDs (potential JOIN issue)
      const duplicateMainResult = [
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
          id: "wish-1", // DUPLICATE - This could happen if JOIN causes duplication
          name: "User 1",
          wish: "First wish",
          created_at: new Date("2025-01-01"),
          user_id: 1,
          support_count: 2,
          is_supported_by_viewer: true // Different support status
        },
        {
          id: "wish-2",
          name: null,
          wish: "Second wish",
          created_at: new Date("2025-01-02"),
          user_id: null,
          support_count: 1,
          is_supported_by_viewer: false
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

      // Setup mocks to return test data
      mockQueryExecutor.raw
        .mockResolvedValueOnce({ rows: duplicateMainResult })    // Main query with duplicates
        .mockResolvedValueOnce({ rows: mockSessionResult })      // Sessions query
        .mockResolvedValueOnce({ rows: mockSupportersResult });  // Supporters query

      const sessionId = SessionId.fromString("session123");
      
      const result = await repository.findLatestWithSupportStatus(20, 0, sessionId);

      // Check if debug logs were called
      expect(loggerSpy).toHaveBeenCalled();
      
      // Find the log that checks for duplicates
      const duplicateCheckLog = loggerSpy.mock.calls.find(call => 
        call[0].includes('Main query results') && call[1].duplicateCheck
      );
      
      expect(duplicateCheckLog).toBeDefined();
      expect(duplicateCheckLog[1].duplicateCheck.hasDuplicates).toBe(true);
      expect(duplicateCheckLog[1].duplicateCheck.duplicates).toContain("wish-1");

      // Verify final result has no duplicates (should be deduplicated by DISTINCT)
      const finalLog = loggerSpy.mock.calls.find(call => 
        call[0].includes('Final mapped wishes')
      );
      
      expect(finalLog).toBeDefined();
      expect(finalLog[1].duplicateCheck.hasDuplicates).toBe(false);
      expect(result.length).toBe(2); // Should be deduplicated
    });

    it("should log detailed query execution information for debugging", async () => {
      const mockMainResult = [
        {
          id: "wish-1",
          name: "User 1",
          wish: "Test wish",
          created_at: new Date("2025-01-01"),
          user_id: 1,
          support_count: 1,
          is_supported_by_viewer: false
        }
      ];

      mockQueryExecutor.raw
        .mockResolvedValueOnce({ rows: mockMainResult })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] });

      const userId = UserId.fromNumber(42);
      
      await repository.findLatestWithSupportStatus(10, 0, undefined, userId);

      // Verify query execution logging
      const queryLog = loggerSpy.mock.calls.find(call => 
        call[0].includes('Executing optimized main query')
      );
      
      expect(queryLog).toBeDefined();
      expect(queryLog[1].query).toContain('SELECT DISTINCT');
      expect(queryLog[1].params).toEqual([null, 42, 10, 0]);

      // Verify session query logging
      const sessionLog = loggerSpy.mock.calls.find(call => 
        call[0].includes('Session query results')
      );
      
      expect(sessionLog).toBeDefined();
      expect(sessionLog[1].rowCount).toBe(0);

      // Verify supporters query logging
      const supportersLog = loggerSpy.mock.calls.find(call => 
        call[0].includes('Supporters query results')
      );
      
      expect(supportersLog).toBeDefined();
      expect(supportersLog[1].rowCount).toBe(0);
    });

    it("should detect multiple supporters for same wish causing JOIN duplication", async () => {
      // Simulate a wish with multiple supporters that could cause JOIN duplication
      const multiSupporterMainResult = [
        {
          id: "wish-1",
          name: "User 1", 
          wish: "Popular wish",
          created_at: new Date("2025-01-01"),
          user_id: 1,
          support_count: 3,
          is_supported_by_viewer: false
        }
      ];

      const mockSupportersResult = [
        { wish_id: "wish-1", session_id: "session1", user_id: null },
        { wish_id: "wish-1", session_id: "session2", user_id: null },
        { wish_id: "wish-1", session_id: null, user_id: 2 },
        { wish_id: "wish-1", session_id: null, user_id: 3 },
        { wish_id: "wish-1", session_id: null, user_id: 4 }
      ];

      mockQueryExecutor.raw
        .mockResolvedValueOnce({ rows: multiSupporterMainResult })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: mockSupportersResult });

      await repository.findLatestWithSupportStatus(10, 0);

      // Check supporters grouping
      const supportersLog = loggerSpy.mock.calls.find(call => 
        call[0].includes('Supporters query results')
      );
      
      expect(supportersLog).toBeDefined();
      expect(supportersLog[1].supportersByWish["wish-1"]).toHaveLength(5);
      expect(supportersLog[1].rowCount).toBe(5);
    });
  });

  describe("Query Pattern Analysis", () => {
    it("should verify DISTINCT clause prevents duplicates in main query", async () => {
      const mockResult = [
        { id: "wish-1", name: "Test", wish: "Test wish", created_at: new Date(), user_id: 1, support_count: 0, is_supported_by_viewer: false }
      ];

      mockQueryExecutor.raw.mockResolvedValue({ rows: mockResult });

      await repository.findLatestWithSupportStatus(10, 0);

      // Check that the main query includes DISTINCT
      const queryLog = loggerSpy.mock.calls.find(call => 
        call[0].includes('Executing optimized main query')
      );
      
      expect(queryLog[1].query).toContain('SELECT DISTINCT');
      expect(queryLog[1].query).toContain('ORDER BY w.created_at DESC, w.id');
    });

    it("should handle edge case where no main results are found", async () => {
      mockQueryExecutor.raw.mockResolvedValueOnce({ rows: [] });

      const result = await repository.findLatestWithSupportStatus(10, 0);

      expect(result).toHaveLength(0);
      
      // Should not execute subsequent queries
      expect(mockQueryExecutor.raw).toHaveBeenCalledTimes(1);
    });
  });
});