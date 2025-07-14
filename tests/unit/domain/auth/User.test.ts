import { User } from "../../../../src/domain/auth/User";
import { UserId } from "../../../../src/domain/auth/UserId";
import { GoogleProfile } from "../../../../src/domain/auth/GoogleProfile";

describe("User", () => {
  const userId = new UserId("123");
  const googleId = "google123";
  const displayName = "Test User";
  const email = "test@example.com";
  const picture = "http://example.com/photo.jpg";

  describe("constructor", () => {
    it("should create user with all properties", () => {
      const user = new User(userId, googleId, displayName, email, picture);
      
      expect(user.id).toBe(userId);
      expect(user.googleId).toBe(googleId);
      expect(user.displayName).toBe(displayName);
      expect(user.email).toBe(email);
      expect(user.picture).toBe(picture);
    });

    it("should create user without optional properties", () => {
      const user = new User(userId, googleId, displayName);
      
      expect(user.id).toBe(userId);
      expect(user.googleId).toBe(googleId);
      expect(user.displayName).toBe(displayName);
      expect(user.email).toBeUndefined();
      expect(user.picture).toBeUndefined();
    });

    it("should throw error for empty googleId", () => {
      expect(() => new User(userId, "", displayName)).toThrow("Google ID cannot be empty");
    });

    it("should throw error for empty displayName", () => {
      expect(() => new User(userId, googleId, "")).toThrow("Display name cannot be empty");
    });

    it("should throw error for null userId", () => {
      expect(() => new User(null as any, googleId, displayName)).toThrow("User ID is required");
    });
  });

  describe("createFromGoogle", () => {
    const googleProfile: GoogleProfile = {
      id: googleId,
      displayName: displayName,
      emails: [{ value: email }],
      photos: [{ value: picture }]
    };

    it("should create user from complete Google profile", () => {
      const user = User.createFromGoogle(googleProfile);
      
      expect(user.googleId).toBe(googleId);
      expect(user.displayName).toBe(displayName);
      expect(user.email).toBe(email);
      expect(user.picture).toBe(picture);
      expect(user.id).toBeDefined();
    });

    it("should create user from profile without email", () => {
      const profileWithoutEmail = {
        ...googleProfile,
        emails: undefined
      };
      
      const user = User.createFromGoogle(profileWithoutEmail);
      
      expect(user.googleId).toBe(googleId);
      expect(user.displayName).toBe(displayName);
      expect(user.email).toBeUndefined();
      expect(user.picture).toBe(picture);
    });

    it("should create user from profile without photo", () => {
      const profileWithoutPhoto = {
        ...googleProfile,
        photos: []
      };
      
      const user = User.createFromGoogle(profileWithoutPhoto);
      
      expect(user.googleId).toBe(googleId);
      expect(user.displayName).toBe(displayName);
      expect(user.email).toBe(email);
      expect(user.picture).toBeUndefined();
    });

    it("should handle empty emails array", () => {
      const profileWithEmptyEmails = {
        ...googleProfile,
        emails: []
      };
      
      const user = User.createFromGoogle(profileWithEmptyEmails);
      expect(user.email).toBeUndefined();
    });
  });

  describe("updateProfile", () => {
    it("should update display name and picture", () => {
      const user = new User(userId, googleId, "Old Name", email, "old-photo.jpg");
      const newDisplayName = "New Name";
      const newPicture = "new-photo.jpg";
      
      const updatedUser = user.updateProfile(newDisplayName, newPicture);
      
      expect(updatedUser.id).toBe(userId);
      expect(updatedUser.googleId).toBe(googleId);
      expect(updatedUser.displayName).toBe(newDisplayName);
      expect(updatedUser.email).toBe(email);
      expect(updatedUser.picture).toBe(newPicture);
    });

    it("should update only display name when picture is undefined", () => {
      const user = new User(userId, googleId, "Old Name", email, picture);
      const newDisplayName = "New Name";
      
      const updatedUser = user.updateProfile(newDisplayName);
      
      expect(updatedUser.displayName).toBe(newDisplayName);
      expect(updatedUser.picture).toBe(picture);
    });

    it("should return new instance, not mutate original", () => {
      const user = new User(userId, googleId, displayName, email, picture);
      const updatedUser = user.updateProfile("New Name", "new-photo.jpg");
      
      expect(user.displayName).toBe(displayName);
      expect(user.picture).toBe(picture);
      expect(updatedUser).not.toBe(user);
    });

    it("should throw error for empty display name", () => {
      const user = new User(userId, googleId, displayName, email, picture);
      expect(() => user.updateProfile("")).toThrow("Display name cannot be empty");
    });
  });

  describe("equals", () => {
    it("should return true for users with same ID", () => {
      const user1 = new User(userId, googleId, displayName, email, picture);
      const user2 = new User(userId, "different-google-id", "Different Name");
      
      expect(user1.equals(user2)).toBe(true);
    });

    it("should return false for users with different IDs", () => {
      const user1 = new User(userId, googleId, displayName);
      const user2 = new User(new UserId("456"), googleId, displayName);
      
      expect(user1.equals(user2)).toBe(false);
    });

    it("should return false when comparing with null", () => {
      const user = new User(userId, googleId, displayName);
      expect(user.equals(null as any)).toBe(false);
    });
  });

  describe("isNewUser", () => {
    it("should return true for user created from Google profile", () => {
      const googleProfile: GoogleProfile = {
        id: googleId,
        displayName: displayName,
        emails: [{ value: email }],
        photos: [{ value: picture }]
      };
      
      const user = User.createFromGoogle(googleProfile);
      expect(user.isNewUser()).toBe(true);
    });

    it("should return false for user created with explicit ID", () => {
      const user = new User(userId, googleId, displayName, email, picture);
      expect(user.isNewUser()).toBe(false);
    });
  });
});