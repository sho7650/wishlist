import { Wish } from "../../domain/entities/Wish";

export interface CreateWishRequest {
  name?: string;
  wish: string;
  sessionId?: string;
  userId?: number;
}

export interface CreateWishResponse {
  wish: Wish;
  sessionId: string;
}

export interface UpdateWishRequest {
  name?: string;
  wish: string;
  userId?: number;
  sessionId?: string;
}

export interface SupportWishRequest {
  wishId: string;
  sessionId?: string;
  userId?: number;
}

export interface SupportWishResponse {
  success: boolean;
  alreadySupported: boolean;
}

export interface WishService {
  createWish(request: CreateWishRequest): Promise<CreateWishResponse>;
  updateWish(request: UpdateWishRequest): Promise<void>;
  getLatestWishes(limit: number, offset?: number): Promise<Wish[]>;
  getLatestWishesWithSupportStatus(limit: number, offset?: number, sessionId?: string, userId?: number): Promise<Wish[]>;
  getWishBySession(sessionId: string): Promise<Wish | null>;
  getUserWish(userId?: number, sessionId?: string): Promise<Wish | null>;
}