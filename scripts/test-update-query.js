const { DatabaseFactory } = require('../dist/infrastructure/db/DatabaseFactory');

async function testUpdateQuery() {
  console.log('Testing update query...');
  
  const db = DatabaseFactory.createConnection();
  
  try {
    // データベースを初期化
    await db.initializeDatabase();
    
    // テスト用の願い事ID
    const testWishId = '8ef95322-2b73-4024-b108-740e856014a1';
    
    // 現在のsupport_countを確認
    const beforeUpdate = await db.query(`
      SELECT id, support_count FROM wishes WHERE id = $1
    `, [testWishId]);
    
    console.log('Before update:', beforeUpdate.rows[0]);
    
    // 該当する応援記録数を確認
    const supportCount = await db.query(`
      SELECT COUNT(*) as count FROM supports WHERE wish_id = $1
    `, [testWishId]);
    
    console.log('Support count from supports table:', supportCount.rows[0]);
    
    // UPDATEクエリを実行
    const updateQuery = `
      UPDATE wishes 
      SET support_count = (SELECT COUNT(*) FROM supports WHERE wish_id = $1)
      WHERE id = $1
    `;
    
    console.log('Executing update query:', updateQuery);
    console.log('With params:', [testWishId]);
    
    const updateResult = await db.query(updateQuery, [testWishId]);
    
    console.log('Update result:', updateResult);
    
    // 更新後のsupport_countを確認
    const afterUpdate = await db.query(`
      SELECT id, support_count FROM wishes WHERE id = $1
    `, [testWishId]);
    
    console.log('After update:', afterUpdate.rows[0]);
    
  } catch (error) {
    console.error('❌ Error testing update query:', error);
  } finally {
    await db.close();
    console.log('Database connection closed');
  }
}

testUpdateQuery().catch(console.error);