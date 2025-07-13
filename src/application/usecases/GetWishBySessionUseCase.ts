import { Wish } from '../../domain/entities/Wish';
import { WishRepository } from '../../ports/output/WishRepository';
import { SessionId } from '../../domain/value-objects/SessionId';

export class GetWishBySessionUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(sessionId: string): Promise<Wish | null> {
    return this.wishRepository.findBySessionId(SessionId.fromString(sessionId));
  }
}
