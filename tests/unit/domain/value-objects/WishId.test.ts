import { WishId } from "../../../../src/domain/value-objects/WishId";

describe("WishId", () => {
  describe("constructor", () => {
    it("should create WishId with valid value", () => {
      const wishId = new WishId("wish-123");
      
      expect(wishId.value).toBe("wish-123");
    });

    it("should create WishId with UUID format", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const wishId = new WishId(uuid);
      
      expect(wishId.value).toBe(uuid);
    });

    it("should create WishId with alphanumeric value", () => {
      const wishId = new WishId("abc123XYZ");
      
      expect(wishId.value).toBe("abc123XYZ");
    });

    it("should create WishId with special characters", () => {
      const wishId = new WishId("wish_123-456.789");
      
      expect(wishId.value).toBe("wish_123-456.789");
    });

    it("should throw error for empty string", () => {
      expect(() => new WishId("")).toThrow("WishId cannot be empty");
    });

    it("should throw error for null", () => {
      expect(() => new WishId(null as any)).toThrow("WishId cannot be empty");
    });

    it("should throw error for undefined", () => {
      expect(() => new WishId(undefined as any)).toThrow("WishId cannot be empty");
    });

    it("should throw error for whitespace only", () => {
      expect(() => new WishId("   ")).toThrow("WishId cannot be empty");
    });

    it("should throw error for tab and newline only", () => {
      expect(() => new WishId("\t\n\r")).toThrow("WishId cannot be empty");
    });

    it("should accept single character", () => {
      const wishId = new WishId("A");
      
      expect(wishId.value).toBe("A");
    });

    it("should accept long string", () => {
      const longId = "a".repeat(1000);
      const wishId = new WishId(longId);
      
      expect(wishId.value).toBe(longId);
    });

    it("should accept string with leading/trailing spaces", () => {
      const wishId = new WishId(" wish-id-with-spaces ");
      
      expect(wishId.value).toBe(" wish-id-with-spaces ");
    });
  });

  describe("generate", () => {
    it("should generate unique WishId", () => {
      const wishId1 = WishId.generate();
      const wishId2 = WishId.generate();
      
      expect(wishId1.value).toBeDefined();
      expect(wishId2.value).toBeDefined();
      expect(wishId1.value).not.toBe(wishId2.value);
    });

    it("should generate valid UUID format", () => {
      const wishId = WishId.generate();
      
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(wishId.value).toMatch(uuidRegex);
    });

    it("should generate multiple unique values", () => {
      const wishIds = [];
      for (let i = 0; i < 10; i++) {
        wishIds.push(WishId.generate().value);
      }
      
      const uniqueIds = new Set(wishIds);
      expect(uniqueIds.size).toBe(10); // All should be unique
    });

    it("should generate WishId instances", () => {
      const wishId = WishId.generate();
      
      expect(wishId).toBeInstanceOf(WishId);
      expect(typeof wishId.value).toBe("string");
    });

    it("should generate different values in rapid succession", () => {
      const ids = [];
      for (let i = 0; i < 100; i++) {
        ids.push(WishId.generate().value);
      }
      
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(100);
    });
  });

  describe("fromString", () => {
    it("should create WishId from string", () => {
      const wishId = WishId.fromString("test-wish-id");
      
      expect(wishId.value).toBe("test-wish-id");
    });

    it("should create WishId from UUID string", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      const wishId = WishId.fromString(uuid);
      
      expect(wishId.value).toBe(uuid);
    });

    it("should throw error for empty string", () => {
      expect(() => WishId.fromString("")).toThrow("WishId cannot be empty");
    });

    it("should throw error for whitespace", () => {
      expect(() => WishId.fromString("  \t  ")).toThrow("WishId cannot be empty");
    });

    it("should accept complex string values", () => {
      const complexId = "wish_123-456.789@domain.com";
      const wishId = WishId.fromString(complexId);
      
      expect(wishId.value).toBe(complexId);
    });

    it("should accept numeric string", () => {
      const wishId = WishId.fromString("123456789");
      
      expect(wishId.value).toBe("123456789");
    });

    it("should accept string with spaces", () => {
      const wishId = WishId.fromString("wish id with spaces");
      
      expect(wishId.value).toBe("wish id with spaces");
    });
  });

  describe("value getter", () => {
    it("should return the internal value", () => {
      const wishId = new WishId("my-wish-id");
      
      expect(wishId.value).toBe("my-wish-id");
    });

    it("should return immutable value", () => {
      const wishId = new WishId("original-value");
      const originalValue = wishId.value;
      
      expect(wishId.value).toBe(originalValue);
      expect(wishId.value).toBe("original-value");
    });

    it("should preserve exact input including spaces", () => {
      const wishId = new WishId(" spaced-id ");
      
      expect(wishId.value).toBe(" spaced-id ");
    });
  });

  describe("equals", () => {
    it("should return true for same values", () => {
      const wishId1 = new WishId("same-wish-id");
      const wishId2 = new WishId("same-wish-id");
      
      expect(wishId1.equals(wishId2)).toBe(true);
      expect(wishId2.equals(wishId1)).toBe(true);
    });

    it("should return false for different values", () => {
      const wishId1 = new WishId("wish-id-1");
      const wishId2 = new WishId("wish-id-2");
      
      expect(wishId1.equals(wishId2)).toBe(false);
      expect(wishId2.equals(wishId1)).toBe(false);
    });

    it("should return true for same instance", () => {
      const wishId = new WishId("self-comparison");
      
      expect(wishId.equals(wishId)).toBe(true);
    });

    it("should be case sensitive", () => {
      const wishId1 = new WishId("wish-id");
      const wishId2 = new WishId("WISH-ID");
      
      expect(wishId1.equals(wishId2)).toBe(false);
    });

    it("should handle special characters", () => {
      const wishId1 = new WishId("wish_123-abc.def");
      const wishId2 = new WishId("wish_123-abc.def");
      const wishId3 = new WishId("wish_123-abc.xyz");
      
      expect(wishId1.equals(wishId2)).toBe(true);
      expect(wishId1.equals(wishId3)).toBe(false);
    });

    it("should handle UUIDs", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const wishId1 = new WishId(uuid);
      const wishId2 = new WishId(uuid);
      const wishId3 = new WishId("550e8400-e29b-41d4-a716-446655440001");
      
      expect(wishId1.equals(wishId2)).toBe(true);
      expect(wishId1.equals(wishId3)).toBe(false);
    });

    it("should handle spaces correctly", () => {
      const wishId1 = new WishId("wish id");
      const wishId2 = new WishId("wish id");
      const wishId3 = new WishId("wishid");
      
      expect(wishId1.equals(wishId2)).toBe(true);
      expect(wishId1.equals(wishId3)).toBe(false);
    });
  });

  describe("toString", () => {
    it("should return string representation", () => {
      const wishId = new WishId("test-wish");
      
      expect(wishId.toString()).toBe("test-wish");
    });

    it("should return same value as value getter", () => {
      const wishId = new WishId("another-wish");
      
      expect(wishId.toString()).toBe(wishId.value);
    });

    it("should handle complex string values", () => {
      const complexValue = "wish_123-456.789@domain.com";
      const wishId = new WishId(complexValue);
      
      expect(wishId.toString()).toBe(complexValue);
    });

    it("should handle UUID values", () => {
      const uuid = "123e4567-e89b-12d3-a456-426614174000";
      const wishId = new WishId(uuid);
      
      expect(wishId.toString()).toBe(uuid);
    });

    it("should preserve spaces", () => {
      const wishId = new WishId("wish with spaces");
      
      expect(wishId.toString()).toBe("wish with spaces");
    });
  });

  describe("immutability", () => {
    it("should provide consistent value through getter", () => {
      const wishId = new WishId("immutable-wish-id");
      const originalValue = wishId.value;
      
      // Value should be consistent when accessed multiple times
      expect(wishId.value).toBe(originalValue);
      expect(wishId.value).toBe("immutable-wish-id");
    });

    it("should not affect other instances", () => {
      const wishId1 = new WishId("wish-1");
      const wishId2 = new WishId("wish-2");
      
      expect(wishId1.value).toBe("wish-1");
      expect(wishId2.value).toBe("wish-2");
      
      // Values should remain independent
      expect(wishId1.value).toBe("wish-1");
      expect(wishId2.value).toBe("wish-2");
    });
  });

  describe("edge cases", () => {
    it("should handle very long strings", () => {
      const longId = "a".repeat(10000);
      const wishId = new WishId(longId);
      
      expect(wishId.value).toBe(longId);
      expect(wishId.toString()).toBe(longId);
    });

    it("should handle single character", () => {
      const wishId = new WishId("x");
      
      expect(wishId.value).toBe("x");
      expect(wishId.toString()).toBe("x");
    });

    it("should handle numeric strings", () => {
      const wishId = new WishId("123456789");
      
      expect(wishId.value).toBe("123456789");
      expect(typeof wishId.value).toBe("string");
    });

    it("should handle special Unicode characters", () => {
      const wishId = new WishId("願い-123-🌟");
      
      expect(wishId.value).toBe("願い-123-🌟");
    });

    it("should handle mixed character sets", () => {
      const mixedId = "英語123ひらがなカタカナ한글العربية🌟";
      const wishId = new WishId(mixedId);
      
      expect(wishId.value).toBe(mixedId);
    });
  });

  describe("integration with factory methods", () => {
    it("should create equivalent instances from constructor and fromString", () => {
      const value = "integration-test-id";
      const wishId1 = new WishId(value);
      const wishId2 = WishId.fromString(value);
      
      expect(wishId1.equals(wishId2)).toBe(true);
      expect(wishId1.value).toBe(wishId2.value);
      expect(wishId1.toString()).toBe(wishId2.toString());
    });

    it("should generate different instances from generate method", () => {
      const generatedWishId = WishId.generate();
      const fromStringWishId = WishId.fromString(generatedWishId.value);
      
      expect(generatedWishId.equals(fromStringWishId)).toBe(true);
      expect(generatedWishId.value).toBe(fromStringWishId.value);
    });
  });
});