const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function initDatabase() {
  console.log('🔧 Inicializando base de datos...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    multipleStatements: true
  });

  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await connection.query(schema);
    console.log('✅ Esquema creado correctamente');

    await connection.query('USE inventory_system');

    // Usuario admin por defecto
    const hashedPassword = await bcrypt.hash('admin123', 12);
    await connection.query(
      `INSERT IGNORE INTO users (name, email, password, role, avatar_color) VALUES (?, ?, ?, ?, ?)`,
      ['Administrador', 'admin@sistema.com', hashedPassword, 'admin', '#6366f1']
    );
    console.log('✅ Usuario admin creado (admin@sistema.com / admin123)');

    // Categorías de ejemplo
    const categories = [
      ['Electrónica', 'Dispositivos y accesorios electrónicos', '#6366f1', 'cpu'],
      ['Ropa', 'Prendas de vestir y accesorios', '#ec4899', 'shirt'],
      ['Alimentos', 'Productos alimenticios y bebidas', '#f59e0b', 'apple'],
      ['Hogar', 'Artículos para el hogar', '#10b981', 'home'],
      ['Deportes', 'Equipamiento deportivo', '#3b82f6', 'dumbbell'],
      ['Oficina', 'Suministros y mobiliario de oficina', '#8b5cf6', 'briefcase']
    ];

    for (const cat of categories) {
      await connection.query(
        `INSERT IGNORE INTO categories (name, description, color, icon) VALUES (?, ?, ?, ?)`,
        cat
      );
    }
    console.log('✅ Categorías de ejemplo creadas');

    // Proveedores de ejemplo
    const suppliers = [
      ['Distribuidora Global', 'Juan Pérez', 'ventas@global.com', '809-555-0101', 'Av. Central 123', '1-01-00001-1'],
      ['TecnoMayorista', 'Ana Rodríguez', 'ana@tecno.com', '809-555-0202', 'Parque Industrial Sur', '1-02-00002-2'],
      ['Suministros del Caribe', 'Carlos Matos', 'soporte@caribe.com', '809-555-0303', 'Calle B #45', '1-03-00003-3']
    ];

    for (const sup of suppliers) {
      await connection.query(
        `INSERT IGNORE INTO suppliers (name, contact_person, email, phone, address, tax_id) VALUES (?, ?, ?, ?, ?, ?)`,
        sup
      );
    }
    console.log('✅ Proveedores de ejemplo creados');

    // Productos de ejemplo
    const products = [
      ['Laptop HP Pavilion 15', 'Laptop HP con Intel i5, 8GB RAM, 256GB SSD', 'ELEC-001', 1, 2, 899.99, 650.00, 25, 5, 'unidad'],
      ['Mouse Inalámbrico Logitech', 'Mouse ergonómico inalámbrico', 'ELEC-002', 1, 2, 29.99, 15.00, 150, 20, 'unidad'],
      ['Teclado Mecánico RGB', 'Teclado mecánico con switches Cherry MX', 'ELEC-003', 1, 2, 79.99, 45.00, 60, 10, 'unidad'],
      ['Monitor Samsung 27"', 'Monitor LED Full HD 27 pulgadas', 'ELEC-004', 1, 2, 299.99, 200.00, 18, 5, 'unidad'],
      ['Camiseta Algodón Premium', 'Camiseta 100% algodón, varios colores', 'ROPA-001', 2, 1, 24.99, 8.00, 200, 30, 'unidad'],
      ['Pantalón Jeans Classic', 'Jeans corte clásico', 'ROPA-002', 2, 1, 49.99, 20.00, 80, 15, 'unidad'],
      ['Café Colombiano 500g', 'Café molido premium de Colombia', 'ALIM-001', 3, 3, 12.99, 6.50, 300, 50, 'unidad'],
      ['Aceite de Oliva Extra Virgen', 'Aceite de oliva importado 1L', 'ALIM-002', 3, 3, 15.99, 8.00, 100, 20, 'unidad'],
      ['Lámpara LED Escritorio', 'Lámpara LED con regulación de brillo', 'HOGR-001', 4, 1, 34.99, 18.00, 45, 10, 'unidad'],
      ['Set Toallas Premium', 'Set de 4 toallas de algodón egipcio', 'HOGR-002', 4, 1, 39.99, 15.00, 60, 10, 'unidad'],
      ['Balón de Fútbol Pro', 'Balón oficial tamaño 5', 'DEPO-001', 5, 1, 44.99, 22.00, 35, 8, 'unidad'],
      ['Mancuernas 5kg Par', 'Par de mancuernas de neopreno', 'DEPO-002', 5, 1, 29.99, 14.00, 40, 10, 'unidad'],
      ['Cuaderno Ejecutivo A5', 'Cuaderno pasta dura 200 páginas', 'OFIC-001', 6, 3, 9.99, 3.50, 500, 50, 'unidad'],
      ['Bolígrafos Pack x12', 'Pack de 12 bolígrafos tinta gel', 'OFIC-002', 6, 3, 7.99, 2.50, 300, 40, 'unidad'],
      ['Audífonos Bluetooth Sony', 'Audífonos over-ear con cancelación de ruido', 'ELEC-005', 1, 2, 199.99, 120.00, 30, 5, 'unidad'],
      ['Webcam HD 1080p', 'Cámara web Full HD con micrófono', 'ELEC-006', 1, 2, 59.99, 30.00, 40, 8, 'unidad'],
      ['Zapatillas Running', 'Zapatillas deportivas amortiguación gel', 'DEPO-003', 5, 1, 89.99, 42.00, 55, 10, 'unidad'],
      ['Silla Ergonómica Oficina', 'Silla con soporte lumbar ajustable', 'OFIC-003', 6, 1, 249.99, 130.00, 12, 3, 'unidad'],
    ];

    for (const prod of products) {
      await connection.query(
        `INSERT IGNORE INTO products (name, description, sku, category_id, supplier_id, price, cost, stock, min_stock, unit) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        prod
      );
    }
    console.log('✅ Productos de ejemplo creados');

    // Ventas de ejemplo
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
      const salesCount = Math.floor(Math.random() * 4) + 1;
      for (let j = 0; j < salesCount; j++) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        date.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 60));

        const invoiceNum = `INV-${String(date.getFullYear())}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${String(j + 1).padStart(3, '0')}`;
        const itemCount = Math.floor(Math.random() * 3) + 1;
        const methods = ['efectivo', 'tarjeta', 'transferencia'];
        const method = methods[Math.floor(Math.random() * methods.length)];

        let saleTotal = 0;
        const items = [];
        for (let k = 0; k < itemCount; k++) {
          const prodIdx = Math.floor(Math.random() * products.length);
          const qty = Math.floor(Math.random() * 3) + 1;
          const price = products[prodIdx][5];
          const subtotal = qty * price;
          saleTotal += subtotal;
          items.push({ productIdx: prodIdx + 1, name: products[prodIdx][0], qty, price, subtotal });
        }

        try {
          const [result] = await connection.query(
            `INSERT INTO sales (invoice_number, user_id, customer_name, subtotal, total, payment_method, amount_paid, change_amount, status, created_at)
             VALUES (?, 1, 'Cliente General', ?, ?, ?, ?, 0, 'completada', ?)`,
            [invoiceNum, saleTotal, saleTotal, method, saleTotal, date]
          );
          const saleId = result.insertId;
          for (const item of items) {
            await connection.query(
              `INSERT INTO sale_items (sale_id, product_id, product_name, quantity, unit_price, subtotal) VALUES (?, ?, ?, ?, ?, ?)`,
              [saleId, item.productIdx, item.name, item.qty, item.price, item.subtotal]
            );
          }
        } catch (e) {
          // Skip duplicates
        }
      }
    }
    console.log('✅ Ventas de ejemplo creadas');

    // Configuración inicial
    const settings = [
      ['store_name', 'Mi Tienda de Inventario'],
      ['currency_base', 'USD'],
      ['currency_symbol', '$'],
      ['currency_secondary', 'DOP'],
      ['exchange_rate', '58.50'],
      ['tax_rate', '18.00'],
      ['allow_negative_stock', 'false']
    ];

    for (const setting of settings) {
      await connection.query(
        `INSERT IGNORE INTO settings (setting_key, setting_value) VALUES (?, ?)`,
        setting
      );
    }
    console.log('✅ Configuración inicial creada');

    console.log('\n🚀 Base de datos inicializada correctamente!');
    console.log('📧 Login: admin@sistema.com');
    console.log('🔑 Password: admin123\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await connection.end();
  }
}

initDatabase();
