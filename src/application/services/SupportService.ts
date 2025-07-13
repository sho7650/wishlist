import { Wish } from "../../domain/entities/Wish";
import { WishId } from "../../domain/value-objects/WishId";
import { UserId } from "../../domain/value-objects/UserId";
import { SessionId } from "../../domain/value-objects/SessionId";
import { WishRepository } from "../../ports/output/WishRepository";
import { EventPublisher } from "../../ports/output/EventPublisher";

export interface SupportWishResult {
  success: boolean;
  alreadySupported: boolean;
}

export interface UnsupportWishResult {
  success: boolean;
  wasSupported: boolean;
}

export interface WishSupportStatusResult {
  isSupported: boolean;
  wish: Wish | null;
}

export class SupportService {
  constructor(
    private wishRepository: WishRepository,
    private eventPublisher: EventPublisher
  ) {}

  async supportWish(
    wishId: string,
    sessionId?: string,
    userId?: number
  ): Promise<SupportWishResult> {
    const wishIdObj = WishId.fromString(wishId);
    const wish = await this.wishRepository.findById(wishIdObj);
    
    if (!wish) {
      throw new Error("願い事が見つかりません");
    }

    const supporter = userId ? UserId.fromNumber(userId) : SessionId.fromString(sessionId!);
    
    // Check if already supported
    const validation = wish.canSupport(supporter);
    if (!validation.isValid) {
      if (validation.errorCode === "ALREADY_SUPPORTED") {
        return { success: true, alreadySupported: true };
      }
      throw new Error(validation.errorMessage || "応援できません");
    }

    try {
      wish.addSupport(supporter);
      await this.wishRepository.save(wish);
      
      // Publish domain events
      const events = wish.getDomainEvents();
      await this.eventPublisher.publishMany(events);
      wish.clearDomainEvents();

      return { success: true, alreadySupported: false };
    } catch (error) {
      if (error instanceof Error && error.message.includes("既に応援済み")) {
        return { success: true, alreadySupported: true };
      }
      throw error;
    }
  }

  async unsupportWish(
    wishId: string,
    sessionId?: string,
    userId?: number
  ): Promise<UnsupportWishResult> {
    const wishIdObj = WishId.fromString(wishId);
    const wish = await this.wishRepository.findById(wishIdObj);
    
    if (!wish) {
      throw new Error("願い事が見つかりません");
    }

    const supporter = userId ? UserId.fromNumber(userId) : SessionId.fromString(sessionId!);
    
    try {
      wish.removeSupport(supporter);
      await this.wishRepository.save(wish);
      
      // Publish domain events
      const events = wish.getDomainEvents();
      await this.eventPublisher.publishMany(events);
      wish.clearDomainEvents();

      return { success: true, wasSupported: true };
    } catch (error) {
      if (error instanceof Error && error.message.includes("応援していません")) {
        return { success: false, wasSupported: false };
      }
      throw error;
    }
  }

  async getWishSupportStatus(
    wishId: string,
    sessionId?: string,
    userId?: number
  ): Promise<WishSupportStatusResult> {
    const wishIdObj = WishId.fromString(wishId);
    const supporterIdObj = userId ? UserId.fromNumber(userId) : SessionId.fromString(sessionId!);
    
    const [wish, isSupported] = await Promise.all([
      this.wishRepository.findById(wishIdObj),
      this.wishRepository.hasSupported(wishIdObj, 
        userId ? undefined : SessionId.fromString(sessionId!), 
        userId ? UserId.fromNumber(userId) : undefined)
    ]);

    return {
      isSupported,
      wish
    };
  }
}