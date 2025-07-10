// src/types/koa/index.d.ts
import "koa";
import { AppUser } from "../express"; // express/index.d.ts で定義したAppUserを再利用

// Koaのモジュールを拡張
declare module "koa" {
  // KoaのStateオブジェクトにuserプロパティを追加
  interface State {
    user?: AppUser;
  }

  // KoaのContextオブジェクトにPassportのメソッドを追加
  interface Context {
    login(user: AppUser): Promise<void>;
    logout(): void;
    isAuthenticated(): boolean;
    isUnauthenticated(): boolean;
  }
}
