import { AuthenticationError, AuthenticationException } from "../../../src/ports/AuthenticationPort";

describe("AuthenticationPort", () => {
  describe("AuthenticationException", () => {
    it("should create exception with error type and message", () => {
      const exception = new AuthenticationException(
        AuthenticationError.INVALID_PROFILE,
        "Invalid Google profile"
      );

      expect(exception.errorType).toBe(AuthenticationError.INVALID_PROFILE);
      expect(exception.message).toBe("Invalid Google profile");
      expect(exception.name).toBe("AuthenticationException");
      expect(exception.cause).toBeUndefined();
    });

    it("should create exception with cause", () => {
      const cause = new Error("Original error");
      const exception = new AuthenticationException(
        AuthenticationError.REPOSITORY_ERROR,
        "Repository failed",
        cause
      );

      expect(exception.errorType).toBe(AuthenticationError.REPOSITORY_ERROR);
      expect(exception.message).toBe("Repository failed");
      expect(exception.cause).toBe(cause);
    });
  });

  describe("AuthenticationError enum", () => {
    it("should have all expected error types", () => {
      expect(AuthenticationError.INVALID_PROFILE).toBe("INVALID_PROFILE");
      expect(AuthenticationError.USER_NOT_FOUND).toBe("USER_NOT_FOUND");
      expect(AuthenticationError.SERIALIZATION_ERROR).toBe("SERIALIZATION_ERROR");
      expect(AuthenticationError.REPOSITORY_ERROR).toBe("REPOSITORY_ERROR");
    });
  });
});