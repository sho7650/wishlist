import { GoogleProfile, isGoogleProfile } from "../../../../src/domain/auth/GoogleProfile";

describe("GoogleProfile", () => {
  const validProfile: GoogleProfile = {
    id: "google123",
    displayName: "Test User",
    emails: [{ value: "test@example.com" }],
    photos: [{ value: "http://example.com/photo.jpg" }]
  };

  describe("isGoogleProfile type guard", () => {
    it("should return true for valid complete profile", () => {
      expect(isGoogleProfile(validProfile)).toBe(true);
    });

    it("should return true for minimal valid profile", () => {
      const minimalProfile = {
        id: "google123",
        displayName: "Test User"
      };
      expect(isGoogleProfile(minimalProfile)).toBe(true);
    });

    it("should return false for profile with empty id", () => {
      const invalidProfile = {
        ...validProfile,
        id: ""
      };
      expect(isGoogleProfile(invalidProfile)).toBe(false);
    });

    it("should return false for profile with empty displayName", () => {
      const invalidProfile = {
        ...validProfile,
        displayName: ""
      };
      expect(isGoogleProfile(invalidProfile)).toBe(false);
    });

    it("should return false for profile missing id", () => {
      const invalidProfile = {
        displayName: "Test User",
        emails: [{ value: "test@example.com" }]
      };
      expect(isGoogleProfile(invalidProfile)).toBe(false);
    });

    it("should return false for profile missing displayName", () => {
      const invalidProfile = {
        id: "google123",
        emails: [{ value: "test@example.com" }]
      };
      expect(isGoogleProfile(invalidProfile)).toBe(false);
    });

    it("should return false for profile with non-string id", () => {
      const invalidProfile = {
        id: 123,
        displayName: "Test User"
      };
      expect(isGoogleProfile(invalidProfile)).toBe(false);
    });

    it("should return false for profile with non-string displayName", () => {
      const invalidProfile = {
        id: "google123",
        displayName: 123
      };
      expect(isGoogleProfile(invalidProfile)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isGoogleProfile(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isGoogleProfile(undefined)).toBe(false);
    });

    it("should return false for non-object", () => {
      expect(isGoogleProfile("not an object")).toBe(false);
    });

    it("should return false for empty object", () => {
      expect(isGoogleProfile({})).toBe(false);
    });
  });
});