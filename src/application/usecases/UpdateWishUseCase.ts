import { WishRepository } from "../../domain/repositories/WishRepository";
import { SessionService } from "../../ports/output/SessionService";
import { Wish } from "../../domain/entities/Wish";

export class UpdateWishUseCase {
  constructor(
    private wishRepository: WishRepository,
    private sessionService: SessionService
  ) {}

  async execute(
    sessionId: string,
    name: string | undefined,
    wishText: string
  ): Promise<void> {
    // セッションIDから投稿を検索
    const wish = await this.wishRepository.findBySessionId(sessionId);
    if (!wish) {
      throw new Error("投稿が見つかりません。");
    }

    console.log("Original wish:", wish);

    // createdAtが無効な場合、現在時刻を設定
    if (!wish.createdAt || isNaN(wish.createdAt.getTime())) {
      console.warn("Invalid createdAt detected, using a new date instance");
      // createdAtが読み取り専用のため、新しいインスタンスを作成
      const fixedWish = new Wish({
        id: wish.id,
        name: wish.name,
        wish: wish.wish,
        createdAt: new Date(),
      });

      const updatedWish = fixedWish.update(name, wishText);
      console.log("Fixed wish:", updatedWish);
      await this.wishRepository.save(updatedWish);
      return;
    }

    // 通常の更新処理
    const updatedWish = wish.update(name, wishText);
    console.log("Updated wish:", updatedWish);
    await this.wishRepository.save(updatedWish);
  }
}
