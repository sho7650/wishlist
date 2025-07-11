import { UnsupportWishUseCase } from "../../../../src/application/usecases/UnsupportWishUseCase";
import { WishRepository } from "../../../../src/domain/repositories/WishRepository";

describe("UnsupportWishUseCase", () => {
  let unsupportWishUseCase: UnsupportWishUseCase;
  let mockWishRepository: jest.Mocked<WishRepository>;

  beforeEach(() => {
    mockWishRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      findBySessionId: jest.fn(),
      findLatest: jest.fn(),
      addSupport: jest.fn(),
      removeSupport: jest.fn(),
      hasSupported: jest.fn(),
    };

    unsupportWishUseCase = new UnsupportWishUseCase(mockWishRepository);
  });

  describe("execute", () => {
    it("should remove support when already supported", async () => {
      const wishId = "wish-123";
      const sessionId = "session-123";
      const userId = 1;

      mockWishRepository.hasSupported.mockResolvedValue(true);
      mockWishRepository.removeSupport.mockResolvedValue();

      const result = await unsupportWishUseCase.execute(wishId, sessionId, userId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, sessionId, userId);
      expect(mockWishRepository.removeSupport).toHaveBeenCalledWith(wishId, sessionId, userId);
      expect(result).toEqual({ success: true, wasSupported: true });
    });

    it("should not remove support when not supported", async () => {
      const wishId = "wish-123";
      const sessionId = "session-123";
      const userId = 1;

      mockWishRepository.hasSupported.mockResolvedValue(false);

      const result = await unsupportWishUseCase.execute(wishId, sessionId, userId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, sessionId, userId);
      expect(mockWishRepository.removeSupport).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, wasSupported: false });
    });

    it("should work with session ID only", async () => {
      const wishId = "wish-123";
      const sessionId = "session-123";

      mockWishRepository.hasSupported.mockResolvedValue(true);
      mockWishRepository.removeSupport.mockResolvedValue();

      const result = await unsupportWishUseCase.execute(wishId, sessionId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, sessionId, undefined);
      expect(mockWishRepository.removeSupport).toHaveBeenCalledWith(wishId, sessionId, undefined);
      expect(result).toEqual({ success: true, wasSupported: true });
    });

    it("should work with user ID only", async () => {
      const wishId = "wish-123";
      const userId = 1;

      mockWishRepository.hasSupported.mockResolvedValue(true);
      mockWishRepository.removeSupport.mockResolvedValue();

      const result = await unsupportWishUseCase.execute(wishId, undefined, userId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, undefined, userId);
      expect(mockWishRepository.removeSupport).toHaveBeenCalledWith(wishId, undefined, userId);
      expect(result).toEqual({ success: true, wasSupported: true });
    });
  });
});