import { Wish } from "../../domain/entities/Wish";
import { WishService } from "../services/WishService";

export class CreateWishUseCase {
  constructor(private wishService: WishService) {}

  async execute(
    name: string | undefined,
    wishText: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ wish: Wish; sessionId: string }> {
    console.log('[USE_CASE] CreateWishUseCase.execute called');
    console.log('[USE_CASE] wishService type:', typeof this.wishService);
    console.log('[USE_CASE] wishService createWish method:', typeof this.wishService.createWish);
    
    try {
      const result = await this.wishService.createWish(name, wishText, sessionId, userId);
      console.log('[USE_CASE] CreateWishUseCase.execute completed successfully');
      return result;
    } catch (error) {
      console.error('[USE_CASE] Error in CreateWishUseCase:', error);
      throw error;
    }
  }
}
