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

module.exports = router;
