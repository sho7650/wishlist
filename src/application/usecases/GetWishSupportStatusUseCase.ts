import { WishRepository } from "../../domain/repositories/WishRepository";

export class GetWishSupportStatusUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(
    wishId: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ isSupported: boolean; wish: any }> {
    // 願い事の詳細を先に取得（最新のsupportCountを確実に取得）
    const wish = await this.wishRepository.findById(wishId);

    // 応援状況をチェック
    const isSupported = await this.wishRepository.hasSupported(
      wishId,
      sessionId,
      userId
    );

    return { isSupported, wish };
  }
}