import { Wish } from "../../domain/entities/Wish";
import { WishRepository } from "../../domain/repositories/WishRepository";

/**
 * ログインユーザー、または匿名セッションユーザーの願い事を更新するユースケース
 */
export class UpdateWishUseCase {
  constructor(private wishRepository: WishRepository) {}

  /**
   * @param name 新しい名前
   * @param wishText 新しい願い事
   * @param userId ログインしているユーザーのID (オプショナル)
   * @param sessionId 匿名のユーザーセッションID (オプショナル)
   */
  async execute(
    name: string | undefined,
    wishText: string,
    userId?: number,
    sessionId?: string
  ): Promise<void> {
    let wishToUpdate: Wish | null = null;

    // 1. まずログインユーザーとして、自分の投稿を探す
    if (userId) {
      wishToUpdate = await this.wishRepository.findByUserId(userId);
    }

    // 2. ログインしていない、またはログインユーザーの投稿が見つからない場合、
    //    セッションIDで匿名の投稿を探す
    if (!wishToUpdate && sessionId) {
      wishToUpdate = await this.wishRepository.findBySessionId(sessionId);
    }

    // 3. 更新対象の願い事が見つからなかった場合
    if (!wishToUpdate) {
      throw new Error("更新対象の投稿が見つかりませんでした。");
    }

    // 4. 見つかった願い事を更新する
    //    ログインユーザーの投稿を更新する場合、userIdも一緒に保存する
    const updatedWish = wishToUpdate.update(name, wishText);
    await this.wishRepository.save(updatedWish, wishToUpdate.userId);
  }
}
