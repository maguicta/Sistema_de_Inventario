const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/purchase-orders
router.get('/', async (req, res) => {
  try {
    const { search, status, from, to, page = 1, limit = 50 } = req.query;
    let query = `SELECT po.*, u.name as user_name, sup.name as supplier_name 
                 FROM purchase_orders po 
                 LEFT JOIN users u ON po.user_id = u.id 
                 LEFT JOIN suppliers sup ON po.supplier_id = sup.id
                 WHERE po.branch_id = ?`;
    const params = [req.user.branch_id || 1];

    if (search) {
      query += ` AND (po.order_number LIKE ? OR sup.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (status) { query += ` AND po.status = ?`; params.push(status); }
    if (from) { query += ` AND DATE(po.created_at) >= ?`; params.push(from); }
    if (to) { query += ` AND DATE(po.created_at) <= ?`; params.push(to); }

    query += ` ORDER BY po.created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), (page - 1) * parseInt(limit));

    const [orders] = await pool.query(query, params);
    res.json(orders);
  } catch (error) {
    console.error('Get purchase orders error:', error);
    res.status(500).json({ error: 'Error al obtener órdenes de compra' });
  }
});

// GET /api/purchase-orders/:id
router.get('/:id', async (req, res) => {
  try {
    const [orders] = await pool.query(
      `SELECT po.*, u.name as user_name, sup.name as supplier_name 
       FROM purchase_orders po 
       LEFT JOIN users u ON po.user_id = u.id 
       LEFT JOIN suppliers sup ON po.supplier_id = sup.id
       WHERE po.id = ? AND po.branch_id = ?`,
      [req.params.id, req.user.branch_id || 1]
    );
    if (orders.length === 0) return res.status(404).json({ error: 'Orden de compra no encontrada' });

    const [items] = await pool.query('SELECT poi.*, p.sku FROM purchase_order_items poi LEFT JOIN products p ON poi.product_id = p.id WHERE poi.purchase_order_id = ?', [req.params.id]);
    res.json({ ...orders[0], items });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener orden de compra' });
  }
});

// POST /api/purchase-orders
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const { supplier_id, items, notes } = req.body;
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un producto' });
    }

    let subtotal = 0;
    for (const item of items) {
      subtotal += item.quantity * item.unit_cost;
    }
    const total = subtotal;

    // Generate order number
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const [countResult] = await conn.query(
      `SELECT COUNT(*) as count FROM purchase_orders WHERE DATE(created_at) = CURDATE() AND branch_id = ?`, [req.user.branch_id || 1]
    );
    const orderNum = `ORD-${dateStr}-${String(countResult[0].count + 1).padStart(3, '0')}`;

    const [result] = await conn.query(
      `INSERT INTO purchase_orders (order_number, user_id, supplier_id, subtotal, total, status, notes, branch_id) 
       VALUES (?, ?, ?, ?, ?, 'pendiente', ?, ?)`,
      [orderNum, req.user.id, supplier_id, subtotal, total, notes || null, req.user.branch_id || 1]
    );

    const orderId = result.insertId;

    for (const item of items) {
      await conn.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, product_name, quantity, unit_cost, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.product_name, item.quantity, item.unit_cost, item.quantity * item.unit_cost]
      );
    }

    await conn.commit();
    res.status(201).json({ id: orderId, order_number: orderNum });
  } catch (error) {
    await conn.rollback();
    console.error('Create purchase order error:', error);
    res.status(500).json({ error: 'Error al crear orden de compra' });
  } finally {
    conn.release();
  }
});

// PATCH /api/purchase-orders/:id/status (Receive Order)
router.patch('/:id/status', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { status, invoice_file_url } = req.body;
    const [orders] = await conn.query('SELECT * FROM purchase_orders WHERE id = ? AND branch_id = ?', [req.params.id, req.user.branch_id || 1]);
    if (orders.length === 0) return res.status(404).json({ error: 'Orden no encontrada' });

    const currentOrder = orders[0];
    if (currentOrder.status === 'recibida' && status === 'recibida') {
        return res.status(400).json({ error: 'La orden ya fue recibida' });
    }

    await conn.beginTransaction();

    // If receiving, update stock
    if (status === 'recibida') {
      const [items] = await conn.query('SELECT * FROM purchase_order_items WHERE purchase_order_id = ?', [req.params.id]);
      for (const item of items) {
        if (item.product_id) {
            const [product] = await conn.query('SELECT * FROM products WHERE id = ?', [item.product_id]);
            if (product.length > 0) {
              const newStock = product[0].stock + item.quantity;
              await conn.query('UPDATE products SET stock = ?, cost = ? WHERE id = ?', [newStock, item.unit_cost, item.product_id]);
              
              // Register movement
              await conn.query(
                `INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, reference_id, notes, user_id) 
                 VALUES (?, 'entrada', ?, ?, ?, ?, ?, ?)`,
                [item.product_id, item.quantity, product[0].stock, newStock, req.params.id, `Orden de Compra ${currentOrder.order_number}`, req.user.id]
              );
            }
        }
      }
    }

    await conn.query('UPDATE purchase_orders SET status = ?, invoice_file_url = ? WHERE id = ?', [status, invoice_file_url || currentOrder.invoice_file_url, req.params.id]);

    await conn.commit();
    res.json({ success: true });
  } catch (error) {
    await conn.rollback();
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Error al actualizar estado' });
  } finally {
    conn.release();
  }
});

module.exports = router;
