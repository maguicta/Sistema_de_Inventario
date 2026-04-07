const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { authMiddleware, adminOnly } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/users
router.get('/', adminOnly, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, role, avatar_color, is_active, can_edit, can_delete, created_at FROM users ORDER BY created_at DESC');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/users
router.post('/', adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, avatar_color, can_edit, can_delete } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];
    const color = avatar_color || colors[Math.floor(Math.random() * colors.length)];

    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, avatar_color, can_edit, can_delete) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, email, hashedPassword, role || 'vendedor', color, can_edit ? 1 : 0, can_delete ? 1 : 0]
    );

    const [newUser] = await pool.query('SELECT id, name, email, role, avatar_color, can_edit, can_delete, created_at FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(newUser[0]);
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El email ya está registrado' });
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/users/:id
router.put('/:id', adminOnly, async (req, res) => {
  try {
    const { name, email, password, role, can_edit, can_delete, is_active } = req.body;
    let query = 'UPDATE users SET name = ?, email = ?, role = ?, can_edit = ?, can_delete = ?, is_active = ?';
    const params = [name, email, role, can_edit ? 1 : 0, can_delete ? 1 : 0, is_active ? 1 : 0];

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 12);
      query += ', password = ?';
      params.push(hashedPassword);
    }

    query += ' WHERE id = ?';
    params.push(req.params.id);

    await pool.query(query, params);
    
    // Si editamos nuestro propio perfil, actualizamos el rol (esto lo manejamos en el frontend realmente)
    res.json({ message: 'Usuario actualizado' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'El email ya existe' });
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});
router.delete('/:id', adminOnly, async (req, res) => {
  try {
    if (req.user.id === parseInt(req.params.id)) return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Usuario desactivado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;
