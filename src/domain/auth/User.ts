import { UserId } from "./UserId";
import { GoogleProfile } from "./GoogleProfile";

/**
 * User domain entity
 * Represents an authenticated user in the system
 */
export class User {
  private readonly _isNewUser: boolean;

  constructor(
    public readonly id: UserId,
    public readonly googleId: string,
    public readonly displayName: string,
    public readonly email?: string,
    public readonly picture?: string,
    isNewUser: boolean = false
  ) {
    if (!id) {
      throw new Error("User ID is required");
    }
    if (!googleId || googleId.trim().length === 0) {
      throw new Error("Google ID cannot be empty");
    }
    if (!displayName || displayName.trim().length === 0) {
      throw new Error("Display name cannot be empty");
    }
    
    this._isNewUser = isNewUser;
  }

  /**
   * Create a new User from Google OAuth profile
   * This user will be marked as new and will need to be persisted
   */
  static createFromGoogle(profile: GoogleProfile): User {
    const email = profile.emails && profile.emails.length > 0 
      ? profile.emails[0].value 
      : undefined;
    
    const picture = profile.photos && profile.photos.length > 0 
      ? profile.photos[0].value 
      : undefined;

    // Generate a temporary ID for new users - this will be replaced by the database
    const tempId = new UserId(`temp-${profile.id}-${Date.now()}`);

    return new User(
      tempId,
      profile.id,
      profile.displayName,
      email,
      picture,
      true // Mark as new user
    );
  }

  /**
   * Create an updated version of this user with new profile information
   */
  updateProfile(newDisplayName: string, newPicture?: string): User {
    if (!newDisplayName || newDisplayName.trim().length === 0) {
      throw new Error("Display name cannot be empty");
    }

    return new User(
      this.id,
      this.googleId,
      newDisplayName,
      this.email,
      newPicture !== undefined ? newPicture : this.picture,
      this._isNewUser
    );
  }

  /**
   * Check if two users are equal (based on ID)
   */
  equals(other: User): boolean {
    if (!other || !(other instanceof User)) {
      return false;
    }
    return this.id.equals(other.id);
  }

  /**
   * Check if this is a newly created user that hasn't been persisted yet
   */
  isNewUser(): boolean {
    return this._isNewUser;
  }

  /**
   * Create a persisted version of this user with a real database ID
   * Used after successful database insertion
   */
  withPersistedId(persistedId: UserId): User {
    return new User(
      persistedId,
      this.googleId,
      this.displayName,
      this.email,
      this.picture,
      false // No longer a new user
    );
  }

  /**
   * Get a plain object representation for serialization
   */
  toPlainObject(): {
    id: string;
    googleId: string;
    displayName: string;
    email?: string;
    picture?: string;
  } {
    return {
      id: this.id.value,
      googleId: this.googleId,
      displayName: this.displayName,
      email: this.email,
      picture: this.picture
    };
  }

  /**
   * Create User from plain object (e.g., from database)
   */
  static fromPlainObject(obj: {
    id: string;
    googleId: string;
    displayName: string;
    email?: string;
    picture?: string;
  }): User {
    return new User(
      new UserId(obj.id),
      obj.googleId,
      obj.displayName,
      obj.email,
      obj.picture,
      false // Loaded from database, not new
    );
  }
}