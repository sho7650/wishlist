import { Wish } from '../entities/Wish';

export interface WishRepository {
  save(wish: Wish): Promise<void>;
  findById(id: string): Promise<Wish | null>;
  findBySessionId(sessionId: string): Promise<Wish | null>;
  findLatest(limit: number): Promise<Wish[]>;
}
