import { UnsupportWishUseCase } from "../../../../src/application/usecases/UnsupportWishUseCase";
import { WishRepository } from "../../../../src/ports/output/WishRepository";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";

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
      findLatestWithSupportStatus: jest.fn(),
      addSupport: jest.fn(),
      removeSupport: jest.fn(),
      hasSupported: jest.fn(),
    };
    unsupportWishUseCase = new UnsupportWishUseCase(mockWishRepository);
  });

  describe("execute", () => {
    it("should successfully remove support when previously supported", async () => {
      const wishId = "test-wish-id";
      const userId = 123;

      mockWishRepository.hasSupported.mockResolvedValue(true);
      mockWishRepository.removeSupport.mockResolvedValue(undefined);

      const result = await unsupportWishUseCase.execute(wishId, undefined, userId);

      expect(result.success).toBe(true);
      expect(result.wasSupported).toBe(true);
      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(
        WishId.fromString(wishId),
        undefined,
        UserId.fromNumber(userId)
      );
      expect(mockWishRepository.removeSupport).toHaveBeenCalledWith(
        WishId.fromString(wishId),
        undefined,
        UserId.fromNumber(userId)
      );
    });

    it("should return false when not previously supported", async () => {
      const wishId = "test-wish-id";
      const userId = 123;

      mockWishRepository.hasSupported.mockResolvedValue(false);

      const result = await unsupportWishUseCase.execute(wishId, undefined, userId);

      expect(result.success).toBe(false);
      expect(result.wasSupported).toBe(false);
      expect(mockWishRepository.removeSupport).not.toHaveBeenCalled();
    });

    it("should work with session ID for anonymous users", async () => {
      const wishId = "test-wish-id";
      const sessionId = "test-session-id";

      mockWishRepository.hasSupported.mockResolvedValue(true);
      mockWishRepository.removeSupport.mockResolvedValue(undefined);

      const result = await unsupportWishUseCase.execute(wishId, sessionId, undefined);

      expect(result.success).toBe(true);
      expect(result.wasSupported).toBe(true);
      expect(mockWishRepository.removeSupport).toHaveBeenCalledWith(
        WishId.fromString(wishId),
        SessionId.fromString(sessionId),
        undefined
      );
    });
  });
});