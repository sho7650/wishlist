export class SessionId {
  private readonly _value: string;
  public readonly type = 'session';

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new Error("SessionId cannot be empty");
    }
    this._value = value;
  }

  static generate(): SessionId {
    return new SessionId(crypto.randomUUID());
  }

  static fromString(value: string): SessionId {
    return new SessionId(value);
  }

  get value(): string {
    return this._value;
  }

  equals(other: SessionId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}