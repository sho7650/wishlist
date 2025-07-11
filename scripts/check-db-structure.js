const { DatabaseFactory } = require('../dist/infrastructure/db/DatabaseFactory');

async function checkDatabaseStructure() {
  console.log('Checking database structure...');
  
  const db = DatabaseFactory.createConnection();
  
  try {
    // データベースを初期化
    await db.initializeDatabase();
    
    // wishesテーブルの構造を確認
    const wishesStructure = await db.query(`
      SELECT name, type, dflt_value, pk 
      FROM pragma_table_info('wishes')
    `, []);
    
    console.log('=== wishes table structure ===');
    console.log(wishesStructure.rows);
    
    // supportsテーブルの構造を確認
    const supportsStructure = await db.query(`
      SELECT name, type, dflt_value, pk 
      FROM pragma_table_info('supports')
    `, []);
    
    console.log('\n=== supports table structure ===');
    console.log(supportsStructure.rows);
    
    // wishesテーブルの現在のデータを確認
    const wishes = await db.query(`
      SELECT id, name, wish, support_count, created_at 
      FROM wishes 
      LIMIT 3
    `, []);
    
    console.log('\n=== wishes table sample data ===');
    console.log(wishes.rows);
    
    // supportsテーブルの現在のデータを確認
    const supports = await db.query(`
      SELECT id, wish_id, session_id, user_id, created_at 
      FROM supports 
      LIMIT 5
    `, []);
    
    console.log('\n=== supports table sample data ===');
    console.log(supports.rows);
    
  } catch (error) {
    console.error('❌ Error checking database structure:', error);
  } finally {
    await db.close();
    console.log('Database connection closed');
  }
}

checkDatabaseStructure().catch(console.error);