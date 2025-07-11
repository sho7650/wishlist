import { UpdateWishUseCase } from "../../../../src/application/usecases/UpdateWishUseCase";
import { Wish } from "../../../../src/domain/entities/Wish";

// モック
const mockWishRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findBySessionId: jest.fn(),
  findLatest: jest.fn(),
  findLatestWithSupportStatus: jest.fn(),
  findByUserId: jest.fn(), // ユーザーIDで探すメソッドを追加
  addSupport: jest.fn(),
  removeSupport: jest.fn(),
  hasSupported: jest.fn(),
};

const mockSessionService = {
  generateSessionId: jest.fn(),
  linkSessionToWish: jest.fn(),
  getWishIdBySession: jest.fn(),
};

describe("UpdateWishUseCase", () => {
  let updateWishUseCase: UpdateWishUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    updateWishUseCase = new UpdateWishUseCase(mockWishRepository);
  });

  it("should update an existing wish", async () => {
    // 既存の願い事をモック
    const existingWish = new Wish({
      id: "123",
      name: "元の名前",
      wish: "元の願い事",
      createdAt: new Date(),
    });
    mockWishRepository.findBySessionId.mockResolvedValue(existingWish);

    // 実行
    const newName = "新しい名前";
    const newWishText = "新しい願い事";
    const newUserId = 1; // ユーザーIDを追加
    await updateWishUseCase.execute(
      newName,
      newWishText,
      newUserId,
      "test-session-id"
    );

    // 検証
    expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(
      "test-session-id"
    );
    expect(mockWishRepository.save).toHaveBeenCalledTimes(1);

    // 保存されたwishオブジェクトを検証
    const savedWish = mockWishRepository.save.mock.calls[0][0];
    expect(savedWish.id).toBe(existingWish.id);
    expect(savedWish.name).toBe(newName);
    expect(savedWish.wish).toBe(newWishText);
    expect(savedWish.createdAt).toEqual(existingWish.createdAt);
  });

  it("should throw error when wish not found", async () => {
    // 願い事が見つからない状態をモック
    mockWishRepository.findBySessionId.mockResolvedValue(null);

    // 実行と検証
    await expect(
      updateWishUseCase.execute("invalid-session-id", "名前")
    ).rejects.toThrow("投稿が見つかりません");

    expect(mockWishRepository.save).not.toHaveBeenCalled();
  });
});
