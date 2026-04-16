const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// Removed global authMiddleware to allow public access to GET

// GET /api/branches
router.get('/', async (req, res) => {
  try {
    const [branches] = await pool.query('SELECT * FROM branches');
    res.json(branches);
  } catch (error) {
    console.error('Error al obtener sucursales:', error.message);
    res.status(500).json({ error: 'Error al obtener sucursales: ' + error.message });
  }
});

// POST /api/branches
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });
    const [result] = await pool.query('INSERT INTO branches (name) VALUES (?)', [name]);
    res.status(201).json({ id: result.insertId, name });
  } catch (error) {
    res.status(500).json({ error: 'Error al crear sucursal' });
  }
});

// PUT /api/branches/:id
router.put('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    const { name } = req.body;
    await pool.query('UPDATE branches SET name = ? WHERE id = ?', [name, req.params.id]);
    res.json({ id: req.params.id, name });
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar sucursal' });
  }
});

// DELETE /api/branches/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acceso denegado' });
  try {
    await pool.query('DELETE FROM branches WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
        return res.status(400).json({ error: 'No se puede eliminar porque hay datos asociados (usuarios/productos)' });
    }
    res.status(500).json({ error: 'Error al eliminar sucursal' });
  }
});

module.exports = router;
