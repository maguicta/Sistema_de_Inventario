/**
 * ============================================
 * INVENTARIO PRO - Inicialización de Base de Datos
 * ============================================
 * Este script crea todas las tablas e inserta
 * los datos iniciales necesarios para ejecutar
 * el sistema por primera vez.
 * 
 * Uso: node database/init.js
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  console.log('\n🔧 Inicializando base de datos...\n');

  // Conectar sin seleccionar base de datos para poder crearla
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
      charset: 'utf8mb4'
    });

    const dbName = process.env.DB_NAME || 'inventory_system';
    console.log(`📦 Base de datos: ${dbName}`);
    console.log(`🔌 Host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 3306}`);

    // Crear la base de datos si no existe
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await connection.query(`USE \`${dbName}\``);
    console.log('✅ Base de datos verificada/creada\n');

    // Ejecutar schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await connection.query(schemaSql);
      console.log('✅ Esquema de tablas aplicado');
    } else {
      console.error('❌ No se encontró schema.sql');
      process.exit(1);
    }

    // Verificar si ya existe un usuario admin
    const [existingUsers] = await connection.query('SELECT COUNT(*) as count FROM users');
    
    if (existingUsers[0].count === 0) {
      // Generar hash con bcrypt directamente (más confiable que el hash fijo del seed)
      const hashedPassword = await bcrypt.hash('admin123', 12);

      // Insertar branch por defecto
      await connection.query(
        `INSERT INTO branches (id, name) VALUES (1, 'Sucursal Principal') ON DUPLICATE KEY UPDATE name = VALUES(name)`
      );

      // Insertar usuario admin
      await connection.query(
        `INSERT INTO users (name, email, password, role, avatar_color, can_edit, can_delete, is_active, branch_id) 
         VALUES (?, ?, ?, 'admin', '#6366f1', 1, 1, 1, 1)`,
        ['Administrador', 'admin@sistema.com', hashedPassword]
      );

      // Insertar configuración
      const defaultSettings = {
        store_name: 'Inventario Pro',
        theme: 'midnight',
        currency_base: 'DOP',
        currency_symbol: 'RD$',
        currency_secondary: 'USD',
        exchange_rate: '1.0000',
        tax_rate: '18.00',
        exchange_refresh_interval: '0',
        allow_negative_stock: 'false'
      };

      for (const [key, value] of Object.entries(defaultSettings)) {
        await connection.query(
          'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
          [key, value]
        );
      }

      console.log('✅ Datos iniciales insertados');
      console.log('\n📋 Credenciales de acceso:');
      console.log('   Email: admin@sistema.com');
      console.log('   Contraseña: admin123');
      console.log('   Sucursal: Sucursal Principal\n');
    } else {
      // Si ya existen usuarios, solo asegurarse de que haya una sucursal
      const [branches] = await connection.query('SELECT COUNT(*) as count FROM branches');
      if (branches[0].count === 0) {
        await connection.query(`INSERT INTO branches (id, name) VALUES (1, 'Sucursal Principal')`);
        console.log('✅ Sucursal por defecto creada');
      }
      console.log('ℹ️  La base de datos ya tenía datos. No se sobreescribieron.');
    }

    console.log('\n🎉 Inicialización completada exitosamente.\n');

  } catch (error) {
    console.error('\n❌ Error durante la inicialización:', error.message);
    if (error.code === 'ECONNREFUSED') {
      console.error('\n⚠️  No se pudo conectar a MySQL.');
      console.error('   Asegúrate de que MySQL/XAMPP/WampServer esté encendido.');
      console.error('   Revisa las credenciales en el archivo .env\n');
    }
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

initDatabase();
