import { KoaAuthenticationAdapter } from "../../../../src/adapters/primary/KoaAuthenticationAdapter";
import { AuthenticationPort, AuthenticationError, AuthenticationException } from "../../../../src/ports/AuthenticationPort";
import { User } from "../../../../src/domain/auth/User";
import { UserId } from "../../../../src/domain/auth/UserId";
import { GoogleProfile } from "../../../../src/domain/auth/GoogleProfile";
import { Context, Next } from "koa";

describe("KoaAuthenticationAdapter", () => {
  let adapter: KoaAuthenticationAdapter;
  let mockAuthenticationService: jest.Mocked<AuthenticationPort>;

  beforeEach(() => {
    mockAuthenticationService = {
      authenticateWithGoogle: jest.fn(),
      serializeUser: jest.fn(),
      deserializeUser: jest.fn()
    };

    adapter = new KoaAuthenticationAdapter(mockAuthenticationService);
  });

  describe("handleGoogleCallback", () => {
    const mockDone = jest.fn();
    const mockProfile = {
      id: "google123",
      displayName: "Test User",
      emails: [{ value: "test@example.com" }],
      photos: [{ value: "http://example.com/photo.jpg" }]
    };

    beforeEach(() => {
      mockDone.mockClear();
    });

    it("should handle successful Google authentication", async () => {
      const domainUser = new User(
        new UserId("1"),
        "google123",
        "Test User",
        "test@example.com",
        "http://example.com/photo.jpg"
      );

      mockAuthenticationService.authenticateWithGoogle.mockResolvedValue(domainUser);

      await adapter.handleGoogleCallback("accessToken", "refreshToken", mockProfile, mockDone);

      expect(mockAuthenticationService.authenticateWithGoogle).toHaveBeenCalledWith({
        id: "google123",
        displayName: "Test User",
        emails: [{ value: "test@example.com" }],
        photos: [{ value: "http://example.com/photo.jpg" }]
      });

      expect(mockDone).toHaveBeenCalledWith(null, {
        id: 1,
        google_id: "google123",
        display_name: "Test User",
        email: "test@example.com",
        picture: "http://example.com/photo.jpg"
      });
    });

    it("should handle authentication service errors", async () => {
      const authError = new AuthenticationException(
        AuthenticationError.INVALID_PROFILE,
        "Invalid profile"
      );

      mockAuthenticationService.authenticateWithGoogle.mockRejectedValue(authError);

      await adapter.handleGoogleCallback("accessToken", "refreshToken", mockProfile, mockDone);

      expect(mockDone).toHaveBeenCalledWith(authError, false);
    });

    it("should handle profile without email", async () => {
      const profileWithoutEmail = {
        id: "google456",
        displayName: "No Email User",
        photos: [{ value: "http://example.com/photo.jpg" }]
      };

      const domainUser = new User(
        new UserId("2"),
        "google456",
        "No Email User",
        undefined,
        "http://example.com/photo.jpg"
      );

      mockAuthenticationService.authenticateWithGoogle.mockResolvedValue(domainUser);

      await adapter.handleGoogleCallback("accessToken", "refreshToken", profileWithoutEmail, mockDone);

      expect(mockAuthenticationService.authenticateWithGoogle).toHaveBeenCalledWith({
        id: "google456",
        displayName: "No Email User",
        emails: [],
        photos: [{ value: "http://example.com/photo.jpg" }]
      });

      expect(mockDone).toHaveBeenCalledWith(null, {
        id: 2,
        google_id: "google456",
        display_name: "No Email User",
        email: null,
        picture: "http://example.com/photo.jpg"
      });
    });

    it("should handle profile without photo", async () => {
      const profileWithoutPhoto = {
        id: "google789",
        displayName: "No Photo User",
        emails: [{ value: "nophoto@example.com" }]
      };

      const domainUser = new User(
        new UserId("3"),
        "google789",
        "No Photo User",
        "nophoto@example.com",
        undefined
      );

      mockAuthenticationService.authenticateWithGoogle.mockResolvedValue(domainUser);

      await adapter.handleGoogleCallback("accessToken", "refreshToken", profileWithoutPhoto, mockDone);

      expect(mockAuthenticationService.authenticateWithGoogle).toHaveBeenCalledWith({
        id: "google789",
        displayName: "No Photo User",
        emails: [{ value: "nophoto@example.com" }],
        photos: []
      });

      expect(mockDone).toHaveBeenCalledWith(null, {
        id: 3,
        google_id: "google789",
        display_name: "No Photo User",
        email: "nophoto@example.com",
        picture: null
      });
    });
  });

  describe("serializeUser", () => {
    const mockDone = jest.fn();

    beforeEach(() => {
      mockDone.mockClear();
    });

    it("should serialize user successfully", async () => {
      const passportUser = {
        id: 1,
        google_id: "google123",
        display_name: "Test User",
        email: "test@example.com",
        picture: "http://example.com/photo.jpg"
      };

      mockAuthenticationService.serializeUser.mockResolvedValue("1");

      await adapter.serializeUser(passportUser, mockDone);

      expect(mockAuthenticationService.serializeUser).toHaveBeenCalledWith(
        expect.objectContaining({
          googleId: "google123",
          displayName: "Test User",
          email: "test@example.com",
          picture: "http://example.com/photo.jpg"
        })
      );

      expect(mockDone).toHaveBeenCalledWith(null, "1");
    });

    it("should handle serialization errors", async () => {
      const passportUser = {
        id: 1,
        google_id: "google123",
        display_name: "Test User",
        email: "test@example.com"
      };

      const serializationError = new AuthenticationException(
        AuthenticationError.SERIALIZATION_ERROR,
        "Serialization failed"
      );

      mockAuthenticationService.serializeUser.mockRejectedValue(serializationError);

      await adapter.serializeUser(passportUser, mockDone);

      expect(mockDone).toHaveBeenCalledWith(serializationError, null);
    });
  });

  describe("deserializeUser", () => {
    const mockDone = jest.fn();

    beforeEach(() => {
      mockDone.mockClear();
    });

    it("should deserialize user successfully", async () => {
      const domainUser = new User(
        new UserId("1"),
        "google123",
        "Test User",
        "test@example.com",
        "http://example.com/photo.jpg"
      );

      mockAuthenticationService.deserializeUser.mockResolvedValue(domainUser);

      await adapter.deserializeUser("1", mockDone);

      expect(mockAuthenticationService.deserializeUser).toHaveBeenCalledWith("1");

      expect(mockDone).toHaveBeenCalledWith(null, {
        id: 1,
        google_id: "google123",
        display_name: "Test User",
        email: "test@example.com",
        picture: "http://example.com/photo.jpg"
      });
    });

    it("should handle user not found", async () => {
      mockAuthenticationService.deserializeUser.mockResolvedValue(null);

      await adapter.deserializeUser("999", mockDone);

      expect(mockDone).toHaveBeenCalledWith(null, false);
    });

    it("should handle deserialization errors", async () => {
      const deserializationError = new AuthenticationException(
        AuthenticationError.REPOSITORY_ERROR,
        "Repository error"
      );

      mockAuthenticationService.deserializeUser.mockRejectedValue(deserializationError);

      await adapter.deserializeUser("1", mockDone);

      expect(mockDone).toHaveBeenCalledWith(deserializationError, false);
    });
  });

  describe("requireAuth middleware", () => {
    let mockCtx: any;
    let mockNext: Next;

    beforeEach(() => {
      mockCtx = {
        isAuthenticated: jest.fn(),
        state: { user: { 
          id: 1, 
          google_id: "google123", 
          display_name: "Test User" 
        } },
        status: 200,
        body: undefined
      };
      mockNext = jest.fn().mockResolvedValue(undefined);
    });

    it("should allow authenticated users", async () => {
      mockCtx.isAuthenticated.mockReturnValue(true);

      await adapter.requireAuth(mockCtx as Context, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockCtx.status).toBe(200);
    });

    it("should reject unauthenticated users", async () => {
      mockCtx.isAuthenticated.mockReturnValue(false);

      await adapter.requireAuth(mockCtx as Context, mockNext);

      expect(mockCtx.status).toBe(401);
      expect(mockCtx.body).toEqual({ error: "認証が必要です" });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("getCurrentUser middleware", () => {
    let mockCtx: any;
    let mockNext: Next;

    beforeEach(() => {
      mockCtx = {
        isAuthenticated: jest.fn(),
        state: { user: { 
          id: 1, 
          google_id: "google123", 
          display_name: "Test User" 
        } }
      };
      mockNext = jest.fn().mockResolvedValue(undefined);
    });

    it("should pass through for authenticated users", async () => {
      mockCtx.isAuthenticated.mockReturnValue(true);

      await adapter.getCurrentUser(mockCtx as Context, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it("should pass through for unauthenticated users", async () => {
      mockCtx.isAuthenticated.mockReturnValue(false);

      await adapter.getCurrentUser(mockCtx as Context, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});