const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, canEdit, canDelete } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/categories
router.get('/', async (req, res) => {
  try {
    const [categories] = await pool.query(
      `SELECT c.*, COUNT(p.id) as product_count 
       FROM categories c LEFT JOIN products p ON c.id = p.category_id AND p.status = 'active'
       WHERE c.is_active = 1 GROUP BY c.id ORDER BY c.name`
    );
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

// POST /api/categories
router.post('/', canEdit, async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Nombre es requerido' });

    const [result] = await pool.query(
      'INSERT INTO categories (name, description, color, icon) VALUES (?, ?, ?, ?)',
      [name, description || '', color || '#6366f1', icon || 'package']
    );
    const [newCat] = await pool.query('SELECT * FROM categories WHERE id = ?', [result.insertId]);
    res.status(201).json(newCat[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear categoría' });
  }
});

// PUT /api/categories/:id
router.put('/:id', canEdit, async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;
    await pool.query(
      'UPDATE categories SET name = ?, description = ?, color = ?, icon = ? WHERE id = ?',
      [name, description, color, icon, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar categoría' });
  }
});

// DELETE /api/categories/:id
router.delete('/:id', canDelete, async (req, res) => {
  try {
    await pool.query('UPDATE categories SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Categoría desactivada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar categoría' });
  }
});

module.exports = router;
