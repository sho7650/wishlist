// src/infrastructure/web/SecurityConfigurationFactory.ts

export class SecurityConfigurationFactory {
  /**
   * Creates unified Content Security Policy configuration
   * Eliminates duplication between Express and Koa servers
   */
  static createCSPConfiguration(): any {
    return {
      directives: {
        // デフォルトのソースを 'self' に設定
        defaultSrc: ["'self'"],
        // スクリプトのソース：自分自身と、もしインラインスクリプトがあれば 'unsafe-inline'
        scriptSrc: ["'self'"],
        // スタイルのソース：自分自身と、Google Fonts、インラインスタイル
        styleSrc: ["'self'", "fonts.googleapis.com", "'unsafe-inline'"],
        // ★★★ 画像のソース ★★★
        // 自分自身、data:スキーム、そしてGoogleの画像ドメインを許可
        imgSrc: [
          "'self'", 
          "data:", 
          "https://lh3.googleusercontent.com", 
          "https://lh4.googleusercontent.com", 
          "https://lh5.googleusercontent.com", 
          "https://lh6.googleusercontent.com", 
          "https://lh1.googleusercontent.com", 
          "https://lh2.googleusercontent.com"
        ],
        // 接続元
        connectSrc: ["'self'"],
        // フォントのソース
        fontSrc: ["'self'", "fonts.gstatic.com"],
        // オブジェクトのソース
        objectSrc: ["'none'"],
        // メディアのソース
        mediaSrc: ["'self'"],
        // フレームのソース
        frameSrc: ["'none'"],
        // CSP違反のレポート先(任意)
        // reportUri: '/csp-violation-report-endpoint',
      },
    };
  }
}