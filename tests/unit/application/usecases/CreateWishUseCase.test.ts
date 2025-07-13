import { CreateWishUseCase } from "../../../../src/application/usecases/CreateWishUseCase";
import { WishService } from "../../../../src/application/services/WishService";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { UserId } from "../../../../src/domain/value-objects/UserId";

// WishService をモック
const mockWishService = {
  createWish: jest.fn(),
  updateWish: jest.fn(),
  getLatestWishes: jest.fn(),
  getLatestWishesWithSupportStatus: jest.fn(),
  getWishBySession: jest.fn(),
  getUserWish: jest.fn(),
} as unknown as jest.Mocked<WishService>;

describe("CreateWishUseCase", () => {
  let createWishUseCase: CreateWishUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    createWishUseCase = new CreateWishUseCase(mockWishService);
  });

  it("should create a new wish successfully", async () => {
    const name = "テスト太郎";
    const wishText = "テストの願い事";
    const sessionId = "test-session-id";
    
    const expectedWish = Wish.create({
      id: WishId.generate(),
      content: WishContent.fromString(wishText),
      authorId: UserId.fromNumber(1),
      name
    });

    const expectedResult = { wish: expectedWish, sessionId };
    mockWishService.createWish.mockResolvedValue(expectedResult);

    const result = await createWishUseCase.execute(name, wishText, sessionId);

    expect(mockWishService.createWish).toHaveBeenCalledWith(name, wishText, sessionId, undefined);
    expect(result).toEqual(expectedResult);
  });

  it("should create a wish for authenticated user", async () => {
    const name = "認証ユーザー";
    const wishText = "認証ユーザーの願い事";
    const userId = 123;
    
    const expectedWish = Wish.create({
      id: WishId.generate(),
      content: WishContent.fromString(wishText),
      authorId: UserId.fromNumber(userId),
      name
    });

    const expectedResult = { wish: expectedWish, sessionId: "generated-session" };
    mockWishService.createWish.mockResolvedValue(expectedResult);

    const result = await createWishUseCase.execute(name, wishText, undefined, userId);

    expect(mockWishService.createWish).toHaveBeenCalledWith(name, wishText, undefined, userId);
    expect(result).toEqual(expectedResult);
  });

  it("should handle anonymous user creation", async () => {
    const wishText = "匿名ユーザーの願い事";
    
    const expectedWish = Wish.create({
      id: WishId.generate(),
      content: WishContent.fromString(wishText),
      authorId: UserId.fromNumber(1) // This would be SessionId in real scenario
    });

    const expectedResult = { wish: expectedWish, sessionId: "auto-generated-session" };
    mockWishService.createWish.mockResolvedValue(expectedResult);

    const result = await createWishUseCase.execute(undefined, wishText);

    expect(mockWishService.createWish).toHaveBeenCalledWith(undefined, wishText, undefined, undefined);
    expect(result).toEqual(expectedResult);
  });

  it("should propagate errors from WishService", async () => {
    const error = new Error("既に投稿済みです");
    mockWishService.createWish.mockRejectedValue(error);

    await expect(
      createWishUseCase.execute("名前", "願い事", "session-id")
    ).rejects.toThrow("既に投稿済みです");

    expect(mockWishService.createWish).toHaveBeenCalledWith("名前", "願い事", "session-id", undefined);
  });

  it("should handle business rule violations", async () => {
    const error = new Error("無効な願い事の内容です");
    mockWishService.createWish.mockRejectedValue(error);

    await expect(
      createWishUseCase.execute("名前", "", "session-id")
    ).rejects.toThrow("無効な願い事の内容です");
  });

  it("should pass all parameters correctly to WishService", async () => {
    const name = "完全なテスト";
    const wishText = "完全なテストの願い事";
    const sessionId = "complete-session-id";
    const userId = 456;

    mockWishService.createWish.mockResolvedValue({
      wish: Wish.create({
        id: WishId.generate(),
        content: WishContent.fromString(wishText),
        authorId: UserId.fromNumber(userId),
        name
      }),
      sessionId
    });

    await createWishUseCase.execute(name, wishText, sessionId, userId);

    expect(mockWishService.createWish).toHaveBeenCalledWith(name, wishText, sessionId, userId);
    expect(mockWishService.createWish).toHaveBeenCalledTimes(1);
  });
});