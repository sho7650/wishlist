import { UserId } from "../../../../src/domain/value-objects/UserId";

describe("UserId", () => {
  describe("constructor", () => {
    it("should create UserId with valid positive integer", () => {
      const userId = new UserId(123);
      
      expect(userId.value).toBe(123);
      expect(userId.type).toBe("user");
    });

    it("should create UserId with 1", () => {
      const userId = new UserId(1);
      
      expect(userId.value).toBe(1);
    });

    it("should create UserId with large positive integer", () => {
      const userId = new UserId(999999);
      
      expect(userId.value).toBe(999999);
    });

    it("should throw error for zero", () => {
      expect(() => new UserId(0)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for negative number", () => {
      expect(() => new UserId(-1)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for large negative number", () => {
      expect(() => new UserId(-999)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for floating point number", () => {
      expect(() => new UserId(1.5)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for positive floating point number", () => {
      expect(() => new UserId(3.14)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for negative floating point number", () => {
      expect(() => new UserId(-2.5)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for NaN", () => {
      expect(() => new UserId(NaN)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for Infinity", () => {
      expect(() => new UserId(Infinity)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for negative Infinity", () => {
      expect(() => new UserId(-Infinity)).toThrow("UserId must be a positive integer");
    });
  });

  describe("fromNumber", () => {
    it("should create UserId from positive integer", () => {
      const userId = UserId.fromNumber(456);
      
      expect(userId.value).toBe(456);
      expect(userId.type).toBe("user");
    });

    it("should create UserId from 1", () => {
      const userId = UserId.fromNumber(1);
      
      expect(userId.value).toBe(1);
    });

    it("should throw error for zero", () => {
      expect(() => UserId.fromNumber(0)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for negative number", () => {
      expect(() => UserId.fromNumber(-5)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for floating point number", () => {
      expect(() => UserId.fromNumber(2.7)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for NaN", () => {
      expect(() => UserId.fromNumber(NaN)).toThrow("UserId must be a positive integer");
    });

    it("should throw error for Infinity", () => {
      expect(() => UserId.fromNumber(Infinity)).toThrow("UserId must be a positive integer");
    });
  });

  describe("value getter", () => {
    it("should return the internal value", () => {
      const userId = new UserId(789);
      
      expect(userId.value).toBe(789);
    });

    it("should return immutable value", () => {
      const userId = new UserId(100);
      const originalValue = userId.value;
      
      expect(userId.value).toBe(originalValue);
      expect(userId.value).toBe(100);
    });
  });

  describe("equals", () => {
    it("should return true for same values", () => {
      const userId1 = new UserId(123);
      const userId2 = new UserId(123);
      
      expect(userId1.equals(userId2)).toBe(true);
      expect(userId2.equals(userId1)).toBe(true);
    });

    it("should return false for different values", () => {
      const userId1 = new UserId(123);
      const userId2 = new UserId(456);
      
      expect(userId1.equals(userId2)).toBe(false);
      expect(userId2.equals(userId1)).toBe(false);
    });

    it("should return true for same instance", () => {
      const userId = new UserId(999);
      
      expect(userId.equals(userId)).toBe(true);
    });

    it("should handle large numbers", () => {
      const userId1 = new UserId(1000000);
      const userId2 = new UserId(1000000);
      const userId3 = new UserId(1000001);
      
      expect(userId1.equals(userId2)).toBe(true);
      expect(userId1.equals(userId3)).toBe(false);
    });

    it("should handle small numbers", () => {
      const userId1 = new UserId(1);
      const userId2 = new UserId(1);
      const userId3 = new UserId(2);
      
      expect(userId1.equals(userId2)).toBe(true);
      expect(userId1.equals(userId3)).toBe(false);
    });
  });

  describe("toString", () => {
    it("should return string representation of number", () => {
      const userId = new UserId(123);
      
      expect(userId.toString()).toBe("123");
    });

    it("should return string for small numbers", () => {
      const userId = new UserId(1);
      
      expect(userId.toString()).toBe("1");
    });

    it("should return string for large numbers", () => {
      const userId = new UserId(999999);
      
      expect(userId.toString()).toBe("999999");
    });

    it("should return same value as value getter converted to string", () => {
      const userId = new UserId(456);
      
      expect(userId.toString()).toBe(userId.value.toString());
    });
  });

  describe("type property", () => {
    it("should always be 'user'", () => {
      const userId1 = new UserId(1);
      const userId2 = new UserId(999);
      const userId3 = UserId.fromNumber(123);
      
      expect(userId1.type).toBe("user");
      expect(userId2.type).toBe("user");
      expect(userId3.type).toBe("user");
    });

    it("should be readonly", () => {
      const userId = new UserId(123);
      
      expect(userId.type).toBe("user");
      
      // The type property should remain "user"
      expect(userId.type).toBe("user");
    });
  });

  describe("immutability", () => {
    it("should provide consistent value through getter", () => {
      const userId = new UserId(987);
      const originalValue = userId.value;
      
      // Value should be consistent when accessed multiple times
      expect(userId.value).toBe(originalValue);
      expect(userId.value).toBe(987);
    });

    it("should not affect other instances", () => {
      const userId1 = new UserId(100);
      const userId2 = new UserId(200);
      
      expect(userId1.value).toBe(100);
      expect(userId2.value).toBe(200);
      
      // Values should remain independent
      expect(userId1.value).toBe(100);
      expect(userId2.value).toBe(200);
    });
  });

  describe("edge cases", () => {
    it("should handle maximum safe integer", () => {
      const maxSafeInt = Number.MAX_SAFE_INTEGER;
      const userId = new UserId(maxSafeInt);
      
      expect(userId.value).toBe(maxSafeInt);
      expect(userId.toString()).toBe(maxSafeInt.toString());
    });

    it("should handle Number.MAX_VALUE", () => {
      // Number.MAX_VALUE is a valid positive integer in JavaScript
      const userId = new UserId(Number.MAX_VALUE);
      expect(userId.value).toBe(Number.MAX_VALUE);
    });

    it("should handle very large integers within safe range", () => {
      const largeInt = 9007199254740991; // Number.MAX_SAFE_INTEGER
      const userId = new UserId(largeInt);
      
      expect(userId.value).toBe(largeInt);
    });
  });

  describe("integration with factory method", () => {
    it("should create equivalent instances from constructor and factory", () => {
      const value = 12345;
      const userId1 = new UserId(value);
      const userId2 = UserId.fromNumber(value);
      
      expect(userId1.equals(userId2)).toBe(true);
      expect(userId1.value).toBe(userId2.value);
      expect(userId1.toString()).toBe(userId2.toString());
      expect(userId1.type).toBe(userId2.type);
    });
  });
});