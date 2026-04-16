const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const branch_id = req.user.branch_id || 1;
    const [totalProducts] = await pool.query("SELECT COUNT(*) as count FROM products WHERE status = 'active' AND branch_id = ?", [branch_id]);
    const [totalCategories] = await pool.query('SELECT COUNT(*) as count FROM categories WHERE is_active = 1');
    const [lowStock] = await pool.query("SELECT COUNT(*) as count FROM products WHERE stock <= min_stock AND status = 'active' AND branch_id = ?", [branch_id]);
    const [todaySales] = await pool.query(
      "SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM sales s WHERE DATE(s.created_at) = CURDATE() AND s.status = 'completada' AND s.branch_id = ?", [branch_id]
    );
    const [monthSales] = await pool.query(
      "SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total FROM sales s WHERE MONTH(s.created_at) = MONTH(CURDATE()) AND YEAR(s.created_at) = YEAR(CURDATE()) AND s.status = 'completada' AND s.branch_id = ?", [branch_id]
    );
    const [inventoryValue] = await pool.query(
      "SELECT COALESCE(SUM(price * stock), 0) as retail_value, COALESCE(SUM(cost * stock), 0) as cost_value FROM products WHERE status = 'active' AND branch_id = ?", [branch_id]
    );
    const [monthExpenses] = await pool.query(
      "SELECT COALESCE(SUM(amount), 0) as total FROM expenses e WHERE MONTH(e.created_at) = MONTH(CURDATE()) AND YEAR(e.created_at) = YEAR(CURDATE()) AND e.branch_id = ?", [branch_id]
    );

    res.json({
      totalProducts: totalProducts[0].count,
      totalCategories: totalCategories[0].count,
      lowStock: lowStock[0].count,
      todaySalesCount: todaySales[0].count,
      todaySalesTotal: todaySales[0].total,
      monthSalesCount: monthSales[0].count,
      monthSalesTotal: monthSales[0].total,
      inventoryRetailValue: inventoryValue[0].retail_value,
      inventoryCostValue: inventoryValue[0].cost_value,
      monthExpensesTotal: monthExpenses[0].total
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

// GET /api/dashboard/sales-chart
router.get('/sales-chart', async (req, res) => {
  try {
    const branch_id = req.user.branch_id || 1;
    const [data] = await pool.query(`
      SELECT DATE(created_at) as date, COUNT(*) as count, SUM(total) as total 
      FROM sales WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND status = 'completada' AND branch_id = ?
      GROUP BY DATE(created_at) ORDER BY date
    `, [branch_id]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener datos del gráfico' });
  }
});

// GET /api/dashboard/top-products
router.get('/top-products', async (req, res) => {
  try {
    const branch_id = req.user.branch_id || 1;
    const [data] = await pool.query(`
      SELECT si.product_name, SUM(si.quantity) as total_sold, SUM(si.subtotal) as total_revenue
      FROM sale_items si JOIN sales s ON si.sale_id = s.id
      WHERE s.created_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND s.status = 'completada' AND s.branch_id = ?
      GROUP BY si.product_id, si.product_name ORDER BY total_sold DESC LIMIT 10
    `, [branch_id]);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos más vendidos' });
  }
});

// GET /api/dashboard/recent-sales
router.get('/recent-sales', async (req, res) => {
  try {
    const branch_id = req.user.branch_id || 1;
    const [sales] = await pool.query(`
      SELECT s.*, u.name as user_name FROM sales s 
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.branch_id = ?
      ORDER BY s.created_at DESC LIMIT 10
    `, [branch_id]);
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ventas recientes' });
  }
});

// GET /api/dashboard/low-stock
router.get('/low-stock', async (req, res) => {
  try {
    const branch_id = req.user.branch_id || 1;
    const [products] = await pool.query(`
      SELECT p.*, c.name as category_name FROM products p 
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.stock <= p.min_stock AND p.status = 'active' AND p.branch_id = ?
      ORDER BY (p.stock / p.min_stock) ASC LIMIT 10
    `, [branch_id]);
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener productos con bajo stock' });
  }
});

module.exports = router;
