import { WishService } from "../../../../src/application/services/WishService";
import { WishRepository } from "../../../../src/ports/output/WishRepository";
import { SessionService } from "../../../../src/ports/output/SessionService";
import { EventPublisher } from "../../../../src/ports/output/EventPublisher";
import { Wish } from "../../../../src/domain/entities/Wish";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";
import { WishCreatedEvent } from "../../../../src/domain/events/WishCreatedEvent";

describe("WishService", () => {
  let wishService: WishService;
  let mockWishRepository: jest.Mocked<WishRepository>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    mockWishRepository = {
      save: jest.fn(),
      findByUserId: jest.fn(),
      findBySessionId: jest.fn(),
      findLatest: jest.fn(),
      findLatestWithSupportStatus: jest.fn(),
      findById: jest.fn(),
      addSupport: jest.fn(),
      removeSupport: jest.fn(),
      hasSupported: jest.fn()
    };

    mockSessionService = {
      generateSessionId: jest.fn(),
      linkSessionToWish: jest.fn(),
      getWishIdBySession: jest.fn()
    };

    mockEventPublisher = {
      publish: jest.fn(),
      publishMany: jest.fn()
    };

    wishService = new WishService(
      mockWishRepository,
      mockSessionService,
      mockEventPublisher
    );
  });

  describe("createWish", () => {
    it("should create wish for authenticated user", async () => {
      const userId = 123;
      const name = "Test User";
      const wishText = "I wish for world peace";
      const sessionId = "session-123";

      mockWishRepository.findByUserId.mockResolvedValue(null);
      mockSessionService.generateSessionId.mockReturnValue(sessionId);

      const mockWish = {
        id: "wish-123",
        content: WishContent.fromString(wishText),
        authorId: UserId.fromNumber(userId),
        name,
        getDomainEvents: jest.fn().mockReturnValue([new WishCreatedEvent(WishId.fromString("wish-123"), UserId.fromNumber(userId))]),
        clearDomainEvents: jest.fn()
      } as any;

      mockWishRepository.save.mockImplementation(async (wish) => {
        return mockWish;
      });

      const result = await wishService.createWish(name, wishText, undefined, userId);

      expect(mockWishRepository.findByUserId).toHaveBeenCalledWith(UserId.fromNumber(userId));
      expect(mockWishRepository.save).toHaveBeenCalledWith(expect.any(Object), userId);
      expect(mockEventPublisher.publishMany).toHaveBeenCalledWith(expect.any(Array));
      expect(mockSessionService.linkSessionToWish).toHaveBeenCalledWith(sessionId, expect.any(String));
      expect(result.wish.name).toBe(name);
      expect(result.wish.wish).toBe(wishText);
      expect(result.wish.userId).toBe(userId);
      expect(result.sessionId).toBe(sessionId);
    });

    it("should create wish for anonymous user with provided session", async () => {
      const name = "Anonymous User";
      const wishText = "I wish for happiness";
      const sessionId = "session-456";

      mockWishRepository.findBySessionId.mockResolvedValue(null);
      mockSessionService.generateSessionId.mockReturnValue(sessionId);

      const mockWish = {
        id: "wish-456",
        content: WishContent.fromString(wishText),
        authorId: SessionId.fromString(sessionId),
        name,
        getDomainEvents: jest.fn().mockReturnValue([]),
        clearDomainEvents: jest.fn()
      } as any;

      mockWishRepository.save.mockImplementation(async (wish) => {
        return mockWish;
      });

      const result = await wishService.createWish(name, wishText, sessionId);

      expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(SessionId.fromString(sessionId));
      expect(mockWishRepository.save).toHaveBeenCalledWith(expect.any(Object), undefined);
      expect(mockSessionService.linkSessionToWish).toHaveBeenCalledWith(sessionId, expect.any(String));
      expect(result.sessionId).toBe(sessionId);
    });

    it("should create wish for anonymous user without session", async () => {
      const name = "Anonymous User";
      const wishText = "I wish for love";
      const generatedSessionId = "generated-session-789";

      mockSessionService.generateSessionId.mockReturnValue(generatedSessionId);

      const mockWish = {
        id: "wish-789",
        content: WishContent.fromString(wishText),
        authorId: SessionId.fromString(generatedSessionId),
        name,
        getDomainEvents: jest.fn().mockReturnValue([]),
        clearDomainEvents: jest.fn()
      } as any;

      mockWishRepository.save.mockImplementation(async (wish) => {
        return mockWish;
      });

      const result = await wishService.createWish(name, wishText);

      expect(mockWishRepository.save).toHaveBeenCalledWith(expect.any(Object), undefined);
      expect(mockSessionService.linkSessionToWish).toHaveBeenCalledWith(generatedSessionId, expect.any(String));
      expect(result.sessionId).toBe(generatedSessionId);
    });

    it("should throw error if authenticated user already has a wish", async () => {
      const userId = 123;
      const existingWish = {
        id: "existing-wish",
        authorId: UserId.fromNumber(userId)
      } as any;

      mockWishRepository.findByUserId.mockResolvedValue(existingWish);

      await expect(
        wishService.createWish("Test User", "I wish for something", undefined, userId)
      ).rejects.toThrow("既に投稿済みです。");

      expect(mockWishRepository.save).not.toHaveBeenCalled();
    });

    it("should throw error if session already has a wish", async () => {
      const sessionId = "session-123";
      const existingWish = {
        id: "existing-wish",
        authorId: SessionId.fromString(sessionId)
      } as any;

      mockWishRepository.findBySessionId.mockResolvedValue(existingWish);

      await expect(
        wishService.createWish("Test User", "I wish for something", sessionId)
      ).rejects.toThrow("既に投稿済みです。");

      expect(mockWishRepository.save).not.toHaveBeenCalled();
    });

    it("should handle undefined name", async () => {
      const wishText = "Anonymous wish";
      const sessionId = "session-123";

      mockWishRepository.findBySessionId.mockResolvedValue(null);
      mockSessionService.generateSessionId.mockReturnValue(sessionId);

      const mockWish = {
        id: "wish-123",
        content: WishContent.fromString(wishText),
        authorId: SessionId.fromString(sessionId),
        name: undefined,
        getDomainEvents: jest.fn().mockReturnValue([]),
        clearDomainEvents: jest.fn()
      } as any;

      mockWishRepository.save.mockImplementation(async (wish) => {
        return mockWish;
      });

      const result = await wishService.createWish(undefined, wishText, sessionId);

      expect(result.wish.name).toBeUndefined();
    });
  });

  describe("updateWish", () => {
    it("should update wish for authenticated user", async () => {
      const userId = 123;
      const name = "Updated Name";
      const wishText = "Updated wish text";

      const existingWish = {
        id: "wish-123",
        update: jest.fn().mockReturnValue({
          id: "wish-123",
          name,
          wish: wishText
        })
      } as any;

      mockWishRepository.findByUserId.mockResolvedValue(existingWish);

      await wishService.updateWish(name, wishText, userId);

      expect(mockWishRepository.findByUserId).toHaveBeenCalledWith(UserId.fromNumber(userId));
      expect(existingWish.update).toHaveBeenCalledWith(name, wishText);
      expect(mockWishRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name, wish: wishText }),
        userId
      );
    });

    it("should update wish for session user", async () => {
      const sessionId = "session-123";
      const name = "Session Updated Name";
      const wishText = "Session updated wish text";

      const existingWish = {
        id: "wish-456",
        update: jest.fn().mockReturnValue({
          id: "wish-456",
          name,
          wish: wishText
        })
      } as any;

      mockWishRepository.findBySessionId.mockResolvedValue(existingWish);

      await wishService.updateWish(name, wishText, undefined, sessionId);

      expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(SessionId.fromString(sessionId));
      expect(existingWish.update).toHaveBeenCalledWith(name, wishText);
      expect(mockWishRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ name, wish: wishText }),
        undefined
      );
    });

    it("should throw error when wish not found for user", async () => {
      const userId = 123;
      mockWishRepository.findByUserId.mockResolvedValue(null);

      await expect(
        wishService.updateWish("New Name", "New wish", userId)
      ).rejects.toThrow("投稿が見つかりません");

      expect(mockWishRepository.save).not.toHaveBeenCalled();
    });

    it("should throw error when wish not found for session", async () => {
      const sessionId = "session-123";
      mockWishRepository.findBySessionId.mockResolvedValue(null);

      await expect(
        wishService.updateWish("New Name", "New wish", undefined, sessionId)
      ).rejects.toThrow("投稿が見つかりません");

      expect(mockWishRepository.save).not.toHaveBeenCalled();
    });

    it("should throw error when no user ID or session ID provided", async () => {
      await expect(
        wishService.updateWish("New Name", "New wish")
      ).rejects.toThrow("投稿が見つかりません");

      expect(mockWishRepository.findByUserId).not.toHaveBeenCalled();
      expect(mockWishRepository.findBySessionId).not.toHaveBeenCalled();
    });
  });

  describe("getLatestWishes", () => {
    it("should return latest wishes with default offset", async () => {
      const mockWishes = [
        { id: "wish-1", wish: "First wish" },
        { id: "wish-2", wish: "Second wish" }
      ] as any[];

      mockWishRepository.findLatest.mockResolvedValue(mockWishes);

      const result = await wishService.getLatestWishes(10);

      expect(mockWishRepository.findLatest).toHaveBeenCalledWith(10, 0);
      expect(result).toBe(mockWishes);
    });

    it("should return latest wishes with custom offset", async () => {
      const mockWishes = [
        { id: "wish-3", wish: "Third wish" },
        { id: "wish-4", wish: "Fourth wish" }
      ] as any[];

      mockWishRepository.findLatest.mockResolvedValue(mockWishes);

      const result = await wishService.getLatestWishes(5, 10);

      expect(mockWishRepository.findLatest).toHaveBeenCalledWith(5, 10);
      expect(result).toBe(mockWishes);
    });
  });

  describe("getLatestWishesWithSupportStatus", () => {
    it("should return wishes with support status for authenticated user", async () => {
      const userId = 123;
      const limit = 5;
      const offset = 0;

      const mockWishes = [
        { id: "wish-1", isSupported: true },
        { id: "wish-2", isSupported: false }
      ] as any[];

      mockWishRepository.findLatestWithSupportStatus.mockResolvedValue(mockWishes);

      const result = await wishService.getLatestWishesWithSupportStatus(limit, offset, undefined, userId);

      expect(mockWishRepository.findLatestWithSupportStatus).toHaveBeenCalledWith(
        limit,
        offset,
        undefined,
        UserId.fromNumber(userId)
      );
      expect(result).toBe(mockWishes);
    });

    it("should return wishes with support status for session user", async () => {
      const sessionId = "session-123";
      const limit = 10;
      const offset = 5;

      const mockWishes = [
        { id: "wish-3", isSupported: false },
        { id: "wish-4", isSupported: true }
      ] as any[];

      mockWishRepository.findLatestWithSupportStatus.mockResolvedValue(mockWishes);

      const result = await wishService.getLatestWishesWithSupportStatus(limit, offset, sessionId);

      expect(mockWishRepository.findLatestWithSupportStatus).toHaveBeenCalledWith(
        limit,
        offset,
        SessionId.fromString(sessionId),
        undefined
      );
      expect(result).toBe(mockWishes);
    });

    it("should return wishes with support status without user context", async () => {
      const limit = 3;
      const mockWishes = [{ id: "wish-1" }] as any[];

      mockWishRepository.findLatestWithSupportStatus.mockResolvedValue(mockWishes);

      const result = await wishService.getLatestWishesWithSupportStatus(limit);

      expect(mockWishRepository.findLatestWithSupportStatus).toHaveBeenCalledWith(
        limit,
        0,
        undefined,
        undefined
      );
      expect(result).toBe(mockWishes);
    });
  });

  describe("getWishBySession", () => {
    it("should return wish for valid session", async () => {
      const sessionId = "session-123";
      const mockWish = { id: "wish-123", authorId: SessionId.fromString(sessionId) } as any;

      mockWishRepository.findBySessionId.mockResolvedValue(mockWish);

      const result = await wishService.getWishBySession(sessionId);

      expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(SessionId.fromString(sessionId));
      expect(result).toBe(mockWish);
    });

    it("should return null for non-existent session", async () => {
      const sessionId = "non-existent-session";
      mockWishRepository.findBySessionId.mockResolvedValue(null);

      const result = await wishService.getWishBySession(sessionId);

      expect(result).toBeNull();
    });
  });

  describe("getUserWish", () => {
    it("should return wish for authenticated user", async () => {
      const userId = 123;
      const mockWish = { id: "wish-123", authorId: UserId.fromNumber(userId) } as any;

      mockWishRepository.findByUserId.mockResolvedValue(mockWish);

      const result = await wishService.getUserWish(userId);

      expect(mockWishRepository.findByUserId).toHaveBeenCalledWith(UserId.fromNumber(userId));
      expect(result).toBe(mockWish);
    });

    it("should return wish for session user", async () => {
      const sessionId = "session-123";
      const mockWish = { id: "wish-456", authorId: SessionId.fromString(sessionId) } as any;

      mockWishRepository.findBySessionId.mockResolvedValue(mockWish);

      const result = await wishService.getUserWish(undefined, sessionId);

      expect(mockWishRepository.findBySessionId).toHaveBeenCalledWith(SessionId.fromString(sessionId));
      expect(result).toBe(mockWish);
    });

    it("should return null when no user ID or session ID provided", async () => {
      const result = await wishService.getUserWish();

      expect(mockWishRepository.findByUserId).not.toHaveBeenCalled();
      expect(mockWishRepository.findBySessionId).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it("should return null when user not found", async () => {
      const userId = 999;
      mockWishRepository.findByUserId.mockResolvedValue(null);

      const result = await wishService.getUserWish(userId);

      expect(result).toBeNull();
    });

    it("should return null when session not found", async () => {
      const sessionId = "non-existent-session";
      mockWishRepository.findBySessionId.mockResolvedValue(null);

      const result = await wishService.getUserWish(undefined, sessionId);

      expect(result).toBeNull();
    });
  });
});