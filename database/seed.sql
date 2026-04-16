-- ============================================
-- INVENTARIO PRO - Datos Iniciales
-- Se ejecuta después de schema.sql
-- ============================================

SET NAMES utf8mb4;

-- ============================================
-- Sucursal por defecto
-- ============================================
INSERT INTO `branches` (`id`, `name`) VALUES 
(1, 'Sucursal Principal')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ============================================
-- Usuario administrador por defecto
-- Contraseña: admin123 (hash bcrypt)
-- ============================================
INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`, `avatar_color`, `can_edit`, `can_delete`, `is_active`, `branch_id`) VALUES 
(1, 'Administrador', 'admin@sistema.com', '$2a$12$LJ3m4ys3GZfM0QyE3lJ9aeGZ7QLq3Iy.ZFmjHfv3p0fVHnPd1EpOy', 'admin', '#6366f1', 1, 1, 1, 1)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- ============================================
-- Configuración inicial del sistema
-- ============================================
INSERT INTO `settings` (`setting_key`, `setting_value`) VALUES
('store_name', 'Inventario Pro'),
('theme', 'midnight'),
('currency_base', 'DOP'),
('currency_symbol', 'RD$'),
('currency_secondary', 'USD'),
('exchange_rate', '1.0000'),
('tax_rate', '18.00'),
('exchange_refresh_interval', '0'),
('allow_negative_stock', 'false')
ON DUPLICATE KEY UPDATE `setting_value` = VALUES(`setting_value`);
