export interface SessionService {
  generateSessionId(): string;
  linkSessionToWish(sessionId: string, wishId: string): Promise<void>;
  getWishIdBySession(sessionId: string): Promise<string | null>;
}
