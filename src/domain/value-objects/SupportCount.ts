export class SupportCount {
  private readonly _value: number;

  constructor(value: number) {
    if (value < 0) {
      throw new Error("SupportCount cannot be negative");
    }
    this._value = value;
  }

  static zero(): SupportCount {
    return new SupportCount(0);
  }

  static fromNumber(value: number): SupportCount {
    return new SupportCount(value);
  }

  increment(): SupportCount {
    return new SupportCount(this._value + 1);
  }

  decrement(): SupportCount {
    if (this._value === 0) {
      throw new Error("Cannot decrement SupportCount below zero");
    }
    return new SupportCount(this._value - 1);
  }

  get value(): number {
    return this._value;
  }

  equals(other: SupportCount): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value.toString();
  }
}