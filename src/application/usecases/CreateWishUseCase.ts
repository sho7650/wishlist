import { Wish } from "../../domain/entities/Wish";
import { WishService } from "../services/WishService";
import { Logger } from "../../utils/Logger";

export class CreateWishUseCase {
  constructor(private wishService: WishService) {}

  async execute(
    name: string | undefined,
    wishText: string,
    sessionId?: string,
    userId?: number
  ): Promise<{ wish: Wish; sessionId: string }> {
    Logger.debug('[USE_CASE] CreateWishUseCase.execute called');
    Logger.debug('[USE_CASE] WishService dependencies validated', {
      serviceType: typeof this.wishService,
      createWishMethod: typeof this.wishService.createWish
    });
    
    try {
      const result = await this.wishService.createWish(name, wishText, sessionId, userId);
      Logger.debug('[USE_CASE] CreateWishUseCase.execute completed successfully');
      return result;
    } catch (error) {
      Logger.error('[USE_CASE] Error in CreateWishUseCase', error as Error);
      throw error;
    }
  }
}
