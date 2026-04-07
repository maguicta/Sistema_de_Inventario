const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/sales
router.get('/', async (req, res) => {
  try {
    const { search, status, from, to, page = 1, limit = 50 } = req.query;
    let query = `SELECT s.*, u.name as user_name FROM sales s LEFT JOIN users u ON s.user_id = u.id WHERE 1=1`;
    const params = [];

    if (search) {
      query += ` AND (s.invoice_number LIKE ? OR s.customer_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) { query += ` AND s.status = ?`; params.push(status); }
    if (from) { query += ` AND DATE(s.created_at) >= ?`; params.push(from); }
    if (to) { query += ` AND DATE(s.created_at) <= ?`; params.push(to); }

    query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (page - 1) * parseInt(limit));

    const [sales] = await pool.query(query, params);
    res.json(sales);
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Error al obtener ventas' });
  }
});

// GET /api/sales/:id
router.get('/:id', async (req, res) => {
  try {
    const [sales] = await pool.query(
      `SELECT s.*, u.name as user_name FROM sales s LEFT JOIN users u ON s.user_id = u.id WHERE s.id = ?`,
      [req.params.id]
    );
    if (sales.length === 0) return res.status(404).json({ error: 'Venta no encontrada' });

    const [items] = await pool.query('SELECT * FROM sale_items WHERE sale_id = ?', [req.params.id]);
    res.json({ ...sales[0], items });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener venta' });
  }
});

// POST /api/sales
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { customer_name, items, payment_method, amount_paid, notes } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un producto' });
    }

    let subtotal = 0;
    for (const item of items) {
      subtotal += item.quantity * item.unit_price;
    }
    const total = subtotal;

    // Generate invoice number
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const [countResult] = await conn.query(
      `SELECT COUNT(*) as count FROM sales WHERE DATE(created_at) = CURDATE()`
    );
    const invoiceNum = `INV-${dateStr}-${String(countResult[0].count + 1).padStart(3, '0')}`;

    const changeAmount = (amount_paid || total) - total;

    const [result] = await conn.query(
      `INSERT INTO sales (invoice_number, user_id, customer_name, subtotal, total, payment_method, amount_paid, change_amount, status, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completada', ?)`,
      [invoiceNum, req.user.id, customer_name || 'Cliente General', subtotal, total, payment_method || 'efectivo', amount_paid || total, changeAmount, notes || null]
    );

    const saleId = result.insertId;

    for (const item of items) {
      // Get current product
      const [product] = await conn.query('SELECT * FROM products WHERE id = ?', [item.product_id]);
      if (product.length === 0) throw new Error(`Producto ${item.product_id} no encontrado`);
      if (product[0].stock < item.quantity) throw new Error(`Stock insuficiente para ${product[0].name}`);

      await conn.query(
        `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [saleId, item.product_id, product[0].name, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );

      // Update stock
      const newStock = product[0].stock - item.quantity;
      await conn.query('UPDATE products SET stock = ? WHERE id = ?', [newStock, item.product_id]);

      // Register movement
      await conn.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, notes, user_id) 
         VALUES (?, 'venta', ?, ?, ?, ?, ?, ?)`,
        [item.product_id, item.quantity, product[0].stock, newStock, saleId, `Venta ${invoiceNum}`, req.user.id]
      );
    }

    await conn.commit();

    const [sale] = await conn.query('SELECT * FROM sales WHERE id = ?', [saleId]);
    const [saleItems] = await conn.query('SELECT * FROM sale_items WHERE sale_id = ?', [saleId]);
    res.status(201).json({ ...sale[0], items: saleItems });
  } catch (error) {
    await conn.rollback();
    console.error('Create sale error:', error);
    res.status(500).json({ error: error.message || 'Error al crear venta' });
  } finally {
    conn.release();
  }
});

module.exports = router;
