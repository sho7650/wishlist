import { WishRepository } from "../../domain/repositories/WishRepository";

export class GetWishSupportStatusUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(
    wishId: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ isSupported: boolean; wish: any }> {
    // 応援状況をチェック
    const isSupported = await this.wishRepository.hasSupported(
      wishId,
      sessionId,
      userId
    );

    // 願い事の詳細を取得
    const wish = await this.wishRepository.findById(wishId);

    return { isSupported, wish };
  }
}