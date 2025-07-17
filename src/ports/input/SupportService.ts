import { SupportWishResponse } from "./WishService";
import { Wish } from "../../domain/entities/Wish";

export interface SupportWishRequest {
  wishId: string;
  sessionId?: string;
  userId?: number;
}

export interface UnsupportWishResponse {
  success: boolean;
  wasSupported: boolean;
}

export interface WishSupportStatusResponse {
  isSupported: boolean;
  wish: Wish | null;
}

export interface SupportService {
  supportWish(request: SupportWishRequest): Promise<SupportWishResponse>;
  unsupportWish(request: SupportWishRequest): Promise<UnsupportWishResponse>;
  getWishSupportStatus(wishId: string, sessionId?: string, userId?: number): Promise<WishSupportStatusResponse>;
}