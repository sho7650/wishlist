import { SupportWishUseCase } from "../../../../src/application/usecases/SupportWishUseCase";
import { WishRepository } from "../../../../src/domain/repositories/WishRepository";

describe("SupportWishUseCase", () => {
  let supportWishUseCase: SupportWishUseCase;
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

    supportWishUseCase = new SupportWishUseCase(mockWishRepository);
  });

  describe("execute", () => {
    it("should add support when not already supported", async () => {
      const wishId = "wish-123";
      const sessionId = "session-123";
      const userId = 1;

      mockWishRepository.hasSupported.mockResolvedValue(false);
      mockWishRepository.addSupport.mockResolvedValue();

      const result = await supportWishUseCase.execute(wishId, sessionId, userId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, sessionId, userId);
      expect(mockWishRepository.addSupport).toHaveBeenCalledWith(wishId, sessionId, userId);
      expect(result).toEqual({ success: true, alreadySupported: false });
    });

    it("should not add support when already supported", async () => {
      const wishId = "wish-123";
      const sessionId = "session-123";
      const userId = 1;

      mockWishRepository.hasSupported.mockResolvedValue(true);

      const result = await supportWishUseCase.execute(wishId, sessionId, userId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, sessionId, userId);
      expect(mockWishRepository.addSupport).not.toHaveBeenCalled();
      expect(result).toEqual({ success: false, alreadySupported: true });
    });

    it("should work with session ID only", async () => {
      const wishId = "wish-123";
      const sessionId = "session-123";

      mockWishRepository.hasSupported.mockResolvedValue(false);
      mockWishRepository.addSupport.mockResolvedValue();

      const result = await supportWishUseCase.execute(wishId, sessionId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, sessionId, undefined);
      expect(mockWishRepository.addSupport).toHaveBeenCalledWith(wishId, sessionId, undefined);
      expect(result).toEqual({ success: true, alreadySupported: false });
    });

    it("should work with user ID only", async () => {
      const wishId = "wish-123";
      const userId = 1;

      mockWishRepository.hasSupported.mockResolvedValue(false);
      mockWishRepository.addSupport.mockResolvedValue();

      const result = await supportWishUseCase.execute(wishId, undefined, userId);

      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(wishId, undefined, userId);
      expect(mockWishRepository.addSupport).toHaveBeenCalledWith(wishId, undefined, userId);
      expect(result).toEqual({ success: true, alreadySupported: false });
    });
  });
});