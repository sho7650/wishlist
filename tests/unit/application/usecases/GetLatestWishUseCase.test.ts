import { GetLatestWishesUseCase } from "../../../../src/application/usecases/GetLatestWishesUseCase";
import { WishRepository } from "../../../../src/ports/output/WishRepository";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";
import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";

describe("GetLatestWishesUseCase", () => {
  let getLatestWishesUseCase: GetLatestWishesUseCase;
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
    getLatestWishesUseCase = new GetLatestWishesUseCase(mockWishRepository);
  });

  describe("execute", () => {
    it("should return latest wishes without support status", async () => {
      const mockWishes = [
        Wish.fromRepository({
          id: WishId.fromString("wish-1"),
          content: WishContent.fromString("First wish"),
          authorId: UserId.fromNumber(1),
          supportCount: SupportCount.fromNumber(3),
          supporters: new Set<string>(),
          createdAt: new Date("2025-01-02"),
        }),
        Wish.fromRepository({
          id: WishId.fromString("wish-2"),
          content: WishContent.fromString("Second wish"),
          authorId: SessionId.fromString("session-123"),
          supportCount: SupportCount.fromNumber(1),
          supporters: new Set<string>(),
          createdAt: new Date("2025-01-01"),
        }),
      ];

      mockWishRepository.findLatest.mockResolvedValue(mockWishes);

      const result = await getLatestWishesUseCase.execute(10, 0);

      expect(result).toEqual(mockWishes);
      expect(mockWishRepository.findLatest).toHaveBeenCalledWith(10, 0);
    });

    it("should use default limit and offset when not provided", async () => {
      mockWishRepository.findLatest.mockResolvedValue([]);

      await getLatestWishesUseCase.execute();

      expect(mockWishRepository.findLatest).toHaveBeenCalledWith(20, 0);
    });
  });

  describe("executeWithSupportStatus", () => {
    it("should return latest wishes with support status for authenticated user", async () => {
      const userId = 123;
      const mockWishes = [
        Wish.fromRepository({
          id: WishId.fromString("wish-1"),
          content: WishContent.fromString("First wish"),
          authorId: UserId.fromNumber(456),
          supportCount: SupportCount.fromNumber(5),
          supporters: new Set<string>(),
          createdAt: new Date("2025-01-02"),
          isSupported: true,
        }),
      ];

      mockWishRepository.findLatestWithSupportStatus.mockResolvedValue(mockWishes);

      const result = await getLatestWishesUseCase.executeWithSupportStatus(10, 0, undefined, userId);

      expect(result).toEqual(mockWishes);
      expect(mockWishRepository.findLatestWithSupportStatus).toHaveBeenCalledWith(
        10,
        0,
        undefined,
        UserId.fromNumber(userId)
      );
    });

    it("should return latest wishes with support status for session user", async () => {
      const sessionId = "test-session-id";
      const mockWishes = [
        Wish.fromRepository({
          id: WishId.fromString("wish-1"),
          content: WishContent.fromString("Session wish"),
          authorId: SessionId.fromString(sessionId),
          supportCount: SupportCount.fromNumber(2),
          supporters: new Set<string>(),
          createdAt: new Date("2025-01-01"),
          isSupported: false,
        }),
      ];

      mockWishRepository.findLatestWithSupportStatus.mockResolvedValue(mockWishes);

      const result = await getLatestWishesUseCase.executeWithSupportStatus(5, 10, sessionId, undefined);

      expect(result).toEqual(mockWishes);
      expect(mockWishRepository.findLatestWithSupportStatus).toHaveBeenCalledWith(
        5,
        10,
        SessionId.fromString(sessionId),
        undefined
      );
    });

    it("should handle both sessionId and userId", async () => {
      const sessionId = "test-session-id";
      const userId = 123;
      
      mockWishRepository.findLatestWithSupportStatus.mockResolvedValue([]);

      await getLatestWishesUseCase.executeWithSupportStatus(20, 0, sessionId, userId);

      expect(mockWishRepository.findLatestWithSupportStatus).toHaveBeenCalledWith(
        20,
        0,
        SessionId.fromString(sessionId),
        UserId.fromNumber(userId)
      );
    });

    it("should use default limit and offset for support status query", async () => {
      mockWishRepository.findLatestWithSupportStatus.mockResolvedValue([]);

      await getLatestWishesUseCase.executeWithSupportStatus();

      expect(mockWishRepository.findLatestWithSupportStatus).toHaveBeenCalledWith(
        20,
        0,
        undefined,
        undefined
      );
    });
  });
});