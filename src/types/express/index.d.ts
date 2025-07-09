// src/types/express/index.d.ts

// 1. 我々が定義したいユーザーの型
//    Passport.jsの done(null, user) で渡すオブジェクトの型と一致させる
export interface AppUser {
  id: number;
  google_id: string;
  display_name: string;
  email?: string;
}

// 2. 'express-serve-static-core' モジュールを拡張する
//    Expressの型定義の本体はこのモジュールにある
declare module "express-serve-static-core" {
  // 3. Requestインターフェースにuserプロパティを追加
  interface Request {
    user?: AppUser;
  }
}
