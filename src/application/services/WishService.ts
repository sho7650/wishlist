import { Wish } from "../../domain/entities/Wish";
import { WishContent } from "../../domain/value-objects/WishContent";
import { WishId } from "../../domain/value-objects/WishId";
import { UserId } from "../../domain/value-objects/UserId";
import { SessionId } from "../../domain/value-objects/SessionId";
import { WishRepository } from "../../ports/output/WishRepository";
import { SessionService } from "../../ports/output/SessionService";
import { EventPublisher } from "../../ports/output/EventPublisher";
import { Logger } from "../../utils/Logger";

export class WishService {
  constructor(
    private wishRepository: WishRepository,
    private sessionService: SessionService,
    private eventPublisher: EventPublisher
  ) {}

  async createWish(
    name: string | undefined,
    wishText: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ wish: Wish; sessionId: string }> {
    const authorId = userId ? UserId.fromNumber(userId) : SessionId.fromString(sessionId || SessionId.generate().value);
    
    // Check for existing wish
    if (userId) {
      const existingWish = await this.wishRepository.findByUserId(UserId.fromNumber(userId));
      if (existingWish) throw new Error("既に投稿済みです。");
    } else {
      const sessionIdObj = SessionId.fromString(sessionId || SessionId.generate().value);
      const existingWish = await this.wishRepository.findBySessionId(sessionIdObj);
      if (existingWish) throw new Error("既に投稿済みです。");
    }

    const wishContent = WishContent.fromString(wishText);
    const wish = Wish.create({
      content: wishContent,
      authorId,
      name
    });

    await this.wishRepository.save(wish, userId);

    // Publish domain events
    const events = wish.getDomainEvents();
    await this.eventPublisher.publishMany(events);
    wish.clearDomainEvents();

    const newSessionId = sessionId || this.sessionService.generateSessionId();
    Logger.debug('[WISH_SERVICE] Linking session to wish', { newSessionId, wishId: wish.id });
    await this.sessionService.linkSessionToWish(newSessionId, wish.id);

    return { wish, sessionId: newSessionId };
  }

  async updateWish(
    name: string | undefined,
    wishText: string,
    userId?: number,
    sessionId?: string
  ): Promise<void> {
    let wish: Wish | null = null;

    if (userId) {
      wish = await this.wishRepository.findByUserId(UserId.fromNumber(userId));
    } else if (sessionId) {
      wish = await this.wishRepository.findBySessionId(SessionId.fromString(sessionId));
    }

    if (!wish) {
      throw new Error("投稿が見つかりません");
    }

    const updatedWish = wish.update(name, wishText);
    await this.wishRepository.save(updatedWish, userId);
  }

  async getLatestWishes(limit: number, offset: number = 0): Promise<Wish[]> {
    return await this.wishRepository.findLatest(limit, offset);
  }

  async getLatestWishesWithSupportStatus(
    limit: number,
    offset: number = 0,
    sessionId?: string,
    userId?: number
  ): Promise<Wish[]> {
    const sessionIdObj = sessionId ? SessionId.fromString(sessionId) : undefined;
    const userIdObj = userId ? UserId.fromNumber(userId) : undefined;
    return await this.wishRepository.findLatestWithSupportStatus(limit, offset, sessionIdObj, userIdObj);
  }

  async getWishBySession(sessionId: string): Promise<Wish | null> {
    return await this.wishRepository.findBySessionId(SessionId.fromString(sessionId));
  }

  async getUserWish(userId?: number, sessionId?: string): Promise<Wish | null> {
    if (userId) {
      return await this.wishRepository.findByUserId(UserId.fromNumber(userId));
    } else if (sessionId) {
      return await this.wishRepository.findBySessionId(SessionId.fromString(sessionId));
    }
    return null;
  }
}