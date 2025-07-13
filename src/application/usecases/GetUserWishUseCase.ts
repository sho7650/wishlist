import { Wish } from "../../domain/entities/Wish";
import { WishRepository } from "../../ports/output/WishRepository";
import { UserId } from "../../domain/value-objects/UserId";
import { SessionId } from "../../domain/value-objects/SessionId";

/**
 * ユーザーIDまたはセッションIDに基づいて、ユーザーの既存の願い事を取得するユースケース
 */
export class GetUserWishUseCase {
  constructor(private wishRepository: WishRepository) {}

  /**
   * @param userId ログインしているユーザーのID (オプショナル)
   * @param sessionId 匿名のユーザーセッションID (オプショナル)
   * @returns ユーザーの願い事、または見つからなければnull
   */
  async execute(userId?: number, sessionId?: string): Promise<Wish | null> {
    // 1. ログインユーザーの場合、ユーザーIDで検索
    if (userId) {
      const wish = await this.wishRepository.findByUserId(UserId.fromNumber(userId));
      if (wish) {
        return wish;
      }
    }

    // 2. 匿名ユーザーの場合、セッションIDで検索
    if (sessionId) {
      const wish = await this.wishRepository.findBySessionId(SessionId.fromString(sessionId));
      if (wish) {
        return wish;
      }
    }

    // 3. どちらでも見つからなかった場合
    return null;
  }
}
