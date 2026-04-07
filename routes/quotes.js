const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/quotes
router.get('/', async (req, res) => {
  try {
    const { search, status, from, to, page = 1, limit = 50 } = req.query;
    let query = `SELECT q.*, u.name as user_name FROM quotes q LEFT JOIN users u ON q.user_id = u.id WHERE 1=1`;
    const params = [];

    if (search) {
      query += ` AND (q.quote_number LIKE ? OR q.customer_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) { query += ` AND q.status = ?`; params.push(status); }
    if (from) { query += ` AND DATE(q.created_at) >= ?`; params.push(from); }
    if (to) { query += ` AND DATE(q.created_at) <= ?`; params.push(to); }

    query += ` ORDER BY q.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (page - 1) * parseInt(limit));

    const [quotes] = await pool.query(query, params);
    res.json(quotes);
  } catch (error) {
    console.error('Get quotes error:', error);
    res.status(500).json({ error: 'Error al obtener cotizaciones' });
  }
});

// GET /api/quotes/:id
router.get('/:id', async (req, res) => {
  try {
    const [quotes] = await pool.query(
      `SELECT q.*, u.name as user_name FROM quotes q LEFT JOIN users u ON q.user_id = u.id WHERE q.id = ?`,
      [req.params.id]
    );
    if (quotes.length === 0) return res.status(404).json({ error: 'Cotización no encontrada' });

    const [items] = await pool.query('SELECT * FROM quote_items WHERE quote_id = ?', [req.params.id]);
    res.json({ ...quotes[0], items });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener cotización' });
  }
});

// POST /api/quotes
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { customer_name, items, expiration_date, notes } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un producto' });
    }

    let subtotal = 0;
    for (const item of items) {
      subtotal += item.quantity * item.unit_price;
    }
    const total = subtotal;

    // Generate quote number
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const [countResult] = await conn.query(
      `SELECT COUNT(*) as count FROM quotes WHERE DATE(created_at) = CURDATE()`
    );
    const quoteNum = `COT-${dateStr}-${String(countResult[0].count + 1).padStart(3, '0')}`;

    const [result] = await conn.query(
      `INSERT INTO quotes (quote_number, user_id, customer_name, subtotal, total, status, expiration_date, notes) 
       VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
      [quoteNum, req.user.id, customer_name || 'Cliente General', subtotal, total, expiration_date || null, notes || null]
    );

    const quoteId = result.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO quote_items (quote_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [quoteId, item.product_id, item.product_name, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }

    await conn.commit();
    res.status(201).json({ id: quoteId, quote_number: quoteNum });
  } catch (error) {
    await conn.rollback();
    console.error('Create quote error:', error);
    res.status(500).json({ error: 'Error al crear cotización' });
  } finally {
    conn.release();
  }
});

// PATCH /api/quotes/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    await pool.query('UPDATE quotes SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

module.exports = router;
