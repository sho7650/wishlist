import { CreateWishUseCase } from "../../../../src/application/usecases/CreateWishUseCase";
import { Wish } from "../../../../src/domain/entities/Wish";

// モック
const mockWishRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findBySessionId: jest.fn(),
  findLatest: jest.fn(),
  findByUserId: jest.fn(), // ユーザーIDで探すメソッドを追加
};

const mockSessionService = {
  generateSessionId: jest.fn(),
  linkSessionToWish: jest.fn(),
  getWishIdBySession: jest.fn(),
};

describe("CreateWishUseCase", () => {
  let createWishUseCase: CreateWishUseCase;

  beforeEach(() => {
    // テストごとにモックをリセット
    jest.clearAllMocks();
    createWishUseCase = new CreateWishUseCase(
      mockWishRepository,
      mockSessionService
    );
  });

  it("should create a new wish successfully", async () => {
    // モックの設定
    const name = "テスト太郎";
    const wishText = "テストの願い事";
    const sessionId = "test-session-id";
    mockSessionService.generateSessionId.mockReturnValue(sessionId);

    // 実行
    const result = await createWishUseCase.execute(name, wishText);

    // 検証
    expect(mockWishRepository.save).toHaveBeenCalledTimes(1);
    expect(mockSessionService.linkSessionToWish).toHaveBeenCalledTimes(1);

    // 保存されたwishオブジェクトを検証
    const savedWish = mockWishRepository.save.mock.calls[0][0];
    expect(savedWish).toBeInstanceOf(Wish);
    expect(savedWish.name).toBe(name);
    expect(savedWish.wish).toBe(wishText);

    // 返り値を検証
    expect(result.sessionId).toBe(sessionId);
    expect(result.wish).toBeInstanceOf(Wish);
  });

  it("should throw error when user already has a wish", async () => {
    // 既存の投稿がある状態を設定
    const existingWish = new Wish({ wish: "既存の願い事" });
    mockWishRepository.findBySessionId.mockResolvedValue(existingWish);

    // 実行と検証
    await expect(
      createWishUseCase.execute("名前", "新しい願い事", "existing-session-id")
    ).rejects.toThrow("既に投稿済みです。");

    // save は呼ばれていないことを検証
    expect(mockWishRepository.save).not.toHaveBeenCalled();
  });

  // セッションIDが提供された場合のテストケース
  it("should use provided sessionId when available", async () => {
    // モックの設定
    mockWishRepository.findBySessionId.mockResolvedValue(null);

    // 実行
    const providedSessionId = "provided-session-id";
    await createWishUseCase.execute("名前", "願い事", providedSessionId);

    // 検証
    // findBySessionIdが呼ばれたことを確認
    expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(
      providedSessionId
    );

    // 新しいセッションIDが生成されないことを確認
    expect(mockSessionService.generateSessionId).not.toHaveBeenCalled();

    // 正しいセッションIDでリンクされることを確認
    expect(mockSessionService.linkSessionToWish).toHaveBeenCalledWith(
      providedSessionId,
      expect.any(String)
    );
  });
});
