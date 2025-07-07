import { Wish } from "../../domain/entities/Wish";
import { WishRepository } from "../../domain/repositories/WishRepository";

export class GetLatestWishesUseCase {
  constructor(private wishRepository: WishRepository) {}

  async execute(limit: number = 20, offset: number = 0): Promise<Wish[]> {
    return this.wishRepository.findLatest(limit, offset);
  }
}
