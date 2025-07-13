import { Wish } from "../../domain/entities/Wish";
import { WishId } from "../../domain/value-objects/WishId";
import { UserId } from "../../domain/value-objects/UserId";
import { SessionId } from "../../domain/value-objects/SessionId";

export interface WishRepository {
  save(wish: Wish, userId?: number): Promise<void>;
  findById(id: WishId): Promise<Wish | null>;
  findByUserId(userId: UserId): Promise<Wish | null>;
  findBySessionId(sessionId: SessionId): Promise<Wish | null>;
  findLatest(limit: number, offset?: number): Promise<Wish[]>;
  findLatestWithSupportStatus(limit: number, offset?: number, sessionId?: SessionId, userId?: UserId): Promise<Wish[]>;
  addSupport(wishId: WishId, sessionId?: SessionId, userId?: UserId): Promise<void>;
  removeSupport(wishId: WishId, sessionId?: SessionId, userId?: UserId): Promise<void>;
  hasSupported(wishId: WishId, sessionId?: SessionId, userId?: UserId): Promise<boolean>;
}