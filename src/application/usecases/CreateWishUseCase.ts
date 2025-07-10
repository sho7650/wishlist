import { Wish } from "../../domain/entities/Wish";
import { WishRepository } from "../../domain/repositories/WishRepository";
import { SessionService } from "../../ports/output/SessionService";

export class CreateWishUseCase {
  constructor(
    private wishRepository: WishRepository,
    private sessionService: SessionService
  ) {}

  // ログインユーザーID(userId)も受け取るようにする
  async execute(
    name: string | undefined,
    wishText: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ wish: Wish; sessionId: string }> {
    if (userId) {
      const existingWish = await this.wishRepository.findByUserId(userId);
      if (existingWish) throw new Error("既に投稿済みです。");
    } else if (sessionId) {
      const existingWish = await this.wishRepository.findBySessionId(sessionId);
      if (existingWish) throw new Error("既に投稿済みです。");
    }

    const wish = new Wish({ name, wish: wishText });
    await this.wishRepository.save(wish, userId);

    const newSessionId = sessionId || this.sessionService.generateSessionId();
    await this.sessionService.linkSessionToWish(newSessionId, wish.id);

    return { wish, sessionId: newSessionId };
  }
}
