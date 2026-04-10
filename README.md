[DOCUMENTACION_CLIENTE.md](https://github.com/user-attachments/files/26553715/DOCUMENTACION_CLIENTE.md)
# Manual de Usuario e Instalación - Sistema de Inventario

Este documento proporciona una guía completa para la instalación técnica y el uso operativo del sistema **Sistema de Inventario**.

---

## 1. Guía de Instalación (Para el Soporte Técnico)

### Requisitos Previos
- **Node.js**: Versión 16 o superior.
- **MySQL**: Versión 8.0 o superior (o MariaDB).
- **Navegador**: Chrome, Edge o Firefox (recomendado para el scanner y QR).

### Pasos de Instalación
1. **Preparación de Archivos**: Descomprimir el archivo `sistema_inventario.zip` en la carpeta de destino.
2. **Renombra el archivo _.env  tiene que queda .env
3. **Instalación de Dependencias**: Abrir una terminal en la carpeta y ejecutar:
   ```bash
   npm install
   ```
4. **Base de Datos**: 
   - Crear una base de datos llamada `inventario_db`.
   - Importar el archivo `database/schema.sql` para crear las tablas básicas.
   - Ejecutar el script inicializador para crear el usuario administrador por defecto:
     ```bash
     node database/init.js
     ```
5. **Configuración del Entorno**: 
   - 
   - Editar los datos de conexión a MySQL y el puerto del servidor.
6. **Inicio en Windows**: 
   - Ejecutar el archivo `iniciar_sistema.bat`. Este script instalará dependencias si no existen y arrancará el servidor automáticamente.
   - El sistema estará disponible en `http://localhost:3000`.

---

## 2. Manual de Usuario (Para el Personal de la Tienda)

### Acceso al Sistema
- **Usuario por defecto**: `admin@sistema.com`
- **Contraseña**: `admin123`
*(Se recomienda cambiarla inmediatamente en la sección de Usuarios).*

---

### Módulo de Ventas (Punto de Venta)
Es el corazón del negocio. Permite realizar ventas de forma rápida.
1. Haz clic en **"Nueva Venta"**.
2. **Búsqueda**: Puedes escribir el nombre del producto o usar un **Escáner de Código de Barras** pulsando el icono de la cámara.
3. **Carrito**: Haz clic en los productos para agregarlos. Puedes ajustar las cantidades con los botones `+` y `-`.
4. **Finalizar**: Selecciona el método de pago (Efectivo, Tarjeta, etc.) e indica el monto pagado. El sistema calculará el cambio automáticamente.
5. **Ticket**: Al completar la venta, se generará un ticket térmico listo para imprimir.

---

### Módulo de Inventario y Productos
Aquí se gestiona qué vendes y cuánto te queda.
- **Productos**: Puedes ver el stock actual por colores (Rojo = Sin stock, Naranja = Stock bajo).
- **Nuevo Producto**: Ingresa el nombre, precio de venta, costo, SKU y fecha de vencimiento.
- **Vencimientos**: Consulta la sección específica para saber qué productos caducan pronto y evitar pérdidas.

---

### Cotizaciones y Presupuestos
Ideal para clientes que consultan precios antes de comprar.
1. En **"Cotizaciones"**, pulsa **"Nueva Cotización"**.
2. Agrega los productos solicitados.
3. **Imprimir**: Puedes entregar un documento impreso al cliente.
4. **Convertir a Venta**: Si el cliente acepta, busca la cotización y presiona el carrito de compras para que se convierta en una venta real y descuente el stock.

---

### Órdenes de Compra (Proveedores)
Usa esto para reponer mercancía.
1. Crea una **"Nueva Orden"** seleccionando al proveedor.
2. Agrega los items que vas a pedir.
3. Al recibir la mercancía físicamente, busca la orden y presiona **"Recibir Mercancía"**. Esto aumentará automáticamente el stock de tus productos sin que tengas que editarlos uno por uno.

---

### Reportes y Configuración
- **Dashboard**: Mira tus ganancias del día y del mes en tiempo real.
- **Reportes**: Genera cierres de caja diarios y PDF de inventario completo.
- **Moneda**: Si tu país usa múltiples divisas, puedes configurar una **tasa de cambio** que se actualice automáticamente.
- **Usuarios**: Crea cuentas para tus vendedores y limita lo que pueden ver (por ejemplo, que no puedan ver tus costos o borrar ventas).

---

> [!NOTE]
> **Consejo**: Manten siempre actualizados tus costos en la ficha del producto para que el sistema pueda decirte cuánto dinero real estás ganando de beneficio cada mes.
