export class WishContent {
  private readonly _value: string;
  public static readonly MIN_LENGTH = 1;
  public static readonly MAX_LENGTH = 240;

  constructor(value: string) {
    if (!value || value.trim().length < WishContent.MIN_LENGTH) {
      throw new Error(`Wish content must have at least ${WishContent.MIN_LENGTH} character`);
    }
    if (value.length > WishContent.MAX_LENGTH) {
      throw new Error(`Wish content cannot be longer than ${WishContent.MAX_LENGTH} characters`);
    }
    this._value = value.trim();
  }

  static fromString(value: string): WishContent {
    return new WishContent(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: WishContent): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}