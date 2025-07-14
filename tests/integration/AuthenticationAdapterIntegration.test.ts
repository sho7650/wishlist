import { AuthenticationService } from "../../src/application/services/AuthenticationService";
import { DatabaseUserRepositoryAdapter } from "../../src/adapters/secondary/DatabaseUserRepositoryAdapter";
import { MockEventPublisher } from "../../src/adapters/secondary/MockEventPublisher";
import { ExpressAuthenticationAdapter } from "../../src/adapters/primary/ExpressAuthenticationAdapter";
import { KoaAuthenticationAdapter } from "../../src/adapters/primary/KoaAuthenticationAdapter";
import { SQLiteQueryExecutor } from "../../src/infrastructure/db/query/SQLiteQueryExecutor";
import { SQLiteConnection } from "../../src/infrastructure/db/SQLiteConnection";
import { GoogleProfile } from "../../src/domain/auth/GoogleProfile";
import { User } from "../../src/domain/auth/User";
import { UserId } from "../../src/domain/auth/UserId";

describe("Authentication Adapter Integration", () => {
  let authenticationService: AuthenticationService;
  let userRepository: DatabaseUserRepositoryAdapter;
  let eventPublisher: MockEventPublisher;
  let queryExecutor: SQLiteQueryExecutor;
  let connection: SQLiteConnection;
  let expressAdapter: ExpressAuthenticationAdapter;
  let koaAdapter: KoaAuthenticationAdapter;

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
    authenticationService = new AuthenticationService(userRepository, eventPublisher);
    
    // Create authentication adapters
    expressAdapter = new ExpressAuthenticationAdapter(authenticationService);
    koaAdapter = new KoaAuthenticationAdapter(authenticationService);
  });

  afterEach(async () => {
    await connection.close();
  });

  describe("Express Authentication Flow", () => {
    const validGoogleProfile = {
      id: "google123",
      displayName: "Test User",
      emails: [{ value: "test@example.com" }],
      photos: [{ value: "http://example.com/photo.jpg" }]
    };

    it("should handle complete authentication flow with Express adapter", async () => {
      const mockDone = jest.fn();

      // Step 1: Handle Google callback
      await expressAdapter.handleGoogleCallback(
        "accessToken",
        "refreshToken",
        validGoogleProfile,
        mockDone
      );

      // Verify user was created and callback was successful
      expect(mockDone).toHaveBeenCalledWith(null, expect.objectContaining({
        google_id: "google123",
        display_name: "Test User",
        email: "test@example.com",
        picture: "http://example.com/photo.jpg"
      }));

      const createdUser = mockDone.mock.calls[0][1];
      
      // Step 2: Serialize user
      const serializeDone = jest.fn();
      await expressAdapter.serializeUser(createdUser, serializeDone);
      
      expect(serializeDone).toHaveBeenCalledWith(null, createdUser.id.toString());
      const serializedId = serializeDone.mock.calls[0][1];
      
      // Step 3: Deserialize user
      const deserializeDone = jest.fn();
      await expressAdapter.deserializeUser(serializedId, deserializeDone);
      
      expect(deserializeDone).toHaveBeenCalledWith(null, expect.objectContaining({
        google_id: "google123",
        display_name: "Test User",
        email: "test@example.com"
      }));

      // Step 4: Verify user persists in database
      const foundUser = await userRepository.findByGoogleId("google123");
      expect(foundUser).not.toBeNull();
      expect(foundUser?.displayName).toBe("Test User");
    });

    it("should handle user profile updates with Express adapter", async () => {
      const mockDone = jest.fn();

      // Step 1: Create initial user
      await expressAdapter.handleGoogleCallback(
        "accessToken",
        "refreshToken",
        validGoogleProfile,
        mockDone
      );

      // Step 2: Update profile
      const updatedProfile = {
        id: "google123",
        displayName: "Updated User Name",
        emails: [{ value: "test@example.com" }],
        photos: [{ value: "http://example.com/updated-photo.jpg" }]
      };

      const updateDone = jest.fn();
      await expressAdapter.handleGoogleCallback(
        "accessToken",
        "refreshToken",
        updatedProfile,
        updateDone
      );

      // Verify profile was updated
      expect(updateDone).toHaveBeenCalledWith(null, expect.objectContaining({
        google_id: "google123",
        display_name: "Updated User Name",
        picture: "http://example.com/updated-photo.jpg"
      }));

      // Verify update persisted in database
      const foundUser = await userRepository.findByGoogleId("google123");
      expect(foundUser?.displayName).toBe("Updated User Name");
      expect(foundUser?.picture).toBe("http://example.com/updated-photo.jpg");
    });
  });

  describe("Koa Authentication Flow", () => {
    const validGoogleProfile = {
      id: "google456",
      displayName: "Koa Test User",
      emails: [{ value: "koa@example.com" }],
      photos: [{ value: "http://example.com/koa-photo.jpg" }]
    };

    it("should handle complete authentication flow with Koa adapter", async () => {
      const mockDone = jest.fn();

      // Step 1: Handle Google callback
      await koaAdapter.handleGoogleCallback(
        "accessToken",
        "refreshToken",
        validGoogleProfile,
        mockDone
      );

      // Verify user was created and callback was successful
      expect(mockDone).toHaveBeenCalledWith(null, expect.objectContaining({
        google_id: "google456",
        display_name: "Koa Test User",
        email: "koa@example.com",
        picture: "http://example.com/koa-photo.jpg"
      }));

      const createdUser = mockDone.mock.calls[0][1];
      
      // Step 2: Serialize user
      const serializeDone = jest.fn();
      await koaAdapter.serializeUser(createdUser, serializeDone);
      
      expect(serializeDone).toHaveBeenCalledWith(null, createdUser.id.toString());
      const serializedId = serializeDone.mock.calls[0][1];
      
      // Step 3: Deserialize user
      const deserializeDone = jest.fn();
      await koaAdapter.deserializeUser(serializedId, deserializeDone);
      
      expect(deserializeDone).toHaveBeenCalledWith(null, expect.objectContaining({
        google_id: "google456",
        display_name: "Koa Test User",
        email: "koa@example.com"
      }));

      // Step 4: Verify user persists in database
      const foundUser = await userRepository.findByGoogleId("google456");
      expect(foundUser).not.toBeNull();
      expect(foundUser?.displayName).toBe("Koa Test User");
    });

    it("should handle user profile updates with Koa adapter", async () => {
      const mockDone = jest.fn();

      // Step 1: Create initial user
      await koaAdapter.handleGoogleCallback(
        "accessToken",
        "refreshToken",
        validGoogleProfile,
        mockDone
      );

      // Step 2: Update profile
      const updatedProfile = {
        id: "google456",
        displayName: "Updated Koa User",
        emails: [{ value: "koa@example.com" }],
        photos: [{ value: "http://example.com/updated-koa-photo.jpg" }]
      };

      const updateDone = jest.fn();
      await koaAdapter.handleGoogleCallback(
        "accessToken",
        "refreshToken",
        updatedProfile,
        updateDone
      );

      // Verify profile was updated
      expect(updateDone).toHaveBeenCalledWith(null, expect.objectContaining({
        google_id: "google456",
        display_name: "Updated Koa User",
        picture: "http://example.com/updated-koa-photo.jpg"
      }));

      // Verify update persisted in database
      const foundUser = await userRepository.findByGoogleId("google456");
      expect(foundUser?.displayName).toBe("Updated Koa User");
      expect(foundUser?.picture).toBe("http://example.com/updated-koa-photo.jpg");
    });
  });

  describe("Cross-Framework Compatibility", () => {
    it("should handle users created by Express adapter in Koa adapter", async () => {
      // Create user via Express adapter
      const expressProfile = {
        id: "google789",
        displayName: "Cross Framework User",
        emails: [{ value: "cross@example.com" }],
        photos: [{ value: "http://example.com/cross-photo.jpg" }]
      };

      const expressDone = jest.fn();
      await expressAdapter.handleGoogleCallback(
        "accessToken",
        "refreshToken",
        expressProfile,
        expressDone
      );

      const createdUser = expressDone.mock.calls[0][1];
      
      // Serialize with Express adapter
      const expressSerializeDone = jest.fn();
      await expressAdapter.serializeUser(createdUser, expressSerializeDone);
      const serializedId = expressSerializeDone.mock.calls[0][1];
      
      // Deserialize with Koa adapter
      const koaDeserializeDone = jest.fn();
      await koaAdapter.deserializeUser(serializedId, koaDeserializeDone);
      
      expect(koaDeserializeDone).toHaveBeenCalledWith(null, expect.objectContaining({
        google_id: "google789",
        display_name: "Cross Framework User",
        email: "cross@example.com"
      }));

      // Verify both adapters can work with the same user
      const foundUser = await userRepository.findByGoogleId("google789");
      expect(foundUser?.displayName).toBe("Cross Framework User");
    });

    it("should handle users created by Koa adapter in Express adapter", async () => {
      // Create user via Koa adapter
      const koaProfile = {
        id: "google999",
        displayName: "Reverse Cross User",
        emails: [{ value: "reverse@example.com" }],
        photos: [{ value: "http://example.com/reverse-photo.jpg" }]
      };

      const koaDone = jest.fn();
      await koaAdapter.handleGoogleCallback(
        "accessToken",
        "refreshToken",
        koaProfile,
        koaDone
      );

      const createdUser = koaDone.mock.calls[0][1];
      
      // Serialize with Koa adapter
      const koaSerializeDone = jest.fn();
      await koaAdapter.serializeUser(createdUser, koaSerializeDone);
      const serializedId = koaSerializeDone.mock.calls[0][1];
      
      // Deserialize with Express adapter
      const expressDeserializeDone = jest.fn();
      await expressAdapter.deserializeUser(serializedId, expressDeserializeDone);
      
      expect(expressDeserializeDone).toHaveBeenCalledWith(null, expect.objectContaining({
        google_id: "google999",
        display_name: "Reverse Cross User",
        email: "reverse@example.com"
      }));

      // Verify both adapters can work with the same user
      const foundUser = await userRepository.findByGoogleId("google999");
      expect(foundUser?.displayName).toBe("Reverse Cross User");
    });
  });

  describe("Error Handling", () => {
    it("should handle authentication errors consistently across adapters", async () => {
      const invalidProfile = {
        id: "",
        displayName: "Invalid User"
      };

      const expressDone = jest.fn();
      await expressAdapter.handleGoogleCallback(
        "accessToken",
        "refreshToken",
        invalidProfile,
        expressDone
      );

      const koaDone = jest.fn();
      await koaAdapter.handleGoogleCallback(
        "accessToken",
        "refreshToken",
        invalidProfile,
        koaDone
      );

      // Both adapters should handle the error similarly
      expect(expressDone).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: "INVALID_PROFILE"
        }),
        false
      );

      expect(koaDone).toHaveBeenCalledWith(
        expect.objectContaining({
          errorType: "INVALID_PROFILE"
        }),
        false
      );
    });
  });
});