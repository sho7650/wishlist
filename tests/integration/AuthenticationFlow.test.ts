import { AuthenticationService } from "../../src/application/services/AuthenticationService";
import { DatabaseUserRepositoryAdapter } from "../../src/adapters/secondary/DatabaseUserRepositoryAdapter";
import { MockEventPublisher } from "../../src/adapters/secondary/MockEventPublisher";
import { SQLiteQueryExecutor } from "../../src/infrastructure/db/query/SQLiteQueryExecutor";
import { SQLiteConnection } from "../../src/infrastructure/db/SQLiteConnection";
import { GoogleProfile } from "../../src/domain/auth/GoogleProfile";
import { User } from "../../src/domain/auth/User";
import { UserId } from "../../src/domain/auth/UserId";

describe("Authentication Flow Integration", () => {
  let authService: AuthenticationService;
  let userRepository: DatabaseUserRepositoryAdapter;
  let eventPublisher: MockEventPublisher;
  let queryExecutor: SQLiteQueryExecutor;
  let connection: SQLiteConnection;

  beforeEach(async () => {
    // Create in-memory SQLite database for testing
    connection = new SQLiteConnection(":memory:");
    queryExecutor = new SQLiteQueryExecutor(connection);
    
    // Create users table
    await queryExecutor.raw(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        google_id TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        email TEXT,
        picture TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, []);

    eventPublisher = new MockEventPublisher();
    userRepository = new DatabaseUserRepositoryAdapter(queryExecutor);
    authService = new AuthenticationService(userRepository, eventPublisher);
  });

  afterEach(async () => {
    await connection.close();
  });

  describe("Full Authentication Flow", () => {
    const validGoogleProfile: GoogleProfile = {
      id: "google123",
      displayName: "Test User",
      emails: [{ value: "test@example.com" }],
      photos: [{ value: "http://example.com/photo.jpg" }]
    };

    it("should handle complete new user registration flow", async () => {
      // Step 1: Authenticate new user
      const authenticatedUser = await authService.authenticateWithGoogle(validGoogleProfile);
      
      expect(authenticatedUser).toBeInstanceOf(User);
      expect(authenticatedUser.googleId).toBe("google123");
      expect(authenticatedUser.displayName).toBe("Test User");
      expect(authenticatedUser.email).toBe("test@example.com");
      expect(authenticatedUser.picture).toBe("http://example.com/photo.jpg");
      
      // Step 2: Serialize user for session
      const serializedUser = await authService.serializeUser(authenticatedUser);
      expect(serializedUser).toBe(authenticatedUser.id.value);
      
      // Step 3: Deserialize user from session
      const deserializedUser = await authService.deserializeUser(serializedUser);
      expect(deserializedUser).toBeInstanceOf(User);
      expect(deserializedUser?.id.value).toBe(authenticatedUser.id.value);
      expect(deserializedUser?.googleId).toBe("google123");
      
      // Step 4: Verify user persists in database
      const foundUser = await userRepository.findByGoogleId("google123");
      expect(foundUser).not.toBeNull();
      expect(foundUser?.displayName).toBe("Test User");
    });

    it("should handle existing user authentication and profile update", async () => {
      // Step 1: Create initial user
      const initialUser = await authService.authenticateWithGoogle(validGoogleProfile);
      
      // Step 2: Update profile information
      const updatedProfile: GoogleProfile = {
        id: "google123",
        displayName: "Updated User Name",
        emails: [{ value: "test@example.com" }],
        photos: [{ value: "http://example.com/updated-photo.jpg" }]
      };
      
      // Step 3: Authenticate again (should update profile)
      const updatedUser = await authService.authenticateWithGoogle(updatedProfile);
      
      expect(updatedUser.id.value).toBe(initialUser.id.value); // Same user
      expect(updatedUser.displayName).toBe("Updated User Name");
      expect(updatedUser.picture).toBe("http://example.com/updated-photo.jpg");
      
      // Step 4: Verify update persisted
      const foundUser = await userRepository.findByGoogleId("google123");
      expect(foundUser?.displayName).toBe("Updated User Name");
      expect(foundUser?.picture).toBe("http://example.com/updated-photo.jpg");
    });

    it("should handle session serialization/deserialization cycle", async () => {
      // Step 1: Create user
      const user = await authService.authenticateWithGoogle(validGoogleProfile);
      
      // Step 2: Multiple serialize/deserialize cycles
      const serialized1 = await authService.serializeUser(user);
      const deserialized1 = await authService.deserializeUser(serialized1);
      
      const serialized2 = await authService.serializeUser(deserialized1!);
      const deserialized2 = await authService.deserializeUser(serialized2);
      
      // All should be consistent
      expect(deserialized1?.id.value).toBe(user.id.value);
      expect(deserialized2?.id.value).toBe(user.id.value);
      expect(deserialized1?.googleId).toBe(user.googleId);
      expect(deserialized2?.googleId).toBe(user.googleId);
    });

    it("should handle profile variations gracefully", async () => {
      // Test profile without email
      const profileWithoutEmail: GoogleProfile = {
        id: "google456",
        displayName: "No Email User",
        photos: [{ value: "http://example.com/photo.jpg" }]
      };
      
      const userWithoutEmail = await authService.authenticateWithGoogle(profileWithoutEmail);
      expect(userWithoutEmail.email).toBeUndefined();
      
      // Test profile without photo
      const profileWithoutPhoto: GoogleProfile = {
        id: "google789",
        displayName: "No Photo User",
        emails: [{ value: "nophoto@example.com" }]
      };
      
      const userWithoutPhoto = await authService.authenticateWithGoogle(profileWithoutPhoto);
      expect(userWithoutPhoto.picture).toBeUndefined();
      
      // Both should be serializable/deserializable
      const serialized1 = await authService.serializeUser(userWithoutEmail);
      const deserialized1 = await authService.deserializeUser(serialized1);
      expect(deserialized1?.email).toBeUndefined();
      
      const serialized2 = await authService.serializeUser(userWithoutPhoto);
      const deserialized2 = await authService.deserializeUser(serialized2);
      expect(deserialized2?.picture).toBeUndefined();
    });

    it("should maintain data consistency across operations", async () => {
      // Create multiple users
      const users = await Promise.all([
        authService.authenticateWithGoogle({
          id: "user1",
          displayName: "User One",
          emails: [{ value: "user1@example.com" }]
        }),
        authService.authenticateWithGoogle({
          id: "user2", 
          displayName: "User Two",
          emails: [{ value: "user2@example.com" }]
        }),
        authService.authenticateWithGoogle({
          id: "user3",
          displayName: "User Three",
          emails: [{ value: "user3@example.com" }]
        })
      ]);
      
      // Verify all users exist and are unique
      expect(users).toHaveLength(3);
      const userIds = users.map(u => u.id.value);
      expect(new Set(userIds).size).toBe(3); // All unique
      
      // Verify repository operations
      const totalCount = await userRepository.count();
      expect(totalCount).toBe(3);
      
      // Verify each user can be found
      for (const user of users) {
        const foundUser = await userRepository.findById(user.id);
        expect(foundUser).not.toBeNull();
        expect(foundUser?.displayName).toBe(user.displayName);
      }
    });
  });
});