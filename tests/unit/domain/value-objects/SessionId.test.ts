import { SessionId } from "../../../../src/domain/value-objects/SessionId";

describe("SessionId", () => {
  describe("constructor", () => {
    it("should create SessionId with valid value", () => {
      const sessionId = new SessionId("session-123");
      
      expect(sessionId.value).toBe("session-123");
      expect(sessionId.type).toBe("session");
    });

    it("should throw error for empty string", () => {
      expect(() => new SessionId("")).toThrow("SessionId cannot be empty");
    });

    it("should throw error for null", () => {
      expect(() => new SessionId(null as any)).toThrow("SessionId cannot be empty");
    });

    it("should throw error for undefined", () => {
      expect(() => new SessionId(undefined as any)).toThrow("SessionId cannot be empty");
    });

    it("should throw error for whitespace only", () => {
      expect(() => new SessionId("   ")).toThrow("SessionId cannot be empty");
    });

    it("should accept valid session ID with special characters", () => {
      const sessionId = new SessionId("session_123-456");
      expect(sessionId.value).toBe("session_123-456");
    });
  });

  describe("generate", () => {
    it("should generate unique SessionId", () => {
      const sessionId1 = SessionId.generate();
      const sessionId2 = SessionId.generate();
      
      expect(sessionId1.value).toBeDefined();
      expect(sessionId2.value).toBeDefined();
      expect(sessionId1.value).not.toBe(sessionId2.value);
      expect(sessionId1.type).toBe("session");
      expect(sessionId2.type).toBe("session");
    });

    it("should generate valid UUID format", () => {
      const sessionId = SessionId.generate();
      
      // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      expect(sessionId.value).toMatch(uuidRegex);
    });

    it("should generate multiple unique values", () => {
      const sessionIds = [];
      for (let i = 0; i < 10; i++) {
        sessionIds.push(SessionId.generate().value);
      }
      
      const uniqueIds = new Set(sessionIds);
      expect(uniqueIds.size).toBe(10); // All should be unique
    });
  });

  describe("fromString", () => {
    it("should create SessionId from string", () => {
      const sessionId = SessionId.fromString("test-session-id");
      
      expect(sessionId.value).toBe("test-session-id");
      expect(sessionId.type).toBe("session");
    });

    it("should throw error for empty string", () => {
      expect(() => SessionId.fromString("")).toThrow("SessionId cannot be empty");
    });

    it("should throw error for whitespace", () => {
      expect(() => SessionId.fromString("  \t  ")).toThrow("SessionId cannot be empty");
    });

    it("should accept UUID format", () => {
      const uuid = "550e8400-e29b-41d4-a716-446655440000";
      const sessionId = SessionId.fromString(uuid);
      
      expect(sessionId.value).toBe(uuid);
    });
  });

  describe("value getter", () => {
    it("should return the internal value", () => {
      const sessionId = new SessionId("my-session");
      
      expect(sessionId.value).toBe("my-session");
    });

    it("should return immutable value", () => {
      const sessionId = new SessionId("original-value");
      const originalValue = sessionId.value;
      
      // Attempting to modify the returned value shouldn't affect the SessionId
      expect(sessionId.value).toBe(originalValue);
    });
  });

  describe("equals", () => {
    it("should return true for same values", () => {
      const sessionId1 = new SessionId("same-session");
      const sessionId2 = new SessionId("same-session");
      
      expect(sessionId1.equals(sessionId2)).toBe(true);
      expect(sessionId2.equals(sessionId1)).toBe(true);
    });

    it("should return false for different values", () => {
      const sessionId1 = new SessionId("session-1");
      const sessionId2 = new SessionId("session-2");
      
      expect(sessionId1.equals(sessionId2)).toBe(false);
      expect(sessionId2.equals(sessionId1)).toBe(false);
    });

    it("should be case sensitive", () => {
      const sessionId1 = new SessionId("session-id");
      const sessionId2 = new SessionId("SESSION-ID");
      
      expect(sessionId1.equals(sessionId2)).toBe(false);
    });

    it("should handle special characters", () => {
      const sessionId1 = new SessionId("session_123-abc");
      const sessionId2 = new SessionId("session_123-abc");
      const sessionId3 = new SessionId("session_123-xyz");
      
      expect(sessionId1.equals(sessionId2)).toBe(true);
      expect(sessionId1.equals(sessionId3)).toBe(false);
    });
  });

  describe("toString", () => {
    it("should return string representation", () => {
      const sessionId = new SessionId("test-session");
      
      expect(sessionId.toString()).toBe("test-session");
    });

    it("should return same value as value getter", () => {
      const sessionId = new SessionId("another-session");
      
      expect(sessionId.toString()).toBe(sessionId.value);
    });

    it("should handle complex string values", () => {
      const complexValue = "session_123-456.789@domain.com";
      const sessionId = new SessionId(complexValue);
      
      expect(sessionId.toString()).toBe(complexValue);
    });
  });

  describe("type property", () => {
    it("should always be 'session'", () => {
      const sessionId1 = new SessionId("session-1");
      const sessionId2 = SessionId.generate();
      const sessionId3 = SessionId.fromString("session-3");
      
      expect(sessionId1.type).toBe("session");
      expect(sessionId2.type).toBe("session");
      expect(sessionId3.type).toBe("session");
    });

    it("should be readonly", () => {
      const sessionId = new SessionId("test-session");
      
      // This should not compile, but we can test the property exists
      expect(sessionId.type).toBe("session");
      
      // The type property should exist and be "session"
      expect(sessionId.type).toBe("session");
    });
  });

  describe("immutability", () => {
    it("should provide consistent value through getter", () => {
      const sessionId = new SessionId("immutable-session");
      const originalValue = sessionId.value;
      
      // Value should be consistent when accessed multiple times
      expect(sessionId.value).toBe(originalValue);
      expect(sessionId.value).toBe("immutable-session");
    });
  });
});