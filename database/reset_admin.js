/**
 * ============================================
 * Reset de contraseña del administrador
 * ============================================
 * Restablece la contraseña del admin a: admin123
 * 
 * Uso: node database/reset_admin.js
 */

require('dotenv').config();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');

async function resetAdmin() {
  try {
    const newPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Actualizar contraseña del usuario admin
    const [result] = await pool.query(
      'UPDATE users SET password = ? WHERE email = ?',
      [hashedPassword, 'admin@sistema.com']
    );

    if (result.affectedRows === 0) {
      // Si no existe, crearlo
      await pool.query(
        `INSERT INTO users (name, email, password, role, avatar_color, can_edit, can_delete, is_active, branch_id) 
         VALUES ('Administrador', 'admin@sistema.com', ?, 'admin', '#6366f1', 1, 1, 1, 1)`,
        [hashedPassword]
      );
      console.log('✅ Usuario admin creado');
    } else {
      console.log('✅ Contraseña del admin restablecida');
    }

    console.log('\n📋 Credenciales:');
    console.log('   Email: admin@sistema.com');
    console.log('   Contraseña: admin123\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

resetAdmin();
