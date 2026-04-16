const jwt = require('jsonwebtoken');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requieren permisos de administrador.' });
  }
  next();
}

function canEdit(req, res, next) {
  if (req.user.role === 'admin' || req.user.can_edit == 1) return next();
  return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para editar/crear.' });
}

function canDelete(req, res, next) {
  if (req.user.role === 'admin' || req.user.can_delete == 1) return next();
  return res.status(403).json({ error: 'Acceso denegado. No tienes permiso para eliminar.' });
}

module.exports = { authMiddleware, adminOnly, canEdit, canDelete };
