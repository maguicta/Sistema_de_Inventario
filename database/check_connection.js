/**
 * ============================================
 * Verifica la conexión a la base de datos
 * Usado por iniciar_sistema.bat
 * ============================================
 * Retorna exit code 0 si la BD existe y está conectada
 * Retorna exit code 1 si no se puede conectar
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function checkConnection() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'inventory_system',
      connectTimeout: 5000
    });

    // Verificar que existan las tablas principales
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);
    
    const requiredTables = ['branches', 'users', 'products', 'sales', 'settings'];
    const missing = requiredTables.filter(t => !tableNames.includes(t));

    if (missing.length > 0) {
      console.log(`Tablas faltantes: ${missing.join(', ')}`);
      process.exit(1);
    }

    console.log('Conexión exitosa. Tablas verificadas.');
    process.exit(0);
  } catch (error) {
    console.error('Error de conexión:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

checkConnection();
