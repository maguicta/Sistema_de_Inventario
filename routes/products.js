const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, canEdit, canDelete } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/products
router.get('/', async (req, res) => {
  try {
    const { search, category, supplier, status, low_stock, page = 1, limit = 50 } = req.query;
    let query = `SELECT p.*, c.name as category_name, c.color as category_color, s.name as supplier_name 
                 FROM products p 
                 LEFT JOIN categories c ON p.category_id = c.id 
                 LEFT JOIN suppliers s ON p.supplier_id = s.id
                 WHERE p.branch_id = ?`;
    const params = [req.user.branch_id || 1];

    if (search) {
      query += ` AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) { query += ` AND p.category_id = ?`; params.push(category); }
    if (supplier) { query += ` AND p.supplier_id = ?`; params.push(supplier); }
    if (status) { query += ` AND p.status = ?`; params.push(status); }
    if (low_stock === 'true') { query += ` AND p.stock <= p.min_stock`; }
    
    const { expiring } = req.query;
    if (expiring === 'true') {
      query += ` AND p.expiration_date IS NOT NULL AND p.expiration_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)`;
    }

    query += ` ORDER BY p.updated_at DESC`;

    const offset = (page - 1) * limit;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [products] = await pool.query(query, params);

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM products', []);
    res.json({ products, total: countResult[0].total });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// GET /api/products/expiring
router.get('/reports/expiring', async (req, res) => {
  try {
    const [products] = await pool.query(
      `SELECT p.id, p.name, p.sku, p.stock, p.expiration_date, c.name as category_name
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.expiration_date IS NOT NULL 
       AND p.expiration_date <= DATE_ADD(CURDATE(), INTERVAL 30 DAY)
       AND p.branch_id = ?
       ORDER BY p.expiration_date ASC`,
      [req.user.branch_id || 1]
    );
    res.json(products);
  } catch (error) {
    console.error('Get expiring products error:', error);
    res.status(500).json({ error: 'Error al obtener productos por vencer' });
  }
});

// GET /api/products/:id
router.get('/:id', async (req, res) => {
  try {
    const [products] = await pool.query(
      `SELECT p.*, c.name as category_name, s.name as supplier_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    if (products.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(products[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener producto' });
  }
});

// POST /api/products
router.post('/', canEdit, async (req, res) => {
  try {
    const { name, description, sku, barcode, category_id, supplier_id, price, cost, stock, min_stock, unit, image_url, expiration_date } = req.body;
    if (!name || !sku || !price) {
      return res.status(400).json({ error: 'Nombre, SKU y precio son requeridos' });
    }

    const branch_id = req.user.branch_id || 1;
    const [result] = await pool.query(
      `INSERT INTO products (name, description, sku, barcode, category_id, supplier_id, price, cost, stock, min_stock, unit, image_url, expiration_date, branch_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, description || '', sku, barcode || null, category_id || null, supplier_id || null, price, cost || 0, stock || 0, min_stock || 5, unit || 'unidad', image_url || null, expiration_date || null, branch_id]
    );

    // Register inventory movement
    if (stock > 0) {
      await pool.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, notes, user_id) 
         VALUES (?, 'entrada', ?, 0, ?, 'Stock inicial', ?)`,
        [result.insertId, stock, stock, req.user.id]
      );
    }

    const [newProduct] = await pool.query('SELECT * FROM products WHERE id = ?', [result.insertId]);
    res.status(201).json(newProduct[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El SKU ya existe' });
    }
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// PUT /api/products/:id
router.put('/:id', canEdit, async (req, res) => {
  try {
    const { name, description, sku, barcode, category_id, supplier_id, price, cost, stock, min_stock, unit, status, image_url, expiration_date } = req.body;
    
    const [current] = await pool.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (current.length === 0) return res.status(404).json({ error: 'Producto no encontrado' });

    await pool.query(
      `UPDATE products SET name = ?, description = ?, sku = ?, barcode = ?, category_id = ?, supplier_id = ?, price = ?, cost = ?, 
       stock = ?, min_stock = ?, unit = ?, status = ?, image_url = ?, expiration_date = ? WHERE id = ?`,
      [name, description, sku, barcode, category_id || null, supplier_id || null, price, cost, stock, min_stock, unit, status || 'active', image_url || null, expiration_date || null, req.params.id]
    );

    // Track stock changes
    if (stock !== undefined && stock !== current[0].stock) {
      await pool.query(
        `INSERT INTO inventory_movements (product_id, type, quantity, previous_stock, new_stock, notes, user_id) 
         VALUES (?, ?, ?, ?, ?, 'Ajuste manual', ?)`,
        [req.params.id, 'ajuste', Math.abs(stock - current[0].stock), current[0].stock, stock, req.user.id]
      );
    }

    const [updated] = await pool.query(
      `SELECT p.*, c.name as category_name, s.name as supplier_name 
       FROM products p 
       LEFT JOIN categories c ON p.category_id = c.id 
       LEFT JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.id = ?`,
      [req.params.id]
    );
    res.json(updated[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El SKU ya existe' });
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// DELETE /api/products/:id
router.delete('/:id', canDelete, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ message: 'Producto eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar producto' });
  }
});

module.exports = router;
