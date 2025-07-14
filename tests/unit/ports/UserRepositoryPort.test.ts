import { UserRepositoryError, UserRepositoryException } from "../../../src/ports/UserRepositoryPort";

describe("UserRepositoryPort", () => {
  describe("UserRepositoryException", () => {
    it("should create exception with error type and message", () => {
      const exception = new UserRepositoryException(
        UserRepositoryError.USER_NOT_FOUND,
        "User not found"
      );

      expect(exception.errorType).toBe(UserRepositoryError.USER_NOT_FOUND);
      expect(exception.message).toBe("User not found");
      expect(exception.name).toBe("UserRepositoryException");
      expect(exception.cause).toBeUndefined();
    });

    it("should create exception with cause", () => {
      const cause = new Error("Database connection failed");
      const exception = new UserRepositoryException(
        UserRepositoryError.DATABASE_ERROR,
        "Database operation failed",
        cause
      );

      expect(exception.errorType).toBe(UserRepositoryError.DATABASE_ERROR);
      expect(exception.message).toBe("Database operation failed");
      expect(exception.cause).toBe(cause);
    });
  });

  describe("UserRepositoryError enum", () => {
    it("should have all expected error types", () => {
      expect(UserRepositoryError.USER_NOT_FOUND).toBe("USER_NOT_FOUND");
      expect(UserRepositoryError.DUPLICATE_GOOGLE_ID).toBe("DUPLICATE_GOOGLE_ID");
      expect(UserRepositoryError.INVALID_USER_DATA).toBe("INVALID_USER_DATA");
      expect(UserRepositoryError.DATABASE_ERROR).toBe("DATABASE_ERROR");
    });
  });
});