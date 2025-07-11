import { GetWishSupportStatusUseCase } from "../../../../src/application/usecases/GetWishSupportStatusUseCase";
import { WishRepository } from "../../../../src/domain/repositories/WishRepository";
import { Wish } from "../../../../src/domain/entities/Wish";

describe("GetWishSupportStatusUseCase", () => {
  let getWishSupportStatusUseCase: GetWishSupportStatusUseCase;
  let mockWishRepository: jest.Mocked<WishRepository>;

  beforeEach(() => {
    mockWishRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findBySessionId: jest.fn(),
      findLatest: jest.fn(),
      findLatestWithSupportStatus: jest.fn(),
      addSupport: jest.fn(),
      removeSupport: jest.fn(),
      hasSupported: jest.fn(),
    };

    getWishSupportStatusUseCase = new GetWishSupportStatusUseCase(mockWishRepository);
  });

  describe("execute", () => {
    it("should return support status and wish details", async () => {
      const wishId = "wish-123";
      const sessionId = "session-123";
      const userId = 1;

      const mockWish = new Wish({
        id: wishId,
        wish: "Test wish",
        supportCount: 5,
      });

      mockWishRepository.hasSupported.mockResolvedValue(true);
      mockWishRepository.findById.mockResolvedValue(mockWish);

      const result = await getWishSupportStatusUseCase.execute(wishId, sessionId, userId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, sessionId, userId);
      expect(mockWishRepository.findById).toHaveBeenCalledWith(wishId);
      expect(result).toEqual({
        isSupported: true,
        wish: mockWish,
      });
    });

    it("should return false when not supported", async () => {
      const wishId = "wish-123";
      const sessionId = "session-123";
      const userId = 1;

      const mockWish = new Wish({
        id: wishId,
        wish: "Test wish",
        supportCount: 2,
      });

      mockWishRepository.hasSupported.mockResolvedValue(false);
      mockWishRepository.findById.mockResolvedValue(mockWish);

      const result = await getWishSupportStatusUseCase.execute(wishId, sessionId, userId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, sessionId, userId);
      expect(mockWishRepository.findById).toHaveBeenCalledWith(wishId);
      expect(result).toEqual({
        isSupported: false,
        wish: mockWish,
      });
    });

    it("should work with session ID only", async () => {
      const wishId = "wish-123";
      const sessionId = "session-123";

      const mockWish = new Wish({
        id: wishId,
        wish: "Test wish",
        supportCount: 0,
      });

      mockWishRepository.hasSupported.mockResolvedValue(false);
      mockWishRepository.findById.mockResolvedValue(mockWish);

      const result = await getWishSupportStatusUseCase.execute(wishId, sessionId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, sessionId, undefined);
      expect(mockWishRepository.findById).toHaveBeenCalledWith(wishId);
      expect(result).toEqual({
        isSupported: false,
        wish: mockWish,
      });
    });

    it("should work with user ID only", async () => {
      const wishId = "wish-123";
      const userId = 1;

      const mockWish = new Wish({
        id: wishId,
        wish: "Test wish",
        supportCount: 10,
      });

      mockWishRepository.hasSupported.mockResolvedValue(true);
      mockWishRepository.findById.mockResolvedValue(mockWish);

      const result = await getWishSupportStatusUseCase.execute(wishId, undefined, userId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, undefined, userId);
      expect(mockWishRepository.findById).toHaveBeenCalledWith(wishId);
      expect(result).toEqual({
        isSupported: true,
        wish: mockWish,
      });
    });
  });
});