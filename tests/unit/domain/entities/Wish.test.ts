import { Wish } from "../../../../src/domain/entities/Wish";

describe("Wish Entity", () => {
  it("should create a new wish with provided values", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    const name = "テスト太郎";
    const wishText = "テストの願い事";
    const createdAt = new Date("2025-01-01");

    const wish = new Wish({
      id,
      name,
      wish: wishText,
      createdAt,
    });

    expect(wish.id).toBe(id);
    expect(wish.name).toBe(name);
    expect(wish.wish).toBe(wishText);
    expect(wish.createdAt).toEqual(createdAt);
  });

  it("should create a new wish with default values when not provided", () => {
    const wishText = "テストの願い事";
    const wish = new Wish({ wish: wishText });

    expect(wish.id).toBeDefined();
    expect(wish.id.length).toBeGreaterThan(0);
    expect(wish.name).toBeUndefined();
    expect(wish.wish).toBe(wishText);
    expect(wish.createdAt).toBeInstanceOf(Date);
  });

  it("should convert string createdAt to Date object", () => {
    const dateStr = "2025-01-01T00:00:00.000Z";
    const wish = new Wish({
      wish: "テスト",
      createdAt: dateStr,
    });

    expect(wish.createdAt).toBeInstanceOf(Date);
    expect(wish.createdAt.toISOString()).toBe(dateStr);
  });

  it("should update wish properties correctly", () => {
    const originalWish = new Wish({
      id: "123",
      name: "元の名前",
      wish: "元の願い事",
      createdAt: new Date("2025-01-01"),
    });

    const updatedWish = originalWish.update("新しい名前", "新しい願い事");

    // IDと作成日は変わらないことを確認
    expect(updatedWish.id).toBe(originalWish.id);
    expect(updatedWish.createdAt).toEqual(originalWish.createdAt);

    // 名前と願い事は更新されていることを確認
    expect(updatedWish.name).toBe("新しい名前");
    expect(updatedWish.wish).toBe("新しい願い事");
  });

  it("should keep original values when update parameters are undefined", () => {
    const originalWish = new Wish({
      id: "123",
      name: "元の名前",
      wish: "元の願い事",
      createdAt: new Date("2025-01-01"),
    });

    const updatedWish = originalWish.update(undefined, undefined);

    expect(updatedWish.name).toBe(originalWish.name);
    expect(updatedWish.wish).toBe(originalWish.wish);
  });

  describe("Validation", () => {
    // 名前のバリデーションテスト
    describe("Name Validation", () => {
      it("should throw an error if name is longer than MAX_NAME_LENGTH", () => {
        const longName = "a".repeat(Wish.MAX_NAME_LENGTH + 1); // 65文字
        const wishProps = { name: longName, wish: "A valid wish" };

        // new Wish() がエラーをスローすることを検証
        expect(() => new Wish(wishProps)).toThrow(
          `Name cannot be longer than ${Wish.MAX_NAME_LENGTH} characters.`
        );
      });

      it("should NOT throw an error if name is exactly MAX_NAME_LENGTH", () => {
        const validName = "a".repeat(Wish.MAX_NAME_LENGTH); // 64文字
        const wishProps = { name: validName, wish: "A valid wish" };

        // エラーがスローされないことを検証
        expect(() => new Wish(wishProps)).not.toThrow();
      });
    });

    // 願い事のバリデーションテスト
    describe("Wish Validation", () => {
      it("should throw an error if wish is shorter than MIN_WISH_LENGTH (empty)", () => {
        const emptyWish = "";
        const wishProps = { wish: emptyWish };

        expect(() => new Wish(wishProps)).toThrow(
          `Wish must have at least ${Wish.MIN_WISH_LENGTH} character.`
        );
      });

      it("should throw an error if wish is longer than MAX_WISH_LENGTH", () => {
        const longWish = "a".repeat(Wish.MAX_WISH_LENGTH + 1); // 241文字
        const wishProps = { wish: longWish };

        expect(() => new Wish(wishProps)).toThrow(
          `Wish cannot be longer than ${Wish.MAX_WISH_LENGTH} characters.`
        );
      });

      it("should NOT throw an error if wish length is within valid range", () => {
        const minLengthWish = "a".repeat(Wish.MIN_WISH_LENGTH); // 1文字
        const maxLengthWish = "a".repeat(Wish.MAX_WISH_LENGTH); // 240文字

        // 最小長と最大長のどちらもエラーにならないことを検証
        expect(() => new Wish({ wish: minLengthWish })).not.toThrow();
        expect(() => new Wish({ wish: maxLengthWish })).not.toThrow();
      });
    });

    // updateメソッドのバリデーションテスト
    describe("Update Method Validation", () => {
      it("should throw an error when updating with an invalid name", () => {
        const originalWish = new Wish({ wish: "Valid wish" });
        const invalidName = "a".repeat(Wish.MAX_NAME_LENGTH + 1);

        expect(() => originalWish.update(invalidName, "Valid wish")).toThrow(
          `Name cannot be longer than ${Wish.MAX_NAME_LENGTH} characters.`
        );
      });

      it("should throw an error when updating with an invalid wish", () => {
        const originalWish = new Wish({ wish: "Valid wish" });
        const invalidWish = "a".repeat(Wish.MAX_WISH_LENGTH + 1);

        expect(() => originalWish.update("Valid name", invalidWish)).toThrow(
          `Wish cannot be longer than ${Wish.MAX_WISH_LENGTH} characters.`
        );

        const emptyWish = "";
        expect(() => originalWish.update("Valid name", emptyWish)).toThrow(
          `Wish must have at least ${Wish.MIN_WISH_LENGTH} character.`
        );
      });
    });
  });
});
