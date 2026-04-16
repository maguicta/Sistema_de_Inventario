const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

// GET /api/settings - Get all settings
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM settings');
    const settings = {};
    rows.forEach(row => {
      settings[row.setting_key] = row.setting_value;
    });
    res.json(settings);
  } catch (error) {
    console.error('Settings error:', error);
    res.status(500).json({ error: 'Error al obtener la configuración' });
  }
});

// POST /api/settings - Update multiple settings
router.post('/', authMiddleware, adminOnly, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const updates = req.body; // { key1: value1, key2: value2 }

    for (const [key, value] of Object.entries(updates)) {
      await connection.query(
        'INSERT INTO settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = ?',
        [key, value, value]
      );
    }

    await connection.commit();
    res.json({ message: 'Configuración actualizada correctamente' });
  } catch (error) {
    await connection.rollback();
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Error al actualizar la configuración' });
  } finally {
    connection.release();
  }
});

// GET /api/settings/fetch-exchange-rate
router.get('/fetch-exchange-rate', authMiddleware, adminOnly, async (req, res) => {
  const { base, reference } = req.query; // base: DOP, reference: USD
  if (!base || !reference) return res.status(400).json({ error: 'Faltan parámetros' });
  
  try {
    // Usando fetch nativo de Node.js (v18+)
    const response = await fetch(`https://open.er-api.com/v6/latest/${reference}`);
    const data = await response.json();
    if (data.result === 'success') {
      const rate = data.rates[base];
      return res.json({ rate: parseFloat(rate.toFixed(4)) });
    }
    throw new Error('API external error');
  } catch (error) {
    console.error('Exchange rate error:', error);
    res.status(500).json({ error: 'Error al obtener tasa de cambio externa' });
  }
});

// GET /api/settings/backup/sql
router.get('/backup/sql', authMiddleware, adminOnly, async (req, res) => {
  try {
    const tablesRaw = await pool.query('SHOW TABLES');
    const tableKeys = tablesRaw[0].map(row => Object.values(row)[0]);
    let dump = '-- Inventory System SQL Dump\n';
    dump += `-- Generated at: ${new Date().toISOString()}\n\n`;
    dump += 'SET FOREIGN_KEY_CHECKS=0;\n\n';

    for (const table of tableKeys) {
       const createTableRaw = await pool.query(`SHOW CREATE TABLE \`${table}\``);
       dump += `-- Table structure for table \`${table}\`\n`;
       dump += `DROP TABLE IF EXISTS \`${table}\`;\n`;
       dump += `${createTableRaw[0][0]['Create Table']};\n\n`;

       const rowsRaw = await pool.query(`SELECT * FROM \`${table}\``);
       const rows = rowsRaw[0];
       if (rows.length > 0) {
          dump += `-- Dumping data for table \`${table}\`\n`;
          const cols = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
          for (const row of rows) {
             const vals = Object.values(row).map(val => {
               if (val === null) return 'NULL';
               if (typeof val === 'number') return val;
               if (val instanceof Date) return pool.escape(val.toISOString().slice(0, 19).replace('T', ' '));
               return pool.escape(val);
             }).join(', ');
             dump += `INSERT INTO \`${table}\` (${cols}) VALUES (${vals});\n`;
          }
          dump += '\n';
       }
    }
    dump += 'SET FOREIGN_KEY_CHECKS=1;\n';

    res.setHeader('Content-disposition', `attachment; filename=backup_${new Date().toISOString().slice(0,10)}.sql`);
    res.setHeader('Content-type', 'application/sql');
    res.send(dump);
  } catch (error) {
    console.error('Backup error:', error);
    res.status(500).json({ error: 'Error generating SQL backup' });
  }
});

module.exports = router;
