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
});
