export class WishId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("WishId cannot be empty");
    }
    this._value = value;
  }

  static generate(): WishId {
    return new WishId(crypto.randomUUID());
  }

  static fromString(value: string): WishId {
    return new WishId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: WishId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}