import { Wish } from "../../domain/entities/Wish";
import { WishRepository } from "../../ports/output/WishRepository";
import { SessionId } from "../../domain/value-objects/SessionId";
import { UserId } from "../../domain/value-objects/UserId";

export class GetLatestWishesUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(limit: number = 20, offset: number = 0): Promise<Wish[]> {
    return this.wishRepository.findLatest(limit, offset);
  }

  async executeWithSupportStatus(
    limit: number = 20, 
    offset: number = 0, 
    sessionId?: string, 
    userId?: number
  ): Promise<Wish[]> {
    const sessionIdObj = sessionId ? SessionId.fromString(sessionId) : undefined;
    const userIdObj = userId ? UserId.fromNumber(userId) : undefined;
    return this.wishRepository.findLatestWithSupportStatus(limit, offset, sessionIdObj, userIdObj);
  }
}
