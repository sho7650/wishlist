export class UserId {
  private readonly _value: number;
  public readonly type = 'user';

  constructor(value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error("UserId must be a positive integer");
    }
    this._value = value;
  }

  static fromNumber(value: number): UserId {
    return new UserId(value);
  }

  get value(): number {
    return this._value;
  }

  equals(other: UserId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value.toString();
  }
}