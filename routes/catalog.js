const express = require('express');
const router = express.Router();
const pool = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const { search, category, branch_id = 1 } = req.query;
    let query = `
      SELECT p.id, p.name, p.description, p.price, p.image_url, p.stock, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.status = 'active' AND p.branch_id = ?
    `;
    const params = [branch_id];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (category) {
      query += ` AND p.category_id = ?`;
      params.push(category);
    }

    query += ` ORDER BY p.name ASC`;

    const [products] = await pool.query(query, params);
    res.json(products);
  } catch (error) {
    console.error('Get catalog error:', error);
    res.status(500).json({ error: 'Error al obtener el catálogo' });
  }
});

router.get('/settings/:branch_id', async (req, res) => {
    try {
        const [settings] = await pool.query('SELECT * FROM settings');
        let config = {};
        settings.forEach(s => config[s.setting_key] = s.setting_value);
        res.json({
            store_name: config.store_name,
            store_logo: config.store_logo,
            currency_symbol: config.currency_symbol
        });
    } catch(e) {
        res.status(500).json({});
    }
});

module.exports = router;
