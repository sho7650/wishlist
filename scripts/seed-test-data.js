const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

// PostgreSQL接続設定
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'wishlist',
  user: process.env.DB_USER || 'wishlist_user',
  password: process.env.DB_PASSWORD || 'wishlist_password',
});

// テスト用の願い事データ
const testWishes = [
  "世界平和が実現しますように",
  "家族全員が健康でありますように",
  "好きな人と結ばれますように",
  "夢の仕事に就けますように",
  "宝くじが当たりますように",
  "受験に合格しますように",
  "美味しいラーメンが食べられますように",
  "旅行で素敵な思い出が作れますように",
  "新しい友達ができますように",
  "ペットが元気でいてくれますように",
  "お金に困らない生活ができますように",
  "好きなアーティストのライブに行けますように",
  "料理が上手になりますように",
  "語学力が向上しますように",
  "運動能力が向上しますように",
  "綺麗な肌になりますように",
  "髪がツヤツヤになりますように",
  "痩せて理想の体型になりますように",
  "早起きできるようになりますように",
  "集中力が続くようになりますように",
  "笑顔が素敵になりますように",
  "心が穏やかでいられますように",
  "創造力が豊かになりますように",
  "コミュニケーション能力が向上しますように",
  "時間を有効活用できますように",
  "新しい趣味を見つけられますように",
  "良い本に出会えますように",
  "美味しいコーヒーが飲めますように",
  "花粉症が治りますように",
  "肩こりが解消されますように",
  "良い睡眠がとれますように",
  "ストレスが軽減されますように",
  "新しい技術を習得できますように",
  "プログラミングスキルが向上しますように",
  "デザインセンスが磨かれますように",
  "楽器が上手に弾けるようになりますように",
  "写真撮影が上達しますように",
  "美味しい手料理が作れますように",
  "園芸が上手になりますように",
  "毎日が充実した日々になりますように"
];

// 名前のサンプルデータ
const testNames = [
  "太郎", "花子", "次郎", "美咲", "健太", "さくら", "大輔", "麻衣",
  "隆", "由美", "学", "真理", "博", "恵子", "誠", "裕子",
  "和也", "智子", "雅之", "明美", "拓也", "香織", "慎一", "美穂",
  "正樹", "直美", "俊介", "理恵", "和彦", "優子", "達也", "久美子",
  "浩二", "加奈", "修", "綾", "淳", "静香", "亮", "千恵子"
];

async function seedTestData() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 テストデータの投入を開始します...');
    
    // 既存のテストデータをクリア（オプション）
    console.log('📝 既存のテストデータをクリアしています...');
    await client.query('DELETE FROM supports');
    await client.query('DELETE FROM sessions');
    await client.query('DELETE FROM wishes');
    
    // 40件のwishデータを挿入
    console.log('📝 40件のwishデータを挿入しています...');
    
    for (let i = 0; i < 40; i++) {
      const wishId = uuidv4();
      const name = Math.random() > 0.3 ? testNames[i % testNames.length] : null; // 30%の確率で名前なし
      const wish = testWishes[i % testWishes.length];
      const createdAt = new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)); // 過去30日間のランダムな日時
      const supportCount = Math.floor(Math.random() * 20); // 0-19のランダムな応援数
      
      // wishを挿入
      await client.query(
        'INSERT INTO wishes (id, name, wish, created_at, support_count) VALUES ($1, $2, $3, $4, $5)',
        [wishId, name, wish, createdAt, supportCount]
      );
      
      // セッションIDを生成してsessionsテーブルに挿入
      if (Math.random() > 0.2) { // 80%の確率でセッションを作成
        const sessionId = require('crypto').randomBytes(16).toString('hex');
        await client.query(
          'INSERT INTO sessions (session_id, wish_id, created_at) VALUES ($1, $2, $3)',
          [sessionId, wishId, createdAt]
        );
      }
      
      // ランダムな応援データを生成
      for (let j = 0; j < supportCount; j++) {
        const supportSessionId = require('crypto').randomBytes(16).toString('hex');
        const supportCreatedAt = new Date(createdAt.getTime() + Math.floor(Math.random() * 24 * 60 * 60 * 1000));
        
        await client.query(
          'INSERT INTO supports (wish_id, session_id, created_at) VALUES ($1, $2, $3)',
          [wishId, supportSessionId, supportCreatedAt]
        );
      }
      
      console.log(`✅ Wish ${i + 1}/40 挿入完了: "${wish.substring(0, 20)}..." (応援数: ${supportCount})`);
    }
    
    // 結果を確認
    const result = await client.query('SELECT COUNT(*) as count FROM wishes');
    const supportResult = await client.query('SELECT COUNT(*) as count FROM supports');
    
    console.log('🎉 テストデータの投入が完了しました!');
    console.log(`📊 合計 ${result.rows[0].count} 件のwishが作成されました`);
    console.log(`❤️  合計 ${supportResult.rows[0].count} 件の応援が作成されました`);
    
    // 最新の10件を表示
    const latestWishes = await client.query(
      'SELECT id, name, wish, support_count, created_at FROM wishes ORDER BY created_at DESC LIMIT 10'
    );
    
    console.log('\n📋 最新の10件のwish:');
    latestWishes.rows.forEach((wish, index) => {
      const name = wish.name || '匿名';
      const date = new Date(wish.created_at).toLocaleDateString('ja-JP');
      console.log(`${index + 1}. [${name}] ${wish.wish} (応援数: ${wish.support_count}) - ${date}`);
    });
    
  } catch (error) {
    console.error('❌ エラーが発生しました:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// スクリプトを実行
seedTestData().catch(console.error);