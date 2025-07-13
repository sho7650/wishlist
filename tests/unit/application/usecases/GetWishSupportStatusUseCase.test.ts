import { GetWishSupportStatusUseCase } from "../../../../src/application/usecases/GetWishSupportStatusUseCase";
import { WishRepository } from "../../../../src/ports/output/WishRepository";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";
import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";

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
    it("should return wish and support status when wish exists and is supported", async () => {
      const wishId = "test-wish-id";
      const userId = 123;
      
      const mockWish = Wish.fromRepository({
        id: WishId.fromString(wishId),
        content: WishContent.fromString("Test wish"),
        authorId: UserId.fromNumber(456),
        supportCount: SupportCount.fromNumber(5),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockWishRepository.findById.mockResolvedValue(mockWish);
      mockWishRepository.hasSupported.mockResolvedValue(true);

      const result = await getWishSupportStatusUseCase.execute(wishId, undefined, userId);

      expect(result.isSupported).toBe(true);
      expect(result.wish).toBe(mockWish);
      expect(mockWishRepository.findById).toHaveBeenCalledWith(WishId.fromString(wishId));
      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(
        WishId.fromString(wishId),
        undefined,
        UserId.fromNumber(userId)
      );
    });

    it("should return wish and support status when wish exists and is not supported", async () => {
      const wishId = "test-wish-id";
      const sessionId = "test-session-id";
      
      const mockWish = Wish.fromRepository({
        id: WishId.fromString(wishId),
        content: WishContent.fromString("Another wish"),
        authorId: UserId.fromNumber(456),
        supportCount: SupportCount.fromNumber(2),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockWishRepository.findById.mockResolvedValue(mockWish);
      mockWishRepository.hasSupported.mockResolvedValue(false);

      const result = await getWishSupportStatusUseCase.execute(wishId, sessionId, undefined);

      expect(result.isSupported).toBe(false);
      expect(result.wish).toBe(mockWish);
      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(
        WishId.fromString(wishId),
        SessionId.fromString(sessionId),
        undefined
      );
    });

    it("should work with both userId and sessionId", async () => {
      const wishId = "test-wish-id";
      const sessionId = "test-session-id";
      const userId = 123;
      
      const mockWish = Wish.fromRepository({
        id: WishId.fromString(wishId),
        content: WishContent.fromString("Test wish"),
        authorId: UserId.fromNumber(456),
        supportCount: SupportCount.fromNumber(10),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockWishRepository.findById.mockResolvedValue(mockWish);
      mockWishRepository.hasSupported.mockResolvedValue(true);

      const result = await getWishSupportStatusUseCase.execute(wishId, sessionId, userId);

      expect(result.isSupported).toBe(true);
      expect(result.wish).toBe(mockWish);
      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(
        WishId.fromString(wishId),
        SessionId.fromString(sessionId),
        UserId.fromNumber(userId)
      );
    });

    it("should handle the case when wish does not exist", async () => {
      const wishId = "nonexistent-wish-id";
      const userId = 123;

      mockWishRepository.findById.mockResolvedValue(null);
      mockWishRepository.hasSupported.mockResolvedValue(false);

      const result = await getWishSupportStatusUseCase.execute(wishId, undefined, userId);

      expect(result.isSupported).toBe(false);
      expect(result.wish).toBeNull();
    });
  });
});