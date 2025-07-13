import { WishRepository } from "../../ports/output/WishRepository";
import { WishId } from "../../domain/value-objects/WishId";
import { SessionId } from "../../domain/value-objects/SessionId";
import { UserId } from "../../domain/value-objects/UserId";
import { DomainException } from "../../domain/exceptions/DomainException";
import { Logger } from "../../utils/Logger";

export class SupportWishUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(
    wishId: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ success: boolean; alreadySupported: boolean }> {
    Logger.debug('[SUPPORT] Starting support operation', {
      wishId,
      sessionId: sessionId ? `${sessionId.substring(0, 8)}...` : undefined,
      userId
    });

    const wishIdObj = WishId.fromString(wishId);
    const sessionIdObj = sessionId ? SessionId.fromString(sessionId) : undefined;
    const userIdObj = userId ? UserId.fromNumber(userId) : undefined;

    // Check if already supported
    const alreadySupported = await this.wishRepository.hasSupported(
      wishIdObj,
      sessionIdObj,
      userIdObj
    );

    Logger.debug('[SUPPORT] Checked existing support status', {
      wishId,
      alreadySupported,
      checkedWith: userId ? `user_${userId}` : `session_${sessionId?.substring(0, 8)}...`
    });

    if (alreadySupported) {
      Logger.debug('[SUPPORT] Already supported, returning early');
      return { success: true, alreadySupported: true };
    }

    // Get wish to check business rules
    const wish = await this.wishRepository.findById(wishIdObj);
    if (!wish) {
      Logger.error(`[SUPPORT] Wish not found: ${wishId}`, new Error('Wish not found'));
      throw new Error("願い事が見つかりません");
    }

    Logger.debug('[SUPPORT] Found wish', {
      wishId,
      wishAuthor: wish.userId ? `user_${wish.userId}` : 'anonymous',
      supportCount: wish.supportCount
    });

    // Check if supporter is the author
    const supporter = userId ? UserId.fromNumber(userId) : SessionId.fromString(sessionId || 'anonymous');
    const validation = wish.canSupport(supporter);
    
    Logger.debug('[SUPPORT] Business rule validation', {
      wishId,
      supporter: userId ? `user_${userId}` : `session_${sessionId?.substring(0, 8)}...`,
      isValid: validation.isValid,
      errorCode: validation.errorCode
    });
    
    if (!validation.isValid) {
      if (validation.errorCode === "SELF_SUPPORT_NOT_ALLOWED") {
        Logger.warn('[SUPPORT] Self-support attempt blocked', { wishId });
        throw new Error("作者は自分の願いに応援できません");
      }
      Logger.error(`[SUPPORT] Validation failed for wish ${wishId}: ${validation.errorCode}`, new Error(validation.errorMessage || 'Validation failed'));
      throw new Error(validation.errorMessage || "応援できません");
    }

    // Add support via repository
    Logger.debug('[SUPPORT] Adding support to repository', { wishId });
    await this.wishRepository.addSupport(wishIdObj, sessionIdObj, userIdObj);

    Logger.debug('[SUPPORT] Support operation completed successfully', { wishId });
    return { success: true, alreadySupported: false };
  }
}