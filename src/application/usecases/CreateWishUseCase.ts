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
    return await this.wishService.createWish(name, wishText, sessionId, userId);
  }
}
