import { SupportWishUseCase } from "../../../../src/application/usecases/SupportWishUseCase";
import { WishRepository } from "../../../../src/ports/output/WishRepository";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";
import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";

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
      findLatestWithSupportStatus: jest.fn(),
      addSupport: jest.fn(),
      removeSupport: jest.fn(),
      hasSupported: jest.fn(),
    };
    supportWishUseCase = new SupportWishUseCase(mockWishRepository);
  });

  describe("execute", () => {
    it("should successfully add support when not already supported", async () => {
      const wishId = "test-wish-id";
      const userId = 123;
      
      const wish = Wish.fromRepository({
        id: WishId.fromString(wishId),
        content: WishContent.fromString("Test wish"),
        authorId: UserId.fromNumber(456), // Different user
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockWishRepository.hasSupported.mockResolvedValue(false);
      mockWishRepository.findById.mockResolvedValue(wish);
      mockWishRepository.addSupport.mockResolvedValue(undefined);

      const result = await supportWishUseCase.execute(wishId, undefined, userId);

      expect(result.success).toBe(true);
      expect(result.alreadySupported).toBe(false);
      expect(mockWishRepository.hasSupported).toHaveBeenCalledWith(
        WishId.fromString(wishId),
        undefined,
        UserId.fromNumber(userId)
      );
      expect(mockWishRepository.addSupport).toHaveBeenCalledWith(
        WishId.fromString(wishId),
        undefined,
        UserId.fromNumber(userId)
      );
    });

    it("should return early when already supported", async () => {
      const wishId = "test-wish-id";
      const userId = 123;

      mockWishRepository.hasSupported.mockResolvedValue(true);

      const result = await supportWishUseCase.execute(wishId, undefined, userId);

      expect(result.success).toBe(true);
      expect(result.alreadySupported).toBe(true);
      expect(mockWishRepository.findById).not.toHaveBeenCalled();
      expect(mockWishRepository.addSupport).not.toHaveBeenCalled();
    });

    it("should throw error when wish is not found", async () => {
      const wishId = "nonexistent-wish-id";
      const userId = 123;

      mockWishRepository.hasSupported.mockResolvedValue(false);
      mockWishRepository.findById.mockResolvedValue(null);

      await expect(
        supportWishUseCase.execute(wishId, undefined, userId)
      ).rejects.toThrow("願い事が見つかりません");
    });

    it("should throw error when trying to support own wish", async () => {
      const wishId = "test-wish-id";
      const userId = 123;
      
      const wish = Wish.fromRepository({
        id: WishId.fromString(wishId),
        content: WishContent.fromString("My own wish"),
        authorId: UserId.fromNumber(userId), // Same user
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockWishRepository.hasSupported.mockResolvedValue(false);
      mockWishRepository.findById.mockResolvedValue(wish);

      await expect(
        supportWishUseCase.execute(wishId, undefined, userId)
      ).rejects.toThrow("作者は自分の願いに応援できません");
    });

    it("should work with session ID for anonymous users", async () => {
      const wishId = "test-wish-id";
      const sessionId = "test-session-id";
      
      const wish = Wish.fromRepository({
        id: WishId.fromString(wishId),
        content: WishContent.fromString("Test wish"),
        authorId: UserId.fromNumber(456),
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockWishRepository.hasSupported.mockResolvedValue(false);
      mockWishRepository.findById.mockResolvedValue(wish);
      mockWishRepository.addSupport.mockResolvedValue(undefined);

      const result = await supportWishUseCase.execute(wishId, sessionId, undefined);

      expect(result.success).toBe(true);
      expect(result.alreadySupported).toBe(false);
      expect(mockWishRepository.addSupport).toHaveBeenCalledWith(
        WishId.fromString(wishId),
        SessionId.fromString(sessionId),
        undefined
      );
    });

    it("should prevent duplicate support with proper validation", async () => {
      const wishId = "test-wish-id";
      const userId = 123;
      
      const wish = Wish.fromRepository({
        id: WishId.fromString(wishId),
        content: WishContent.fromString("Test wish"),
        authorId: UserId.fromNumber(456),
        supportCount: SupportCount.fromNumber(1),
        supporters: new Set(["user_123"]),
        createdAt: new Date(),
      });

      mockWishRepository.hasSupported.mockResolvedValue(false); // Repository says not supported
      mockWishRepository.findById.mockResolvedValue(wish);

      // The wish entity itself should validate and prevent duplicate support
      await expect(
        supportWishUseCase.execute(wishId, undefined, userId)
      ).rejects.toThrow(); // Should throw validation error from domain
    });
  });
});