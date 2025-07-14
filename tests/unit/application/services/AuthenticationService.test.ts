import { AuthenticationService } from "../../../../src/application/services/AuthenticationService";
import { UserRepositoryPort, UserRepositoryError, UserRepositoryException } from "../../../../src/ports/UserRepositoryPort";
import { AuthenticationError, AuthenticationException } from "../../../../src/ports/AuthenticationPort";
import { User } from "../../../../src/domain/auth/User";
import { UserId } from "../../../../src/domain/auth/UserId";
import { GoogleProfile } from "../../../../src/domain/auth/GoogleProfile";
import { EventPublisher } from "../../../../src/ports/output/EventPublisher";

describe("AuthenticationService", () => {
  let authService: AuthenticationService;
  let mockUserRepository: jest.Mocked<UserRepositoryPort>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    mockUserRepository = {
      findByGoogleId: jest.fn(),
      findById: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      existsByGoogleId: jest.fn(),
      count: jest.fn()
    };

    mockEventPublisher = {
      publish: jest.fn(),
      publishMany: jest.fn()
    };

    authService = new AuthenticationService(mockUserRepository, mockEventPublisher);
  });

  describe("authenticateWithGoogle", () => {
    const validGoogleProfile: GoogleProfile = {
      id: "google123",
      displayName: "Test User",
      emails: [{ value: "test@example.com" }],
      photos: [{ value: "http://example.com/photo.jpg" }]
    };

    it("should authenticate existing user and update profile", async () => {
      const existingUser = new User(
        new UserId("1"),
        "google123",
        "Old Name",
        "old@example.com",
        "old-photo.jpg"
      );

      const updatedUser = new User(
        new UserId("1"),
        "google123",
        "Test User",
        "old@example.com",
        "http://example.com/photo.jpg"
      );

      mockUserRepository.findByGoogleId.mockResolvedValue(existingUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await authService.authenticateWithGoogle(validGoogleProfile);

      expect(mockUserRepository.findByGoogleId).toHaveBeenCalledWith("google123");
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          displayName: "Test User",
          picture: "http://example.com/photo.jpg"
        })
      );
      expect(result).toBe(updatedUser);
      expect(mockEventPublisher.publish).not.toHaveBeenCalled(); // No event for existing user
    });

    it("should create new user when not found", async () => {
      const newUser = new User(
        new UserId("2"),
        "google123",
        "Test User",
        "test@example.com",
        "http://example.com/photo.jpg"
      );

      mockUserRepository.findByGoogleId.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(newUser);

      const result = await authService.authenticateWithGoogle(validGoogleProfile);

      expect(mockUserRepository.findByGoogleId).toHaveBeenCalledWith("google123");
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          googleId: "google123",
          displayName: "Test User",
          email: "test@example.com",
          picture: "http://example.com/photo.jpg"
        })
      );
      expect(result).toBe(newUser);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: "UserRegistered",
          user: newUser
        })
      );
    });

    it("should handle profile without email", async () => {
      const profileWithoutEmail: GoogleProfile = {
        id: "google456",
        displayName: "No Email User",
        photos: [{ value: "http://example.com/photo.jpg" }]
      };

      const newUser = new User(
        new UserId("3"),
        "google456",
        "No Email User",
        undefined,
        "http://example.com/photo.jpg"
      );

      mockUserRepository.findByGoogleId.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(newUser);

      const result = await authService.authenticateWithGoogle(profileWithoutEmail);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          email: undefined
        })
      );
      expect(result).toBe(newUser);
    });

    it("should handle profile without photo", async () => {
      const profileWithoutPhoto: GoogleProfile = {
        id: "google789",
        displayName: "No Photo User",
        emails: [{ value: "nophoto@example.com" }]
      };

      const newUser = new User(
        new UserId("4"),
        "google789",
        "No Photo User",
        "nophoto@example.com",
        undefined
      );

      mockUserRepository.findByGoogleId.mockResolvedValue(null);
      mockUserRepository.save.mockResolvedValue(newUser);

      const result = await authService.authenticateWithGoogle(profileWithoutPhoto);

      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          picture: undefined
        })
      );
      expect(result).toBe(newUser);
    });

    it("should throw AuthenticationException when repository fails", async () => {
      const repositoryError = new UserRepositoryException(
        UserRepositoryError.DATABASE_ERROR,
        "Database connection failed"
      );

      mockUserRepository.findByGoogleId.mockRejectedValue(repositoryError);

      await expect(authService.authenticateWithGoogle(validGoogleProfile))
        .rejects.toThrow(AuthenticationException);

      await expect(authService.authenticateWithGoogle(validGoogleProfile))
        .rejects.toThrow("Repository error during authentication");
    });

    it("should validate Google profile", async () => {
      const invalidProfile = {
        id: "",
        displayName: "Test User"
      } as GoogleProfile;

      await expect(authService.authenticateWithGoogle(invalidProfile))
        .rejects.toThrow(AuthenticationException);

      await expect(authService.authenticateWithGoogle(invalidProfile))
        .rejects.toThrow("Invalid Google profile");
    });
  });

  describe("serializeUser", () => {
    it("should serialize user to ID string", async () => {
      const user = new User(
        new UserId("123"),
        "google123",
        "Test User",
        "test@example.com"
      );

      const result = await authService.serializeUser(user);
      expect(result).toBe("123");
    });

    it("should throw error for invalid user", async () => {
      await expect(authService.serializeUser(null as any))
        .rejects.toThrow(AuthenticationException);

      await expect(authService.serializeUser(null as any))
        .rejects.toThrow("Cannot serialize invalid user");
    });
  });

  describe("deserializeUser", () => {
    it("should deserialize user from ID string", async () => {
      const user = new User(
        new UserId("123"),
        "google123",
        "Test User",
        "test@example.com"
      );

      mockUserRepository.findById.mockResolvedValue(user);

      const result = await authService.deserializeUser("123");
      expect(result).toBe(user);
      expect(mockUserRepository.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          value: "123"
        })
      );
    });

    it("should return null when user not found", async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      const result = await authService.deserializeUser("999");
      expect(result).toBeNull();
    });

    it("should throw error for invalid ID", async () => {
      await expect(authService.deserializeUser(""))
        .rejects.toThrow(AuthenticationException);

      await expect(authService.deserializeUser(""))
        .rejects.toThrow("Invalid user ID for deserialization");
    });

    it("should handle repository errors", async () => {
      const repositoryError = new UserRepositoryException(
        UserRepositoryError.DATABASE_ERROR,
        "Database error"
      );

      mockUserRepository.findById.mockRejectedValue(repositoryError);

      await expect(authService.deserializeUser("123"))
        .rejects.toThrow(AuthenticationException);
    });
  });
});