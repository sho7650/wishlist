import { WishRepository } from "../../ports/output/WishRepository";
import { WishId } from "../../domain/value-objects/WishId";
import { SessionId } from "../../domain/value-objects/SessionId";
import { UserId } from "../../domain/value-objects/UserId";

export class GetWishSupportStatusUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(
    wishId: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ isSupported: boolean; wish: any }> {
    const wishIdObj = WishId.fromString(wishId);
    const sessionIdObj = sessionId ? SessionId.fromString(sessionId) : undefined;
    const userIdObj = userId ? UserId.fromNumber(userId) : undefined;

    // 願い事の詳細を先に取得（最新のsupportCountを確実に取得）
    const wish = await this.wishRepository.findById(wishIdObj);

    // 応援状況をチェック
    const isSupported = await this.wishRepository.hasSupported(
      wishIdObj,
      sessionIdObj,
      userIdObj
    );

    return { isSupported, wish };
  }
}