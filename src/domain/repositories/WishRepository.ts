import { Wish } from "../entities/Wish";

export interface WishRepository {
  save(wish: Wish, userId?: number): Promise<void>;
  findById(id: string): Promise<Wish | null>;
  findByUserId(userId: number): Promise<Wish | null>; // 新規追加: ユーザーIDで探す
  findBySessionId(sessionId: string): Promise<Wish | null>; // 復活させる
  findLatest(limit: number, offset?: number): Promise<Wish[]>;
  findLatestWithSupportStatus(limit: number, offset?: number, sessionId?: string, userId?: number): Promise<Wish[]>;
  addSupport(wishId: string, sessionId?: string, userId?: number): Promise<void>;
  removeSupport(wishId: string, sessionId?: string, userId?: number): Promise<void>;
  hasSupported(wishId: string, sessionId?: string, userId?: number): Promise<boolean>;
}
