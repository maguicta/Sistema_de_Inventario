const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function applyUpdate() {
  console.log('🔧 Aplicando actualización de base de datos...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  try {
    const updateSql = fs.readFileSync(path.join(__dirname, 'update_v2.sql'), 'utf8');
    await connection.query(updateSql);
    console.log('✅ Base de datos actualizada correctamente (Cotizaciones, Vencimientos, Órdenes de Compra)');
  } catch (error) {
    console.error('❌ Error al actualizar la base de datos:', error.message);
  } finally {
    await connection.end();
  }
}

applyUpdate();
