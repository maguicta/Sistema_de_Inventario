const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, canEdit, canDelete } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/expenses
router.get('/', async (req, res) => {
  try {
    const { from, to } = req.query;
    let query = `SELECT e.*, u.name as user_name FROM expenses e LEFT JOIN users u ON e.user_id = u.id WHERE e.branch_id = ?`;
    const params = [req.user.branch_id || 1];

    if (from) { query += ` AND DATE(e.created_at) >= ?`; params.push(from); }
    if (to) { query += ` AND DATE(e.created_at) <= ?`; params.push(to); }

    query += ` ORDER BY e.created_at DESC`;

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Error al obtener gastos' });
  }
});

// POST /api/expenses
router.post('/', canEdit, async (req, res) => {
  try {
    const { category, amount, description } = req.body;
    if (!category || !amount) return res.status(400).json({ error: 'Categoría y monto son requeridos' });

    const [result] = await pool.query(
      'INSERT INTO expenses (category, amount, description, user_id, branch_id) VALUES (?, ?, ?, ?, ?)',
      [category, amount, description || '', req.user.id, req.user.branch_id || 1]
    );

    const [newExpense] = await pool.query('SELECT * FROM expenses WHERE id = ?', [result.insertId]);
    res.status(201).json(newExpense[0]);
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Error al crear gasto' });
  }
});

// DELETE /api/expenses/:id
router.delete('/:id', canDelete, async (req, res) => {
  try {
    await pool.query('DELETE FROM expenses WHERE id = ? AND branch_id = ?', [req.params.id, req.user.branch_id || 1]);
    res.json({ message: 'Gasto eliminado' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Error al eliminar gasto' });
  }
});

module.exports = router;
