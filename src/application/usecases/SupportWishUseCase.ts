import { WishRepository } from "../../domain/repositories/WishRepository";

export class SupportWishUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(
    wishId: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ success: boolean; alreadySupported: boolean }> {
    // 既に応援済みかチェック
    const alreadySupported = await this.wishRepository.hasSupported(
      wishId,
      sessionId,
      userId
    );

    if (alreadySupported) {
      return { success: false, alreadySupported: true };
    }

    // 応援を追加
    await this.wishRepository.addSupport(wishId, sessionId, userId);

    return { success: true, alreadySupported: false };
  }
}