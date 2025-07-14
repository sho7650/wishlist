import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";

describe("SupportCount", () => {
  describe("constructor", () => {
    it("should create SupportCount with valid positive value", () => {
      const supportCount = new SupportCount(5);
      
      expect(supportCount.value).toBe(5);
    });

    it("should create SupportCount with zero", () => {
      const supportCount = new SupportCount(0);
      
      expect(supportCount.value).toBe(0);
    });

    it("should throw error for negative value", () => {
      expect(() => new SupportCount(-1)).toThrow("SupportCount cannot be negative");
    });

    it("should throw error for large negative value", () => {
      expect(() => new SupportCount(-100)).toThrow("SupportCount cannot be negative");
    });

    it("should accept large positive values", () => {
      const supportCount = new SupportCount(999999);
      
      expect(supportCount.value).toBe(999999);
    });

    it("should handle floating point numbers by using them as-is", () => {
      const supportCount = new SupportCount(5.7);
      
      expect(supportCount.value).toBe(5.7);
    });
  });

  describe("zero", () => {
    it("should create SupportCount with zero value", () => {
      const supportCount = SupportCount.zero();
      
      expect(supportCount.value).toBe(0);
    });

    it("should return new instance each time", () => {
      const supportCount1 = SupportCount.zero();
      const supportCount2 = SupportCount.zero();
      
      expect(supportCount1).not.toBe(supportCount2); // Different instances
      expect(supportCount1.equals(supportCount2)).toBe(true); // Same value
    });
  });

  describe("fromNumber", () => {
    it("should create SupportCount from positive number", () => {
      const supportCount = SupportCount.fromNumber(10);
      
      expect(supportCount.value).toBe(10);
    });

    it("should create SupportCount from zero", () => {
      const supportCount = SupportCount.fromNumber(0);
      
      expect(supportCount.value).toBe(0);
    });

    it("should throw error for negative number", () => {
      expect(() => SupportCount.fromNumber(-5)).toThrow("SupportCount cannot be negative");
    });

    it("should handle floating point numbers", () => {
      const supportCount = SupportCount.fromNumber(3.14);
      
      expect(supportCount.value).toBe(3.14);
    });
  });

  describe("increment", () => {
    it("should increment by one", () => {
      const supportCount = new SupportCount(5);
      const incremented = supportCount.increment();
      
      expect(incremented.value).toBe(6);
      expect(supportCount.value).toBe(5); // Original unchanged
    });

    it("should increment zero", () => {
      const supportCount = SupportCount.zero();
      const incremented = supportCount.increment();
      
      expect(incremented.value).toBe(1);
    });

    it("should return new instance", () => {
      const supportCount = new SupportCount(3);
      const incremented = supportCount.increment();
      
      expect(incremented).not.toBe(supportCount);
    });

    it("should handle large numbers", () => {
      const supportCount = new SupportCount(999998);
      const incremented = supportCount.increment();
      
      expect(incremented.value).toBe(999999);
    });

    it("should increment floating point numbers", () => {
      const supportCount = new SupportCount(2.5);
      const incremented = supportCount.increment();
      
      expect(incremented.value).toBe(3.5);
    });
  });

  describe("decrement", () => {
    it("should decrement by one", () => {
      const supportCount = new SupportCount(5);
      const decremented = supportCount.decrement();
      
      expect(decremented.value).toBe(4);
      expect(supportCount.value).toBe(5); // Original unchanged
    });

    it("should throw error when decrementing zero", () => {
      const supportCount = SupportCount.zero();
      
      expect(() => supportCount.decrement()).toThrow("Cannot decrement SupportCount below zero");
    });

    it("should return new instance", () => {
      const supportCount = new SupportCount(3);
      const decremented = supportCount.decrement();
      
      expect(decremented).not.toBe(supportCount);
    });

    it("should decrement to zero", () => {
      const supportCount = new SupportCount(1);
      const decremented = supportCount.decrement();
      
      expect(decremented.value).toBe(0);
    });

    it("should handle large numbers", () => {
      const supportCount = new SupportCount(1000000);
      const decremented = supportCount.decrement();
      
      expect(decremented.value).toBe(999999);
    });

    it("should decrement floating point numbers", () => {
      const supportCount = new SupportCount(3.7);
      const decremented = supportCount.decrement();
      
      expect(decremented.value).toBe(2.7);
    });
  });

  describe("value getter", () => {
    it("should return the internal value", () => {
      const supportCount = new SupportCount(42);
      
      expect(supportCount.value).toBe(42);
    });

    it("should return immutable value", () => {
      const supportCount = new SupportCount(10);
      const originalValue = supportCount.value;
      
      expect(supportCount.value).toBe(originalValue);
    });
  });

  describe("equals", () => {
    it("should return true for same values", () => {
      const supportCount1 = new SupportCount(5);
      const supportCount2 = new SupportCount(5);
      
      expect(supportCount1.equals(supportCount2)).toBe(true);
      expect(supportCount2.equals(supportCount1)).toBe(true);
    });

    it("should return false for different values", () => {
      const supportCount1 = new SupportCount(5);
      const supportCount2 = new SupportCount(10);
      
      expect(supportCount1.equals(supportCount2)).toBe(false);
      expect(supportCount2.equals(supportCount1)).toBe(false);
    });

    it("should return true for zero values", () => {
      const supportCount1 = SupportCount.zero();
      const supportCount2 = new SupportCount(0);
      
      expect(supportCount1.equals(supportCount2)).toBe(true);
    });

    it("should handle floating point comparison", () => {
      const supportCount1 = new SupportCount(3.14);
      const supportCount2 = new SupportCount(3.14);
      const supportCount3 = new SupportCount(3.15);
      
      expect(supportCount1.equals(supportCount2)).toBe(true);
      expect(supportCount1.equals(supportCount3)).toBe(false);
    });
  });

  describe("toString", () => {
    it("should return string representation of number", () => {
      const supportCount = new SupportCount(25);
      
      expect(supportCount.toString()).toBe("25");
    });

    it("should return '0' for zero", () => {
      const supportCount = SupportCount.zero();
      
      expect(supportCount.toString()).toBe("0");
    });

    it("should handle large numbers", () => {
      const supportCount = new SupportCount(1000000);
      
      expect(supportCount.toString()).toBe("1000000");
    });

    it("should handle floating point numbers", () => {
      const supportCount = new SupportCount(3.14159);
      
      expect(supportCount.toString()).toBe("3.14159");
    });
  });

  describe("immutability", () => {
    it("should provide consistent value through getter", () => {
      const supportCount = new SupportCount(100);
      const originalValue = supportCount.value;
      
      // Value should be consistent when accessed multiple times
      expect(supportCount.value).toBe(originalValue);
      expect(supportCount.value).toBe(100);
    });

    it("should create new instances for operations", () => {
      const original = new SupportCount(10);
      const incremented = original.increment();
      const decremented = original.decrement();
      
      expect(original.value).toBe(10);
      expect(incremented.value).toBe(11);
      expect(decremented.value).toBe(9);
      
      expect(original).not.toBe(incremented);
      expect(original).not.toBe(decremented);
      expect(incremented).not.toBe(decremented);
    });
  });

  describe("chaining operations", () => {
    it("should support chaining increment operations", () => {
      const supportCount = SupportCount.zero();
      const result = supportCount.increment().increment().increment();
      
      expect(result.value).toBe(3);
      expect(supportCount.value).toBe(0); // Original unchanged
    });

    it("should support chaining decrement operations", () => {
      const supportCount = new SupportCount(5);
      const result = supportCount.decrement().decrement();
      
      expect(result.value).toBe(3);
      expect(supportCount.value).toBe(5); // Original unchanged
    });

    it("should support mixed increment and decrement operations", () => {
      const supportCount = new SupportCount(10);
      const result = supportCount.increment().increment().decrement();
      
      expect(result.value).toBe(11);
      expect(supportCount.value).toBe(10); // Original unchanged
    });
  });
});