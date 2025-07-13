import { GetWishBySessionUseCase } from "../../../../src/application/usecases/GetWishBySessionUseCase";
import { WishRepository } from "../../../../src/ports/output/WishRepository";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";
import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";

describe("GetWishBySessionUseCase", () => {
  let getWishBySessionUseCase: GetWishBySessionUseCase;
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
    getWishBySessionUseCase = new GetWishBySessionUseCase(mockWishRepository);
  });

  describe("execute", () => {
    it("should return wish when found by session ID", async () => {
      const sessionId = "test-session-id";
      const expectedWish = Wish.fromRepository({
        id: WishId.fromString("test-wish-id"),
        content: WishContent.fromString("Session wish"),
        authorId: SessionId.fromString(sessionId),
        supportCount: SupportCount.fromNumber(3),
        supporters: new Set<string>(),
        createdAt: new Date(),
      });

      mockWishRepository.findBySessionId.mockResolvedValue(expectedWish);

      const result = await getWishBySessionUseCase.execute(sessionId);

      expect(result).toBe(expectedWish);
      expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(SessionId.fromString(sessionId));
    });

    it("should return null when no wish found for session ID", async () => {
      const sessionId = "nonexistent-session-id";
      mockWishRepository.findBySessionId.mockResolvedValue(null);

      const result = await getWishBySessionUseCase.execute(sessionId);

      expect(result).toBeNull();
      expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(SessionId.fromString(sessionId));
    });
  });
});