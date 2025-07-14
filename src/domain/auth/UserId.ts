/**
 * User ID value object
 * Represents a unique identifier for a user
 */
export class UserId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      throw new Error("UserId cannot be empty");
    }
    this._value = value.trim();
  }

  get value(): string {
    return this._value;
  }

  equals(other: UserId): boolean {
    if (!other || !(other instanceof UserId)) {
      return false;
    }
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  /**
   * Create UserId from a positive integer
   */
  static fromNumber(value: number): UserId {
    if (!Number.isInteger(value)) {
      throw new Error("UserId number must be an integer");
    }
    if (value <= 0) {
      throw new Error("UserId number must be positive");
    }
    return new UserId(value.toString());
  }
}