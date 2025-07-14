import { AuthenticationPort, AuthenticationError, AuthenticationException } from "../../ports/AuthenticationPort";
import { UserRepositoryPort, UserRepositoryException } from "../../ports/UserRepositoryPort";
import { User } from "../../domain/auth/User";
import { UserId } from "../../domain/auth/UserId";
import { GoogleProfile, isGoogleProfile } from "../../domain/auth/GoogleProfile";
import { EventPublisher } from "../../ports/output/EventPublisher";
import { UserRegisteredEvent } from "../../domain/events/UserRegisteredEvent";

/**
 * Authentication service implementation
 * Orchestrates authentication operations using domain entities and repository
 */
export class AuthenticationService implements AuthenticationPort {
  constructor(
    private readonly userRepository: UserRepositoryPort,
    private readonly eventPublisher: EventPublisher
  ) {}

  async authenticateWithGoogle(profile: GoogleProfile): Promise<User> {
    try {
      // Validate Google profile
      if (!isGoogleProfile(profile)) {
        throw new AuthenticationException(
          AuthenticationError.INVALID_PROFILE,
          "Invalid Google profile"
        );
      }

      // Try to find existing user
      const existingUser = await this.userRepository.findByGoogleId(profile.id);

      if (existingUser) {
        // Update existing user's profile information
        const updatedUser = existingUser.updateProfile(
          profile.displayName,
          profile.photos && profile.photos.length > 0 ? profile.photos[0].value : undefined
        );
        
        return await this.userRepository.update(updatedUser);
      } else {
        // Create new user from Google profile
        const newUser = User.createFromGoogle(profile);
        const savedUser = await this.userRepository.save(newUser);
        
        // Publish domain event for new user registration
        await this.eventPublisher.publish(new UserRegisteredEvent(savedUser));
        
        return savedUser;
      }
    } catch (error) {
      if (error instanceof AuthenticationException) {
        throw error;
      }
      
      if (error instanceof UserRepositoryException) {
        throw new AuthenticationException(
          AuthenticationError.REPOSITORY_ERROR,
          "Repository error during authentication",
          error
        );
      }
      
      throw new AuthenticationException(
        AuthenticationError.INVALID_PROFILE,
        "Unexpected error during authentication",
        error as Error
      );
    }
  }

  async serializeUser(user: User): Promise<string> {
    try {
      if (!user || !(user instanceof User)) {
        throw new AuthenticationException(
          AuthenticationError.SERIALIZATION_ERROR,
          "Cannot serialize invalid user"
        );
      }
      
      return user.id.value;
    } catch (error) {
      if (error instanceof AuthenticationException) {
        throw error;
      }
      
      throw new AuthenticationException(
        AuthenticationError.SERIALIZATION_ERROR,
        "Error serializing user",
        error as Error
      );
    }
  }

  async deserializeUser(serializedUser: string): Promise<User | null> {
    try {
      if (!serializedUser || typeof serializedUser !== 'string' || serializedUser.trim().length === 0) {
        throw new AuthenticationException(
          AuthenticationError.SERIALIZATION_ERROR,
          "Invalid user ID for deserialization"
        );
      }

      const userId = new UserId(serializedUser);
      return await this.userRepository.findById(userId);
    } catch (error) {
      if (error instanceof AuthenticationException) {
        throw error;
      }
      
      if (error instanceof UserRepositoryException) {
        throw new AuthenticationException(
          AuthenticationError.REPOSITORY_ERROR,
          "Repository error during deserialization",
          error
        );
      }
      
      // UserId validation error
      if (error instanceof Error && error.message.includes("UserId")) {
        throw new AuthenticationException(
          AuthenticationError.SERIALIZATION_ERROR,
          "Invalid user ID for deserialization",
          error
        );
      }
      
      throw new AuthenticationException(
        AuthenticationError.SERIALIZATION_ERROR,
        "Unexpected error during deserialization",
        error as Error
      );
    }
  }
}