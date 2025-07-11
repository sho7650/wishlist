const { DatabaseFactory } = require('../dist/infrastructure/db/DatabaseFactory');

async function testUpdateFix() {
  console.log('Testing update fix...');
  
  const db = DatabaseFactory.createConnection();
  
  try {
    // データベースを初期化
    await db.initializeDatabase();
    
    // テスト用の願い事ID
    const testWishId = '8ef95322-2b73-4024-b108-740e856014a1';
    
    // 現在のsupport_countを確認
    const beforeUpdate = await db.query(`
      SELECT id, support_count FROM wishes WHERE id = ?
    `, [testWishId]);
    
    console.log('Before update:', beforeUpdate.rows[0]);
    
    // 該当する応援記録数を取得
    const supportCountResult = await db.query(`
      SELECT COUNT(*) as count FROM supports WHERE wish_id = ?
    `, [testWishId]);
    
    const supportCount = supportCountResult.rows[0].count;
    console.log('Support count from supports table:', supportCount);
    
    // 2段階でUPDATEクエリを実行
    const updateQuery = `
      UPDATE wishes 
      SET support_count = ?
      WHERE id = ?
    `;
    
    console.log('Executing update query:', updateQuery);
    console.log('With params:', [supportCount, testWishId]);
    
    const updateResult = await db.query(updateQuery, [supportCount, testWishId]);
    
    console.log('Update result:', updateResult);
    
    // 更新後のsupport_countを確認
    const afterUpdate = await db.query(`
      SELECT id, support_count FROM wishes WHERE id = ?
    `, [testWishId]);
    
    console.log('After update:', afterUpdate.rows[0]);
    
  } catch (error) {
    console.error('❌ Error testing update fix:', error);
  } finally {
    await db.close();
    console.log('Database connection closed');
  }
}

testUpdateFix().catch(console.error);