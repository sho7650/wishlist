import { Wish } from "../../../../src/domain/entities/Wish";
import { WishId } from "../../../../src/domain/value-objects/WishId";
import { WishContent } from "../../../../src/domain/value-objects/WishContent";
import { SupportCount } from "../../../../src/domain/value-objects/SupportCount";
import { UserId } from "../../../../src/domain/value-objects/UserId";
import { SessionId } from "../../../../src/domain/value-objects/SessionId";

describe("Wish Entity", () => {
  describe("Factory methods", () => {
    it("should create a new wish with Wish.create()", () => {
      const wishId = WishId.generate();
      const content = WishContent.fromString("テストの願い事");
      const authorId = UserId.fromNumber(1);
      const name = "テスト太郎";

      const wish = Wish.create({
        id: wishId,
        content,
        authorId,
        name
      });

      expect(wish.id).toBe(wishId.value);
      expect(wish.name).toBe(name);
      expect(wish.wish).toBe("テストの願い事");
      expect(wish.supportCount).toBe(0);
      expect(wish.createdAt).toBeInstanceOf(Date);
    });

    it("should create a wish from repository data with Wish.fromRepository()", () => {
      const wishId = WishId.fromString("123e4567-e89b-12d3-a456-426614174000");
      const content = WishContent.fromString("既存の願い事");
      const authorId = SessionId.fromString("session-123");
      const supportCount = SupportCount.fromNumber(5);
      const createdAt = new Date("2025-01-01");

      const wish = Wish.fromRepository({
        id: wishId,
        content,
        authorId,
        name: "テスト太郎",
        supportCount,
        supporters: new Set(["user_1", "session_abc"]),
        createdAt,
        isSupported: true
      });

      expect(wish.id).toBe(wishId.value);
      expect(wish.wish).toBe("既存の願い事");
      expect(wish.name).toBe("テスト太郎");
      expect(wish.supportCount).toBe(5);
      expect(wish.createdAt).toEqual(createdAt);
      expect(wish.isSupported).toBe(true);
    });
  });

  describe("Business logic", () => {
    let wish: Wish;
    let author: UserId;
    let otherUser: UserId;
    let sessionUser: SessionId;

    beforeEach(() => {
      author = UserId.fromNumber(1);
      otherUser = UserId.fromNumber(2);
      sessionUser = SessionId.fromString("session-123");
      
      wish = Wish.create({
        id: WishId.generate(),
        content: WishContent.fromString("テストの願い事"),
        authorId: author,
        name: "作者"
      });
    });

    describe("Support validation", () => {
      it("should prevent self-support", () => {
        const validation = wish.canSupport(author);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errorCode).toBe("SELF_SUPPORT_NOT_ALLOWED");
        expect(validation.errorMessage).toBe("作者は自分の願いに応援できません");
      });

      it("should allow support from other users", () => {
        const validation = wish.canSupport(otherUser);
        
        expect(validation.isValid).toBe(true);
        expect(validation.errorCode).toBeUndefined();
        expect(validation.errorMessage).toBeUndefined();
      });

      it("should allow support from session users", () => {
        const validation = wish.canSupport(sessionUser);
        
        expect(validation.isValid).toBe(true);
      });

      it("should prevent duplicate support", () => {
        // First support should be allowed
        expect(wish.canSupport(otherUser).isValid).toBe(true);
        
        // Add support
        wish.addSupport(otherUser);
        
        // Second support should be prevented
        const validation = wish.canSupport(otherUser);
        expect(validation.isValid).toBe(false);
        expect(validation.errorCode).toBe("ALREADY_SUPPORTED");
      });
    });

    describe("Support operations", () => {
      it("should add support correctly", () => {
        const originalCount = wish.supportCount;
        
        wish.addSupport(otherUser);
        
        expect(wish.supportCount).toBe(originalCount + 1);
        expect(wish.canSupport(otherUser).isValid).toBe(false);
      });

      it("should remove support correctly", () => {
        // Add support first
        wish.addSupport(otherUser);
        const countAfterAdd = wish.supportCount;
        
        // Remove support
        wish.removeSupport(otherUser);
        
        expect(wish.supportCount).toBe(countAfterAdd - 1);
        expect(wish.canSupport(otherUser).isValid).toBe(true);
      });

      it("should throw error when trying to remove non-existent support", () => {
        expect(() => wish.removeSupport(otherUser)).toThrow("応援していません");
      });
    });

    describe("Update functionality", () => {
      it("should update wish properties correctly", async () => {
        // Add a small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 1));
        
        const updatedWish = wish.update("新しい名前", "新しい願い事");
        
        // ID and other properties should remain the same
        expect(updatedWish.id).toBe(wish.id);
        expect(updatedWish.createdAt).toEqual(wish.createdAt);
        expect(updatedWish.supportCount).toBe(wish.supportCount);
        
        // Updated properties
        expect(updatedWish.name).toBe("新しい名前");
        expect(updatedWish.wish).toBe("新しい願い事");
        expect(updatedWish.updatedAt.getTime()).toBeGreaterThanOrEqual(wish.updatedAt.getTime());
      });

      it("should keep original values when update parameters are undefined", () => {
        const originalName = wish.name;
        const originalWish = wish.wish;
        
        const updatedWish = wish.update(undefined, undefined);
        
        expect(updatedWish.name).toBe(originalName);
        expect(updatedWish.wish).toBe(originalWish);
      });
    });

    describe("Author identification", () => {
      it("should correctly identify user authors", () => {
        // Test that the author cannot support their own wish
        expect(wish.canSupport(author).isValid).toBe(false);
        expect(wish.canSupport(author).errorCode).toBe("SELF_SUPPORT_NOT_ALLOWED");
        
        // Test that other users can support the wish
        expect(wish.canSupport(otherUser).isValid).toBe(true);
        expect(wish.canSupport(sessionUser).isValid).toBe(true);
      });

      it("should correctly identify session authors", () => {
        const sessionWish = Wish.create({
          id: WishId.generate(),
          content: WishContent.fromString("セッションユーザーの願い事"),
          authorId: sessionUser
        });

        // Test that the session author cannot support their own wish
        expect(sessionWish.canSupport(sessionUser).isValid).toBe(false);
        expect(sessionWish.canSupport(sessionUser).errorCode).toBe("SELF_SUPPORT_NOT_ALLOWED");
        
        // Test that other users can support the session wish
        expect(sessionWish.canSupport(author).isValid).toBe(true);
        expect(sessionWish.canSupport(otherUser).isValid).toBe(true);
      });
    });

    describe("JSON serialization", () => {
      it("should serialize to JSON correctly", () => {
        const json = wish.toJSON();
        
        expect(json).toHaveProperty('id');
        expect(json).toHaveProperty('name');
        expect(json).toHaveProperty('wish');
        expect(json).toHaveProperty('userId');
        expect(json).toHaveProperty('supportCount');
        expect(json).toHaveProperty('isSupported');
        expect(json).toHaveProperty('createdAt');
        expect(json).toHaveProperty('updatedAt');
        
        expect(json.wish).toBe("テストの願い事");
        expect(json.userId).toBe(1);
        expect(json.supportCount).toBe(0);
      });
    });
  });

  describe("Value Object validation", () => {
    it("should validate WishContent length", () => {
      const longContent = "a".repeat(241); // Over 240 characters
      
      expect(() => WishContent.fromString(longContent)).toThrow();
      expect(() => WishContent.fromString("")).toThrow();
    });

    it("should validate SupportCount cannot be negative", () => {
      expect(() => SupportCount.fromNumber(-1)).toThrow("SupportCount cannot be negative");
    });

    it("should validate WishId cannot be empty", () => {
      expect(() => WishId.fromString("")).toThrow("WishId cannot be empty");
      expect(() => WishId.fromString("   ")).toThrow("WishId cannot be empty");
    });
  });
});