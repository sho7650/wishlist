const { DatabaseFactory } = require('../dist/infrastructure/db/DatabaseFactory');

// UUID生成関数
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function insertTestData() {
  console.log('Starting to insert test data...');
  
  const db = DatabaseFactory.createConnection();
  
  try {
    // データベースを初期化
    await db.initializeDatabase();
    console.log('Database initialized successfully');

    // テスト用の願い事データ
    const testWishes = [
      {
        id: generateUUID(),
        name: '星に願いを',
        wish: '来年こそは世界中の人々が平和に暮らせますように',
        supportCount: 0
      },
      {
        id: generateUUID(),
        name: '夢追い人',
        wish: '自分の夢を叶えて、たくさんの人に笑顔を届けられますように',
        supportCount: 0
      },
      {
        id: generateUUID(),
        name: '家族思い',
        wish: '家族みんなが健康で、いつも笑顔でいられますように',
        supportCount: 0
      },
      {
        id: generateUUID(),
        name: null,
        wish: '好きな人と結ばれて、幸せな毎日を送れますように',
        supportCount: 0
      },
      {
        id: generateUUID(),
        name: '学生',
        wish: '勉強を頑張って、将来の目標を達成できますように',
        supportCount: 0
      },
      {
        id: generateUUID(),
        name: '旅人',
        wish: '世界中を旅して、たくさんの素晴らしい体験ができますように',
        supportCount: 0
      },
      {
        id: generateUUID(),
        name: null,
        wish: '地球環境が良くなって、美しい自然がずっと残りますように',
        supportCount: 0
      },
      {
        id: generateUUID(),
        name: '料理好き',
        wish: '美味しい料理を作って、みんなに喜んでもらえますように',
        supportCount: 0
      },
      {
        id: generateUUID(),
        name: '音楽家',
        wish: '心に響く音楽を作って、人々の心を癒やせますように',
        supportCount: 0
      },
      {
        id: generateUUID(),
        name: '未来への希望',
        wish: '技術の発展で、みんなが幸せになれる未来が来ますように',
        supportCount: 0
      }
    ];

    // 願い事を挿入
    for (let i = 0; i < testWishes.length; i++) {
      const wish = testWishes[i];
      const query = `
        INSERT INTO wishes (id, name, wish, created_at, support_count)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      const createdAt = new Date(Date.now() - (i * 24 * 60 * 60 * 1000)); // 1日ずつ過去の日付
      
      await db.query(query, [
        wish.id,
        wish.name,
        wish.wish,
        createdAt,
        wish.supportCount
      ]);
      
      console.log(`Inserted wish ${i + 1}: ${wish.wish.substring(0, 30)}...`);
    }

    console.log('✅ Successfully inserted 10 test wishes!');
    
    // 挿入されたデータを確認
    const result = await db.query('SELECT COUNT(*) as count FROM wishes', []);
    console.log(`Total wishes in database: ${result.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error inserting test data:', error);
  } finally {
    await db.close();
    console.log('Database connection closed');
  }
}


insertTestData().catch(console.error);