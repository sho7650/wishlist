import { GetWishBySessionUseCase } from "../../../../src/application/usecases/GetWishBySessionUseCase";
import { Wish } from "../../../../src/domain/entities/Wish";

// モック
const mockWishRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findBySessionId: jest.fn(),
  findLatest: jest.fn(),
  findByUserId: jest.fn(), // ユーザーIDで探すメソッドを追加
};

describe("GetWishBySessionUseCase", () => {
  let getWishBySessionUseCase: GetWishBySessionUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    getWishBySessionUseCase = new GetWishBySessionUseCase(mockWishRepository);
  });

  it("should get wish by session id", async () => {
    // モックの戻り値設定
    const mockWish = new Wish({
      id: "123",
      name: "テスト太郎",
      wish: "テストの願い事",
      createdAt: new Date(),
    });
    mockWishRepository.findBySessionId.mockResolvedValue(mockWish);

    // 実行
    const result = await getWishBySessionUseCase.execute("test-session-id");

    // 検証
    expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(
      "test-session-id"
    );
    expect(result).toEqual(mockWish);
  });

  it("should return null when no wish found for session", async () => {
    // セッションに対応する願い事がない場合
    mockWishRepository.findBySessionId.mockResolvedValue(null);

    // 実行
    const result = await getWishBySessionUseCase.execute(
      "non-existent-session-id"
    );

    // 検証
    expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(
      "non-existent-session-id"
    );
    expect(result).toBeNull();
  });
});
