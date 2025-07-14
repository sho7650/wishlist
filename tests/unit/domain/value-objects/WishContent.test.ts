import { WishContent } from "../../../../src/domain/value-objects/WishContent";

describe("WishContent", () => {
  describe("constants", () => {
    it("should have correct MIN_LENGTH", () => {
      expect(WishContent.MIN_LENGTH).toBe(1);
    });

    it("should have correct MAX_LENGTH", () => {
      expect(WishContent.MAX_LENGTH).toBe(240);
    });
  });

  describe("constructor", () => {
    it("should create WishContent with valid content", () => {
      const content = "This is a valid wish content";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should create WishContent with minimum length", () => {
      const content = "A";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should create WishContent with maximum length", () => {
      const content = "A".repeat(240);
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should trim whitespace from content", () => {
      const content = "  Valid content with spaces  ";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe("Valid content with spaces");
    });

    it("should handle Japanese characters", () => {
      const content = "世界平和を願います";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should handle emojis", () => {
      const content = "I wish for happiness 😊🌟";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should handle special characters", () => {
      const content = "Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should throw error for empty string", () => {
      expect(() => new WishContent("")).toThrow(
        "Wish content must have at least 1 character"
      );
    });

    it("should throw error for null", () => {
      expect(() => new WishContent(null as any)).toThrow(
        "Wish content must have at least 1 character"
      );
    });

    it("should throw error for undefined", () => {
      expect(() => new WishContent(undefined as any)).toThrow(
        "Wish content must have at least 1 character"
      );
    });

    it("should throw error for whitespace only", () => {
      expect(() => new WishContent("   ")).toThrow(
        "Wish content must have at least 1 character"
      );
    });

    it("should throw error for content too long", () => {
      const content = "A".repeat(241);
      expect(() => new WishContent(content)).toThrow(
        "Wish content cannot be longer than 240 characters"
      );
    });

    it("should throw error for very long content", () => {
      const content = "A".repeat(1000);
      expect(() => new WishContent(content)).toThrow(
        "Wish content cannot be longer than 240 characters"
      );
    });

    it("should handle content with newlines", () => {
      const content = "Line 1\nLine 2\nLine 3";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should handle content with tabs", () => {
      const content = "Content\twith\ttabs";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should trim but preserve internal whitespace", () => {
      const content = "  Content with  internal  spaces  ";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe("Content with  internal  spaces");
    });
  });

  describe("fromString", () => {
    it("should create WishContent from string", () => {
      const content = "Created from string method";
      const wishContent = WishContent.fromString(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should create WishContent with minimum length", () => {
      const content = "X";
      const wishContent = WishContent.fromString(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should throw error for empty string", () => {
      expect(() => WishContent.fromString("")).toThrow(
        "Wish content must have at least 1 character"
      );
    });

    it("should throw error for content too long", () => {
      const content = "A".repeat(241);
      expect(() => WishContent.fromString(content)).toThrow(
        "Wish content cannot be longer than 240 characters"
      );
    });

    it("should trim whitespace", () => {
      const content = "  Trimmed content  ";
      const wishContent = WishContent.fromString(content);
      
      expect(wishContent.value).toBe("Trimmed content");
    });
  });

  describe("value getter", () => {
    it("should return the internal value", () => {
      const content = "Test content for getter";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe(content);
    });

    it("should return trimmed value", () => {
      const content = "  Content with spaces  ";
      const wishContent = new WishContent(content);
      
      expect(wishContent.value).toBe("Content with spaces");
    });
  });

  describe("equals", () => {
    it("should return true for same values", () => {
      const content = "Same content";
      const wishContent1 = new WishContent(content);
      const wishContent2 = new WishContent(content);
      
      expect(wishContent1.equals(wishContent2)).toBe(true);
      expect(wishContent2.equals(wishContent1)).toBe(true);
    });

    it("should return false for different values", () => {
      const wishContent1 = new WishContent("Content 1");
      const wishContent2 = new WishContent("Content 2");
      
      expect(wishContent1.equals(wishContent2)).toBe(false);
      expect(wishContent2.equals(wishContent1)).toBe(false);
    });

    it("should return true for same instance", () => {
      const wishContent = new WishContent("Self comparison");
      
      expect(wishContent.equals(wishContent)).toBe(true);
    });

    it("should be case sensitive", () => {
      const wishContent1 = new WishContent("case sensitive");
      const wishContent2 = new WishContent("CASE SENSITIVE");
      
      expect(wishContent1.equals(wishContent2)).toBe(false);
    });

    it("should handle trimmed values correctly", () => {
      const wishContent1 = new WishContent("  trimmed content  ");
      const wishContent2 = new WishContent("trimmed content");
      
      expect(wishContent1.equals(wishContent2)).toBe(true);
    });

    it("should handle special characters", () => {
      const content = "Special: !@#$%^&*()";
      const wishContent1 = new WishContent(content);
      const wishContent2 = new WishContent(content);
      
      expect(wishContent1.equals(wishContent2)).toBe(true);
    });

    it("should handle Japanese characters", () => {
      const content = "日本語のコンテンツ";
      const wishContent1 = new WishContent(content);
      const wishContent2 = new WishContent(content);
      
      expect(wishContent1.equals(wishContent2)).toBe(true);
    });
  });

  describe("toString", () => {
    it("should return string representation", () => {
      const content = "String representation test";
      const wishContent = new WishContent(content);
      
      expect(wishContent.toString()).toBe(content);
    });

    it("should return same value as value getter", () => {
      const content = "Consistency test";
      const wishContent = new WishContent(content);
      
      expect(wishContent.toString()).toBe(wishContent.value);
    });

    it("should return trimmed value", () => {
      const content = "  Trimmed string  ";
      const wishContent = new WishContent(content);
      
      expect(wishContent.toString()).toBe("Trimmed string");
    });

    it("should handle empty result after trimming", () => {
      // This case should not happen due to constructor validation,
      // but let's test the toString method behavior
      const content = "A"; // Valid content
      const wishContent = new WishContent(content);
      
      expect(wishContent.toString()).toBe("A");
    });

    it("should handle special characters", () => {
      const content = "Special: \n\t!@#$%";
      const wishContent = new WishContent(content);
      
      expect(wishContent.toString()).toBe(content);
    });
  });

  describe("immutability", () => {
    it("should provide consistent value through getter", () => {
      const content = "Immutable content";
      const wishContent = new WishContent(content);
      const originalValue = wishContent.value;
      
      // Value should be consistent when accessed multiple times
      expect(wishContent.value).toBe(originalValue);
      expect(wishContent.value).toBe(content);
    });

    it("should not affect other instances", () => {
      const wishContent1 = new WishContent("Content 1");
      const wishContent2 = new WishContent("Content 2");
      
      expect(wishContent1.value).toBe("Content 1");
      expect(wishContent2.value).toBe("Content 2");
      
      // Values should remain independent
      expect(wishContent1.value).toBe("Content 1");
      expect(wishContent2.value).toBe("Content 2");
    });
  });

  describe("edge cases", () => {
    it("should handle exact boundary lengths", () => {
      // Test exactly at MIN_LENGTH (1 character)
      const minContent = "A";
      const minWishContent = new WishContent(minContent);
      expect(minWishContent.value).toBe(minContent);
      
      // Test exactly at MAX_LENGTH (240 characters)
      const maxContent = "B".repeat(240);
      const maxWishContent = new WishContent(maxContent);
      expect(maxWishContent.value).toBe(maxContent);
    });

    it("should handle one character over limit", () => {
      const overLimitContent = "C".repeat(241);
      expect(() => new WishContent(overLimitContent)).toThrow(
        "Wish content cannot be longer than 240 characters"
      );
    });

    it("should handle content with only spaces that becomes empty after trim", () => {
      const spacesOnly = " ".repeat(10);
      expect(() => new WishContent(spacesOnly)).toThrow(
        "Wish content must have at least 1 character"
      );
    });

    it("should handle content with mixed whitespace", () => {
      const mixedWhitespace = "\t\n  \r\n  ";
      expect(() => new WishContent(mixedWhitespace)).toThrow(
        "Wish content must have at least 1 character"
      );
    });
  });

  describe("integration with factory method", () => {
    it("should create equivalent instances from constructor and factory", () => {
      const content = "Factory method test";
      const wishContent1 = new WishContent(content);
      const wishContent2 = WishContent.fromString(content);
      
      expect(wishContent1.equals(wishContent2)).toBe(true);
      expect(wishContent1.value).toBe(wishContent2.value);
      expect(wishContent1.toString()).toBe(wishContent2.toString());
    });

    it("should handle trimming consistently", () => {
      const content = "  Consistent trimming  ";
      const wishContent1 = new WishContent(content);
      const wishContent2 = WishContent.fromString(content);
      
      expect(wishContent1.equals(wishContent2)).toBe(true);
      expect(wishContent1.value).toBe("Consistent trimming");
      expect(wishContent2.value).toBe("Consistent trimming");
    });
  });
});