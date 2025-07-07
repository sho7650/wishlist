import { Wish } from '../../domain/entities/Wish';
import { WishRepository } from '../../domain/repositories/WishRepository';
import { SessionService } from '../../ports/output/SessionService';

export class CreateWishUseCase {
  constructor(
    private wishRepository: WishRepository,
    private sessionService: SessionService
  ) {}

  async execute(name: string | undefined, wishText: string, sessionId?: string): Promise<{ wish: Wish, sessionId: string }> {
    // セッションIDがある場合、既存の投稿を検索
    if (sessionId) {
      const existingWish = await this.wishRepository.findBySessionId(sessionId);
      if (existingWish) {
        throw new Error('既に投稿済みです。編集画面から変更してください。');
      }
    }

    // 新規投稿を作成
    const wish = new Wish({ name, wish: wishText });
    
    // 新しいセッションIDを生成または既存のものを使用
    const newSessionId = sessionId || this.sessionService.generateSessionId();
    
    // 投稿を保存し、セッションと紐付け
    await this.wishRepository.save(wish);
    await this.sessionService.linkSessionToWish(newSessionId, wish.id);
    
    return { wish, sessionId: newSessionId };
  }
}
