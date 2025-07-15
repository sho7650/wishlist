import { configureKoaPassport, koaPassport } from "../../../src/config/koa-passport";
import { Logger } from "../../../src/utils/Logger";

// koa-passportのモック
jest.mock("koa-passport", () => ({
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
  use: jest.fn(),
}));

// passport-google-oauth20のモック
jest.mock("passport-google-oauth20", () => ({
  Strategy: jest.fn(),
}));

// Logger.debugをモック
let mockLoggerDebug: jest.SpyInstance;

describe("Koa Passport Configuration", () => {
  let mockDb: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // console.logをモック
    mockLoggerDebug = jest.spyOn(Logger, 'debug').mockImplementation(() => {});
    
    // データベース接続のモック
    mockDb = {
      query: jest.fn(),
    };

    // 環境変数のモック
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_CALLBACK_URL = "/auth/google/callback";
  });

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_CALLBACK_URL;
    delete process.env.DB_TYPE;
    if (mockLoggerDebug) {
      mockLoggerDebug.mockRestore();
    }
  });

  it("should configure koa-passport with serialize and deserialize functions", () => {
    configureKoaPassport(mockDb);

    expect(koaPassport.serializeUser).toHaveBeenCalledWith(expect.any(Function));
    expect(koaPassport.deserializeUser).toHaveBeenCalledWith(expect.any(Function));
    expect(koaPassport.use).toHaveBeenCalledWith(expect.any(Object));
  });

  it("should configure Google Strategy with correct options", () => {
    const { Strategy } = require("passport-google-oauth20");
    
    configureKoaPassport(mockDb);

    expect(Strategy).toHaveBeenCalledWith(
      {
        clientID: "test-client-id",
        clientSecret: "test-client-secret",
        callbackURL: "/auth/google/callback",
      },
      expect.any(Function)
    );
  });

  describe("serializeUser", () => {
    it("should serialize user correctly", (done) => {
      configureKoaPassport(mockDb);
      
      const serializeUserFn = (koaPassport.serializeUser as jest.Mock).mock.calls[0][0];
      const mockUser = { id: 123, name: "Test User" };
      
      serializeUserFn(mockUser, (err: any, result: any) => {
        expect(err).toBeNull();
        expect(result).toBe(123);
        done();
      });
    });
  });

  describe("deserializeUser", () => {
    it("should deserialize user successfully", async () => {
      const mockUser = { id: 123, google_id: "google123", display_name: "Test User" };
      mockDb.query.mockResolvedValue({ rows: [mockUser] });

      configureKoaPassport(mockDb);
      
      const deserializeUserFn = (koaPassport.deserializeUser as jest.Mock).mock.calls[0][0];
      
      const mockDone = jest.fn();
      await deserializeUserFn(123, mockDone);

      expect(mockDb.query).toHaveBeenCalledWith("SELECT * FROM users WHERE id = $1", [123]);
      expect(mockDone).toHaveBeenCalledWith(null, mockUser);
    });

    it("should handle user not found", async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      configureKoaPassport(mockDb);
      
      const deserializeUserFn = (koaPassport.deserializeUser as jest.Mock).mock.calls[0][0];
      
      const mockDone = jest.fn();
      await deserializeUserFn(123, mockDone);

      expect(mockDb.query).toHaveBeenCalledWith("SELECT * FROM users WHERE id = $1", [123]);
      expect(mockDone).toHaveBeenCalledWith(null, false);
    });

    it("should handle database error", async () => {
      const dbError = new Error("Database connection failed");
      mockDb.query.mockRejectedValue(dbError);

      configureKoaPassport(mockDb);
      
      const deserializeUserFn = (koaPassport.deserializeUser as jest.Mock).mock.calls[0][0];
      
      const mockDone = jest.fn();
      await deserializeUserFn(123, mockDone);

      expect(mockDb.query).toHaveBeenCalledWith("SELECT * FROM users WHERE id = $1", [123]);
      expect(mockDone).toHaveBeenCalledWith(dbError, false);
    });
  });

  describe("Google Strategy callback", () => {
    beforeEach(() => {
      configureKoaPassport(mockDb);
    });

    it("should handle existing user and update information", async () => {
      const existingUser = { id: 123, google_id: "google123", display_name: "Existing User" };
      mockDb.query
        .mockResolvedValueOnce({ rows: [existingUser] }) // First query - find existing user
        .mockResolvedValueOnce({ rows: [existingUser] }); // Second query - update user

      const { Strategy } = require("passport-google-oauth20");
      const googleStrategyCallback = Strategy.mock.calls[0][1];
      const mockProfile = {
        id: "google123",
        displayName: "Updated Name",
        photos: [{ value: "http://example.com/photo.jpg" }],
      };
      const mockDone = jest.fn();

      await googleStrategyCallback("access-token", "refresh-token", mockProfile, mockDone);

      expect(mockLoggerDebug).toHaveBeenCalledWith("[AUTH] Google OAuth callback initiated");
      expect(mockLoggerDebug).toHaveBeenCalledWith("[AUTH] OAuth profile received", {
        id: mockProfile.id,
        displayName: mockProfile.displayName,
        profileType: typeof mockProfile
      });
      expect(mockLoggerDebug).toHaveBeenCalledWith("[AUTH] Existing user found", { userId: existingUser.id });
      
      expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE google_id = $1",
        ["google123"]
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        "UPDATE users SET display_name = $1, picture = $2 WHERE google_id = $3 RETURNING *",
        ["Updated Name", "http://example.com/photo.jpg", "google123"]
      );
      expect(mockDone).toHaveBeenCalledWith(null, existingUser);
    });

    it("should create new user when not found", async () => {
      const newUser = { id: 456, google_id: "google456", display_name: "New User" };
      mockDb.query
        .mockResolvedValueOnce({ rows: [] }) // First query - no existing user
        .mockResolvedValueOnce({ rows: [newUser] }); // Second query - create new user

      const { Strategy } = require("passport-google-oauth20");
      const googleStrategyCallback = Strategy.mock.calls[0][1];
      const mockProfile = {
        id: "google456",
        displayName: "New User",
        emails: [{ value: "newuser@example.com" }],
        photos: [{ value: "http://example.com/newphoto.jpg" }],
      };
      const mockDone = jest.fn();

      await googleStrategyCallback("access-token", "refresh-token", mockProfile, mockDone);

      expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE google_id = $1",
        ["google456"]
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        "INSERT INTO users (google_id, display_name, email, picture) VALUES ($1, $2, $3, $4) RETURNING *",
        ["google456", "New User", "newuser@example.com", "http://example.com/newphoto.jpg"]
      );
      expect(mockDone).toHaveBeenCalledWith(null, newUser);
    });

    it("should handle profile without photos", async () => {
      const newUser = { id: 456, google_id: "google456", display_name: "User Without Photo" };
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [newUser] });

      const { Strategy } = require("passport-google-oauth20");
      const googleStrategyCallback = Strategy.mock.calls[0][1];
      const mockProfile = {
        id: "google456",
        displayName: "User Without Photo",
        emails: [{ value: "user@example.com" }],
        photos: [], // Empty photos array
      };
      const mockDone = jest.fn();

      await googleStrategyCallback("access-token", "refresh-token", mockProfile, mockDone);

      expect(mockDb.query).toHaveBeenCalledWith(
        "INSERT INTO users (google_id, display_name, email, picture) VALUES ($1, $2, $3, $4) RETURNING *",
        ["google456", "User Without Photo", "user@example.com", null]
      );
      expect(mockDone).toHaveBeenCalledWith(null, newUser);
    });

    it("should handle profile without emails", async () => {
      const newUser = { id: 456, google_id: "google456", display_name: "User Without Email" };
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [newUser] });

      const { Strategy } = require("passport-google-oauth20");
      const googleStrategyCallback = Strategy.mock.calls[0][1];
      const mockProfile = {
        id: "google456",
        displayName: "User Without Email",
        emails: undefined, // No emails
        photos: [{ value: "http://example.com/photo.jpg" }],
      };
      const mockDone = jest.fn();

      await googleStrategyCallback("access-token", "refresh-token", mockProfile, mockDone);

      expect(mockDb.query).toHaveBeenCalledWith(
        "INSERT INTO users (google_id, display_name, email, picture) VALUES ($1, $2, $3, $4) RETURNING *",
        ["google456", "User Without Email", null, "http://example.com/photo.jpg"]
      );
      expect(mockDone).toHaveBeenCalledWith(null, newUser);
    });

    it("should handle database error in Google strategy", async () => {
      const dbError = new Error("Database connection failed");
      mockDb.query.mockRejectedValue(dbError);

      const { Strategy } = require("passport-google-oauth20");
      const googleStrategyCallback = Strategy.mock.calls[0][1];
      const mockProfile = {
        id: "google123",
        displayName: "Test User",
        emails: [{ value: "test@example.com" }],
      };
      const mockDone = jest.fn();

      await googleStrategyCallback("access-token", "refresh-token", mockProfile, mockDone);

      expect(mockDone).toHaveBeenCalledWith(dbError);
    });

    it("should log profile information for debugging", async () => {
      mockDb.query.mockResolvedValueOnce({ rows: [] });

      const { Strategy } = require("passport-google-oauth20");
      const googleStrategyCallback = Strategy.mock.calls[0][1];
      const mockProfile = {
        id: "google123",
        displayName: "Test User",
      };
      const mockDone = jest.fn();

      await googleStrategyCallback("access-token", "refresh-token", mockProfile, mockDone);

      expect(mockLoggerDebug).toHaveBeenCalledWith("[AUTH] Google OAuth callback initiated");
      expect(mockLoggerDebug).toHaveBeenCalledWith("[AUTH] OAuth profile received", {
        id: mockProfile.id,
        displayName: mockProfile.displayName,
        profileType: typeof mockProfile
      });
    });
  });

  it("should use default callback URL when not provided", () => {
    delete process.env.GOOGLE_CALLBACK_URL;
    const { Strategy } = require("passport-google-oauth20");
    
    configureKoaPassport(mockDb);

    expect(Strategy).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: "/auth/google/callback",
      }),
      expect.any(Function)
    );
  });

  describe("SQLite compatibility", () => {
    beforeEach(() => {
      process.env.DB_TYPE = "sqlite";
    });

    it("should use SQLite parameter syntax for existing user update", async () => {
      const existingUser = { id: 123, google_id: "google123", display_name: "Existing User" };
      const updatedUser = { id: 123, google_id: "google123", display_name: "Updated User" };
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [existingUser] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [updatedUser] });

      configureKoaPassport(mockDb);
      const { Strategy } = require("passport-google-oauth20");
      const googleStrategyCallback = Strategy.mock.calls[0][1];
      const mockProfile = {
        id: "google123",
        displayName: "Updated User",
        emails: [{ value: "user@example.com" }],
        photos: [{ value: "http://example.com/photo.jpg" }],
      };
      const mockDone = jest.fn();

      await googleStrategyCallback("access-token", "refresh-token", mockProfile, mockDone);

      expect(mockDb.query).toHaveBeenCalledWith(
        "UPDATE users SET display_name = ?, picture = ? WHERE google_id = ?",
        ["Updated User", "http://example.com/photo.jpg", "google123"]
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE google_id = ?",
        ["google123"]
      );
      expect(mockDone).toHaveBeenCalledWith(null, updatedUser);
    });

    it("should use SQLite parameter syntax for new user creation", async () => {
      const newUser = { id: 456, google_id: "google456", display_name: "New User" };
      
      mockDb.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [newUser] });

      configureKoaPassport(mockDb);
      const { Strategy } = require("passport-google-oauth20");
      const googleStrategyCallback = Strategy.mock.calls[0][1];
      const mockProfile = {
        id: "google456",
        displayName: "New User",
        emails: [{ value: "newuser@example.com" }],
        photos: [{ value: "http://example.com/newphoto.jpg" }],
      };
      const mockDone = jest.fn();

      await googleStrategyCallback("access-token", "refresh-token", mockProfile, mockDone);

      expect(mockDb.query).toHaveBeenCalledWith(
        "INSERT INTO users (google_id, display_name, email, picture) VALUES (?, ?, ?, ?)",
        ["google456", "New User", "newuser@example.com", "http://example.com/newphoto.jpg"]
      );
      expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE google_id = ?",
        ["google456"]
      );
      expect(mockDone).toHaveBeenCalledWith(null, newUser);
    });

    it("should use SQLite parameter syntax for deserializeUser", async () => {
      const user = { id: 123, google_id: "google123", display_name: "Test User" };
      mockDb.query.mockResolvedValueOnce({ rows: [user] });

      configureKoaPassport(mockDb);
      const deserializeUserFn = (koaPassport.deserializeUser as jest.Mock).mock.calls[0][0];
      const mockDone = jest.fn();

      await deserializeUserFn(123, mockDone);

      expect(mockDb.query).toHaveBeenCalledWith(
        "SELECT * FROM users WHERE id = ?",
        [123]
      );
      expect(mockDone).toHaveBeenCalledWith(null, user);
    });
  });
});