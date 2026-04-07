const mysql = require('mysql2/promise');
require('dotenv').config();

async function check() {
    try {
        const config = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'inventory_system',
            port: parseInt(process.env.DB_PORT) || 3306
        };

        const conn = await mysql.createConnection(config);
        await conn.end();
        console.log('[OK] Conexión establecida.');
        process.exit(0);
    } catch (e) {
        console.error('[ERROR] No se pudo conectar a la base de datos:', e.message);
        process.exit(1);
    }
}

check();
