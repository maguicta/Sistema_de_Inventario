/**
 * ============================================
 * Configuración de conexión a MySQL
 * ============================================
 * Se conecta usando variables de entorno del .env
 * Variables: DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 */

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
  charset: 'utf8mb4',
  connectTimeout: 10000,
  // Reconexión automática si la conexión se pierde
  maxIdle: 5,
  idleTimeout: 60000
});

// Verificar la conexión al iniciar
pool.getConnection()
  .then(conn => {
    console.log(`✅ Conectado a MySQL: ${process.env.DB_HOST || 'localhost'}/${process.env.DB_NAME || 'inventory_system'}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ Error de conexión a MySQL:', err.message);
    console.error('   Revisa las credenciales en el archivo .env');
  });

module.exports = pool;
