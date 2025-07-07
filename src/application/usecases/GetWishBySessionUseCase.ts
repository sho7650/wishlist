import { Wish } from '../../domain/entities/Wish';
import { WishRepository } from '../../domain/repositories/WishRepository';

export class GetWishBySessionUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(sessionId: string): Promise<Wish | null> {
    return this.wishRepository.findBySessionId(sessionId);
  }
}
