const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware, canEdit, canDelete } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/suppliers
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM suppliers WHERE is_active = 1 ORDER BY name ASC');
    res.json(rows);
  } catch (error) {
    console.error('Get suppliers error:', error);
    res.status(500).json({ error: 'Error al obtener proveedores' });
  }
});

// POST /api/suppliers
router.post('/', canEdit, async (req, res) => {
  try {
    const { name, contact_person, email, phone, address, tax_id } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

    const [result] = await pool.query(
      'INSERT INTO suppliers (name, contact_person, email, phone, address, tax_id) VALUES (?, ?, ?, ?, ?, ?)',
      [name, contact_person, email, phone, address, tax_id]
    );

    const [newSupplier] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [result.insertId]);
    res.status(201).json(newSupplier[0]);
  } catch (error) {
    console.error('Create supplier error:', error);
    res.status(500).json({ error: 'Error al crear proveedor' });
  }
});

// PUT /api/suppliers/:id
router.put('/:id', canEdit, async (req, res) => {
  try {
    const { name, contact_person, email, phone, address, tax_id, is_active } = req.body;
    await pool.query(
      'UPDATE suppliers SET name = ?, contact_person = ?, email = ?, phone = ?, address = ?, tax_id = ?, is_active = ? WHERE id = ?',
      [name, contact_person, email, phone, address, tax_id, is_active === undefined ? 1 : is_active, req.params.id]
    );
    const [updated] = await pool.query('SELECT * FROM suppliers WHERE id = ?', [req.params.id]);
    res.json(updated[0]);
  } catch (error) {
    console.error('Update supplier error:', error);
    res.status(500).json({ error: 'Error al actualizar proveedor' });
  }
});

// DELETE /api/suppliers/:id (Soft delete)
router.delete('/:id', canDelete, async (req, res) => {
  try {
    await pool.query('UPDATE suppliers SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Proveedor desactivado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al desactivar proveedor' });
  }
});

module.exports = router;
