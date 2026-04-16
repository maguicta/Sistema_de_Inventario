const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

// GET /api/auth/branches
router.get('/branches', async (req, res) => {
  try {
    const [branches] = await pool.query('SELECT id, name FROM branches');
    res.json(branches);
  } catch (error) {
    console.error('Error al cargar sucursales:', error.message);
    res.status(500).json({ error: 'Error al cargar sucursales: ' + error.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password, branch_id } = req.body;
    if (!email || !password || !branch_id) {
      return res.status(400).json({ error: 'Email, contraseña y sucursal son requeridos' });
    }

    const [users] = await pool.query('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const assignedBranchId = user.role === 'admin' ? parseInt(branch_id) : user.branch_id;

    const token = jwt.sign(
      { id: user.id, name: user.name, email: user.email, role: user.role, avatar_color: user.avatar_color, can_edit: user.can_edit, can_delete: user.can_delete, branch_id: assignedBranchId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, avatar_color: user.avatar_color, can_edit: user.can_edit, can_delete: user.can_delete, branch_id: assignedBranchId }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [users] = await pool.query('SELECT id, name, email, role, avatar_color, can_edit, can_delete FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    
    const [branchData] = await pool.query('SELECT name FROM branches WHERE id = ?', [req.user.branch_id]);
    const branchName = branchData[0] ? branchData[0].name : '';

    const userData = { ...users[0], branch_id: req.user.branch_id, branch_name: branchName };
    res.json(userData);
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
