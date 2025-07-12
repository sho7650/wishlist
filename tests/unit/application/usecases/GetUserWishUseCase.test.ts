import { GetUserWishUseCase } from "../../../../src/application/usecases/GetUserWishUseCase";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishRepository } from "../../../../src/domain/repositories/WishRepository";

describe("GetUserWishUseCase", () => {
  let getUserWishUseCase: GetUserWishUseCase;
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
    getUserWishUseCase = new GetUserWishUseCase(mockWishRepository);
  });

  describe("execute", () => {
    it("should return wish when found by userId", async () => {
      // Arrange
      const userId = 123;
      const expectedWish = new Wish({
        id: "test-id",
        wish: "Test wish",
        userId: userId,
        createdAt: new Date(),
      });
      mockWishRepository.findByUserId.mockResolvedValue(expectedWish);

      // Act
      const result = await getUserWishUseCase.execute(userId);

      // Assert
      expect(mockWishRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(result).toBe(expectedWish);
    });

    it("should return wish when found by sessionId (when userId is not provided)", async () => {
      // Arrange
      const sessionId = "test-session-id";
      const expectedWish = new Wish({
        id: "test-id",
        wish: "Test wish",
        createdAt: new Date(),
      });
      mockWishRepository.findBySessionId.mockResolvedValue(expectedWish);

      // Act
      const result = await getUserWishUseCase.execute(undefined, sessionId);

      // Assert
      expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(sessionId);
      expect(result).toBe(expectedWish);
    });

    it("should fallback to sessionId when userId does not return a wish", async () => {
      // Arrange
      const userId = 123;
      const sessionId = "test-session-id";
      const expectedWish = new Wish({
        id: "test-id",
        wish: "Test wish",
        createdAt: new Date(),
      });
      mockWishRepository.findByUserId.mockResolvedValue(null);
      mockWishRepository.findBySessionId.mockResolvedValue(expectedWish);

      // Act
      const result = await getUserWishUseCase.execute(userId, sessionId);

      // Assert
      expect(mockWishRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(sessionId);
      expect(result).toBe(expectedWish);
    });

    it("should return null when no wish is found by userId or sessionId", async () => {
      // Arrange
      const userId = 123;
      const sessionId = "test-session-id";
      mockWishRepository.findByUserId.mockResolvedValue(null);
      mockWishRepository.findBySessionId.mockResolvedValue(null);

      // Act
      const result = await getUserWishUseCase.execute(userId, sessionId);

      // Assert
      expect(mockWishRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(sessionId);
      expect(result).toBeNull();
    });

    it("should return null when no userId or sessionId is provided", async () => {
      // Act
      const result = await getUserWishUseCase.execute();

      // Assert
      expect(mockWishRepository.findByUserId).not.toHaveBeenCalled();
      expect(mockWishRepository.findBySessionId).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should not call findBySessionId when userId returns a wish", async () => {
      // Arrange
      const userId = 123;
      const sessionId = "test-session-id";
      const expectedWish = new Wish({
        id: "test-id",
        wish: "Test wish",
        userId: userId,
        createdAt: new Date(),
      });
      mockWishRepository.findByUserId.mockResolvedValue(expectedWish);

      // Act
      const result = await getUserWishUseCase.execute(userId, sessionId);

      // Assert
      expect(mockWishRepository.findByUserId).toHaveBeenCalledWith(userId);
      expect(mockWishRepository.findBySessionId).not.toHaveBeenCalled();
      expect(result).toBe(expectedWish);
    });
  });
});