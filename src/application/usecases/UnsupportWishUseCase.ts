import { WishRepository } from "../../domain/repositories/WishRepository";

export class UnsupportWishUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(
    wishId: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ success: boolean; wasSupported: boolean }> {
    // 応援済みかチェック
    const wasSupported = await this.wishRepository.hasSupported(
      wishId,
      sessionId,
      userId
    );

    if (!wasSupported) {
      return { success: false, wasSupported: false };
    }

    // 応援を削除
    await this.wishRepository.removeSupport(wishId, sessionId, userId);

    return { success: true, wasSupported: true };
  }
}