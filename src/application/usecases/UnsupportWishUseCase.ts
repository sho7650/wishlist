import { WishRepository } from "../../ports/output/WishRepository";
import { WishId } from "../../domain/value-objects/WishId";
import { SessionId } from "../../domain/value-objects/SessionId";
import { UserId } from "../../domain/value-objects/UserId";
import { DomainException } from "../../domain/exceptions/DomainException";
import { Logger } from "../../utils/Logger";

export class UnsupportWishUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(
    wishId: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ success: boolean; wasSupported: boolean }> {
    Logger.debug('[UNSUPPORT] Starting unsupport operation', {
      wishId,
      sessionId: sessionId ? `${sessionId.substring(0, 8)}...` : undefined,
      userId
    });

    const wishIdObj = WishId.fromString(wishId);
    const sessionIdObj = sessionId ? SessionId.fromString(sessionId) : undefined;
    const userIdObj = userId ? UserId.fromNumber(userId) : undefined;

    // Check if was supported
    const wasSupported = await this.wishRepository.hasSupported(
      wishIdObj,
      sessionIdObj,
      userIdObj
    );

    Logger.debug('[UNSUPPORT] Checked existing support status', {
      wishId,
      wasSupported,
      checkedWith: userId ? `user_${userId}` : `session_${sessionId?.substring(0, 8)}...`
    });

    if (!wasSupported) {
      Logger.debug('[UNSUPPORT] Was not supported, returning early');
      return { success: false, wasSupported: false };
    }

    // Remove support via repository
    Logger.debug('[UNSUPPORT] Removing support from repository', { wishId });
    await this.wishRepository.removeSupport(wishIdObj, sessionIdObj, userIdObj);

    Logger.debug('[UNSUPPORT] Unsupport operation completed successfully', { wishId });
    return { success: true, wasSupported: true };
  }
}