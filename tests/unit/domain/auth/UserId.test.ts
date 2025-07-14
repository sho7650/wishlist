import { UserId } from "../../../../src/domain/auth/UserId";

describe("UserId", () => {
  describe("constructor", () => {
    it("should create UserId with valid numeric string", () => {
      const userId = new UserId("123");
      expect(userId.value).toBe("123");
    });

    it("should create UserId with valid UUID string", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const userId = new UserId(uuid);
      expect(userId.value).toBe(uuid);
    });

    it("should throw error for empty string", () => {
      expect(() => new UserId("")).toThrow("UserId cannot be empty");
    });

    it("should throw error for null", () => {
      expect(() => new UserId(null as any)).toThrow("UserId cannot be empty");
    });

    it("should throw error for undefined", () => {
      expect(() => new UserId(undefined as any)).toThrow("UserId cannot be empty");
    });

    it("should throw error for whitespace only", () => {
      expect(() => new UserId("   ")).toThrow("UserId cannot be empty");
    });
  });

  describe("equals", () => {
    it("should return true for same value", () => {
      const userId1 = new UserId("123");
      const userId2 = new UserId("123");
      expect(userId1.equals(userId2)).toBe(true);
    });

    it("should return false for different values", () => {
      const userId1 = new UserId("123");
      const userId2 = new UserId("456");
      expect(userId1.equals(userId2)).toBe(false);
    });

    it("should return false when comparing with null", () => {
      const userId = new UserId("123");
      expect(userId.equals(null as any)).toBe(false);
    });

    it("should return false when comparing with undefined", () => {
      const userId = new UserId("123");
      expect(userId.equals(undefined as any)).toBe(false);
    });
  });

  describe("toString", () => {
    it("should return string representation", () => {
      const userId = new UserId("123");
      expect(userId.toString()).toBe("123");
    });
  });

  describe("static factory methods", () => {
    it("should create from number", () => {
      const userId = UserId.fromNumber(123);
      expect(userId.value).toBe("123");
    });

    it("should throw error for negative number", () => {
      expect(() => UserId.fromNumber(-1)).toThrow("UserId number must be positive");
    });

    it("should throw error for zero", () => {
      expect(() => UserId.fromNumber(0)).toThrow("UserId number must be positive");
    });

    it("should throw error for non-integer", () => {
      expect(() => UserId.fromNumber(1.5)).toThrow("UserId number must be an integer");
    });
  });
});