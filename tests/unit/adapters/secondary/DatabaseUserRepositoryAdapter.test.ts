import { DatabaseUserRepositoryAdapter } from "../../../../src/adapters/secondary/DatabaseUserRepositoryAdapter";
import { UserRepositoryError, UserRepositoryException } from "../../../../src/ports/UserRepositoryPort";
import { User } from "../../../../src/domain/auth/User";
import { UserId } from "../../../../src/domain/auth/UserId";
import { QueryExecutor } from "../../../../src/infrastructure/db/query/QueryExecutor";
import { DatabaseResult } from "../../../../src/infrastructure/db/DatabaseConnection";

describe("DatabaseUserRepositoryAdapter", () => {
  let repository: DatabaseUserRepositoryAdapter;
  let mockQueryExecutor: jest.Mocked<QueryExecutor>;

  beforeEach(() => {
    mockQueryExecutor = {
      select: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      upsert: jest.fn(),
      selectWithJoin: jest.fn(),
      incrementSupportCount: jest.fn(),
      decrementSupportCount: jest.fn(),
      updateSupportCount: jest.fn(),
      raw: jest.fn()
    };

    repository = new DatabaseUserRepositoryAdapter(mockQueryExecutor);
  });

  describe("findByGoogleId", () => {
    it("should return user when found", async () => {
      const mockResult: DatabaseResult = {
        rows: [{
          id: "1",
          google_id: "google123",
          display_name: "Test User",
          email: "test@example.com",
          picture: "http://example.com/photo.jpg"
        }],
        rowCount: 1
      };

      mockQueryExecutor.select.mockResolvedValue(mockResult);

      const result = await repository.findByGoogleId("google123");

      expect(mockQueryExecutor.select).toHaveBeenCalledWith("users", {
        where: { google_id: "google123" }
      });
      expect(result).toBeInstanceOf(User);
      expect(result?.googleId).toBe("google123");
      expect(result?.displayName).toBe("Test User");
    });

    it("should return null when not found", async () => {
      const mockResult: DatabaseResult = {
        rows: [],
        rowCount: 0
      };

      mockQueryExecutor.select.mockResolvedValue(mockResult);

      const result = await repository.findByGoogleId("nonexistent");
      expect(result).toBeNull();
    });

    it("should throw UserRepositoryException on database error", async () => {
      mockQueryExecutor.select.mockRejectedValue(new Error("Database error"));

      await expect(repository.findByGoogleId("google123"))
        .rejects.toThrow(UserRepositoryException);
    });
  });

  describe("findById", () => {
    it("should return user when found", async () => {
      const userId = new UserId("1");
      const mockResult: DatabaseResult = {
        rows: [{
          id: "1",
          google_id: "google123",
          display_name: "Test User",
          email: "test@example.com",
          picture: "http://example.com/photo.jpg"
        }],
        rowCount: 1
      };

      mockQueryExecutor.select.mockResolvedValue(mockResult);

      const result = await repository.findById(userId);

      expect(mockQueryExecutor.select).toHaveBeenCalledWith("users", {
        where: { id: "1" }
      });
      expect(result).toBeInstanceOf(User);
      expect(result?.id.value).toBe("1");
    });

    it("should return null when not found", async () => {
      const userId = new UserId("999");
      const mockResult: DatabaseResult = {
        rows: [],
        rowCount: 0
      };

      mockQueryExecutor.select.mockResolvedValue(mockResult);

      const result = await repository.findById(userId);
      expect(result).toBeNull();
    });
  });

  describe("save", () => {
    it("should save new user and return with persisted ID", async () => {
      const newUser = User.createFromGoogle({
        id: "google123",
        displayName: "New User",
        emails: [{ value: "new@example.com" }],
        photos: [{ value: "http://example.com/photo.jpg" }]
      });

      const mockInsertResult: DatabaseResult = {
        rows: [{
          id: "2",
          google_id: "google123",
          display_name: "New User",
          email: "new@example.com",
          picture: "http://example.com/photo.jpg"
        }],
        rowCount: 1
      };

      mockQueryExecutor.insert.mockResolvedValue(mockInsertResult);

      const result = await repository.save(newUser);

      expect(mockQueryExecutor.insert).toHaveBeenCalledWith("users", {
        google_id: "google123",
        display_name: "New User",
        email: "new@example.com",
        picture: "http://example.com/photo.jpg"
      });
      expect(result).toBeInstanceOf(User);
      expect(result.id.value).toBe("2");
      expect(result.isNewUser()).toBe(false);
    });

    it("should throw exception when saving existing user", async () => {
      const existingUser = new User(
        new UserId("1"),
        "google123",
        "Existing User"
      );

      await expect(repository.save(existingUser))
        .rejects.toThrow(UserRepositoryException);
    });

    it("should handle duplicate Google ID error", async () => {
      const newUser = User.createFromGoogle({
        id: "google123",
        displayName: "New User"
      });

      mockQueryExecutor.insert.mockRejectedValue(new Error("UNIQUE constraint failed"));

      await expect(repository.save(newUser))
        .rejects.toThrow(UserRepositoryException);
      
      const thrownError = await repository.save(newUser).catch(e => e);
      expect(thrownError.errorType).toBe(UserRepositoryError.DUPLICATE_GOOGLE_ID);
    });
  });

  describe("update", () => {
    it("should update existing user", async () => {
      const existingUser = new User(
        new UserId("1"),
        "google123",
        "Updated User",
        "updated@example.com",
        "http://example.com/new-photo.jpg"
      );

      const mockUpdateResult: DatabaseResult = {
        rows: [{
          id: "1",
          google_id: "google123",
          display_name: "Updated User",
          email: "updated@example.com",
          picture: "http://example.com/new-photo.jpg"
        }],
        rowCount: 1
      };

      mockQueryExecutor.update.mockResolvedValue(mockUpdateResult);
      
      // Mock the findById call that happens at the end of update
      const mockFindByIdResult: DatabaseResult = {
        rows: [{
          id: "1",
          google_id: "google123",
          display_name: "Updated User",
          email: "updated@example.com",
          picture: "http://example.com/new-photo.jpg"
        }],
        rowCount: 1
      };
      mockQueryExecutor.select.mockResolvedValue(mockFindByIdResult);

      const result = await repository.update(existingUser);

      expect(mockQueryExecutor.update).toHaveBeenCalledWith(
        "users",
        {
          display_name: "Updated User",
          email: "updated@example.com",
          picture: "http://example.com/new-photo.jpg"
        },
        { id: "1" }
      );
      expect(result).toBeInstanceOf(User);
      expect(result.displayName).toBe("Updated User");
    });

    it("should throw exception when user not found", async () => {
      const nonExistentUser = new User(
        new UserId("999"),
        "google999",
        "Non Existent"
      );

      mockQueryExecutor.update.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      await expect(repository.update(nonExistentUser))
        .rejects.toThrow(UserRepositoryException);
    });
  });

  describe("delete", () => {
    it("should delete existing user", async () => {
      const userId = new UserId("1");
      
      mockQueryExecutor.delete.mockResolvedValue({
        rows: [],
        rowCount: 1
      });

      const result = await repository.delete(userId);

      expect(mockQueryExecutor.delete).toHaveBeenCalledWith("users", {
        id: "1"
      });
      expect(result).toBe(true);
    });

    it("should return false when user not found", async () => {
      const userId = new UserId("999");
      
      mockQueryExecutor.delete.mockResolvedValue({
        rows: [],
        rowCount: 0
      });

      const result = await repository.delete(userId);
      expect(result).toBe(false);
    });
  });

  describe("existsByGoogleId", () => {
    it("should return true when user exists", async () => {
      mockQueryExecutor.raw.mockResolvedValue({
        rows: [{ count: 1 }],
        rowCount: 1
      });

      const result = await repository.existsByGoogleId("google123");

      expect(mockQueryExecutor.raw).toHaveBeenCalledWith(
        "SELECT COUNT(*) as count FROM users WHERE google_id = ?",
        ["google123"]
      );
      expect(result).toBe(true);
    });

    it("should return false when user does not exist", async () => {
      mockQueryExecutor.raw.mockResolvedValue({
        rows: [{ count: 0 }],
        rowCount: 1
      });

      const result = await repository.existsByGoogleId("nonexistent");
      expect(result).toBe(false);
    });
  });

  describe("count", () => {
    it("should return total user count", async () => {
      mockQueryExecutor.raw.mockResolvedValue({
        rows: [{ count: 42 }],
        rowCount: 1
      });

      const result = await repository.count();

      expect(mockQueryExecutor.raw).toHaveBeenCalledWith(
        "SELECT COUNT(*) as count FROM users",
        []
      );
      expect(result).toBe(42);
    });
  });

  describe("error handling", () => {
    it("should map database constraint errors appropriately", async () => {
      const newUser = User.createFromGoogle({
        id: "google123",
        displayName: "New User"
      });

      // Test various database error scenarios
      const testCases = [
        {
          dbError: new Error("UNIQUE constraint failed: users.google_id"),
          expectedType: UserRepositoryError.DUPLICATE_GOOGLE_ID
        },
        {
          dbError: new Error("Connection timeout"),
          expectedType: UserRepositoryError.DATABASE_ERROR
        }
      ];

      for (const testCase of testCases) {
        mockQueryExecutor.insert.mockRejectedValue(testCase.dbError);
        
        const thrownError = await repository.save(newUser).catch(e => e);
        expect(thrownError).toBeInstanceOf(UserRepositoryException);
        expect(thrownError.errorType).toBe(testCase.expectedType);
      }
    });
  });
});