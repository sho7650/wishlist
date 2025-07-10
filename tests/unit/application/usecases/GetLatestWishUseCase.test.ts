import { GetLatestWishesUseCase } from "../../../../src/application/usecases/GetLatestWishesUseCase";
import { Wish } from "../../../../src/domain/entities/Wish";

// モック
const mockWishRepository = {
  save: jest.fn(),
  findById: jest.fn(),
  findBySessionId: jest.fn(),
  findLatest: jest.fn(),
  findByUserId: jest.fn(), // ユーザーIDで探すメソッドを追加
};

describe("GetLatestWishesUseCase", () => {
  let getLatestWishesUseCase: GetLatestWishesUseCase;

  beforeEach(() => {
    jest.clearAllMocks();
    getLatestWishesUseCase = new GetLatestWishesUseCase(mockWishRepository);
  });

  it("should get latest wishes with default limit", async () => {
    // モックの戻り値設定
    const mockWishes = [
      new Wish({ id: "1", wish: "願い事1", createdAt: new Date() }),
      new Wish({ id: "2", wish: "願い事2", createdAt: new Date() }),
    ];
    mockWishRepository.findLatest.mockResolvedValue(mockWishes);

    // 実行
    const result = await getLatestWishesUseCase.execute();

    // 検証
    expect(mockWishRepository.findLatest).toHaveBeenCalledWith(20, 0);
    expect(result).toEqual(mockWishes);
    expect(result.length).toBe(2);
  });

  it("should get latest wishes with custom limit and offset", async () => {
    // モックの戻り値設定
    const mockWishes = [
      new Wish({ id: "3", wish: "願い事3", createdAt: new Date() }),
    ];
    mockWishRepository.findLatest.mockResolvedValue(mockWishes);

    // 実行
    const result = await getLatestWishesUseCase.execute(10, 20);

    // 検証
    expect(mockWishRepository.findLatest).toHaveBeenCalledWith(10, 20);
    expect(result).toEqual(mockWishes);
    expect(result.length).toBe(1);
  });

  it("should return empty array when no wishes found", async () => {
    // 空の配列を返すようにモック設定
    mockWishRepository.findLatest.mockResolvedValue([]);

    // 実行
    const result = await getLatestWishesUseCase.execute();

    // 検証
    expect(result).toEqual([]);
    expect(result.length).toBe(0);
  });
});
