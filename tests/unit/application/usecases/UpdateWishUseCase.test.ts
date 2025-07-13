import { UpdateWishUseCase } from "../../../../src/application/usecases/UpdateWishUseCase";
import { WishRepository } from "../../../../src/ports/output/WishRepository";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";
import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";

describe("UpdateWishUseCase", () => {
  let updateWishUseCase: UpdateWishUseCase;
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
    updateWishUseCase = new UpdateWishUseCase(mockWishRepository);
  });

  describe("execute", () => {
    it("should successfully update a wish for authenticated user", async () => {
      const userId = 123;
      const existingWish = Wish.fromRepository({
        id: WishId.fromString("123"),
        content: WishContent.fromString("Original wish"),
        authorId: UserId.fromNumber(userId),
        name: "Original name",
        supportCount: SupportCount.fromNumber(5),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockWishRepository.findByUserId.mockResolvedValue(existingWish);
      mockWishRepository.save.mockResolvedValue(undefined);

      await updateWishUseCase.execute("Updated name", "Updated wish", userId, undefined);

      expect(mockWishRepository.findByUserId).toHaveBeenCalledWith(UserId.fromNumber(userId));
      expect(mockWishRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated name",
          wish: "Updated wish"
        }),
        userId
      );
    });

    it("should successfully update a wish for session user", async () => {
      const sessionId = "test-session-id";
      const existingWish = Wish.fromRepository({
        id: WishId.fromString("456"),
        content: WishContent.fromString("Original wish"),
        authorId: SessionId.fromString(sessionId),
        supportCount: SupportCount.fromNumber(2),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockWishRepository.findByUserId.mockResolvedValue(null);
      mockWishRepository.findBySessionId.mockResolvedValue(existingWish);
      mockWishRepository.save.mockResolvedValue(undefined);

      await updateWishUseCase.execute("Updated name", "Updated wish", undefined, sessionId);

      expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(SessionId.fromString(sessionId));
      expect(mockWishRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Updated name",
          wish: "Updated wish"
        }),
        undefined
      );
    });

    it("should throw error when no wish found to update", async () => {
      const userId = 123;
      mockWishRepository.findByUserId.mockResolvedValue(null);
      mockWishRepository.findBySessionId.mockResolvedValue(null);

      await expect(
        updateWishUseCase.execute("Name", "Wish", userId, "session-id")
      ).rejects.toThrow("更新対象の投稿が見つかりませんでした。");

      expect(mockWishRepository.save).not.toHaveBeenCalled();
    });

    it("should prioritize userId over sessionId", async () => {
      const userId = 123;
      const sessionId = "test-session-id";
      const userWish = Wish.fromRepository({
        id: WishId.fromString("user-wish"),
        content: WishContent.fromString("User wish"),
        authorId: UserId.fromNumber(userId),
        supportCount: SupportCount.fromNumber(0),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockWishRepository.findByUserId.mockResolvedValue(userWish);
      mockWishRepository.save.mockResolvedValue(undefined);

      await updateWishUseCase.execute("Updated", "Updated wish", userId, sessionId);

      expect(mockWishRepository.findByUserId).toHaveBeenCalledWith(UserId.fromNumber(userId));
      expect(mockWishRepository.findBySessionId).not.toHaveBeenCalled();
    });
  });
});