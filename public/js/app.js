/* ============================================
   INVENTARIO PRO - Frontend Application
   ============================================ */

const API = '';
let token = localStorage.getItem('token');
let currentUser = null;
let currentSection = 'dashboard';
let cart = [];
let settings = {};
let html5QrCode = null;
let exchangeRefreshTimer = null;

// ============================================ API HELPER ============================================
async function api(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  let res;
  try {
    res = await fetch(`${API}${endpoint}`, { ...options, headers });
  } catch (networkError) {
    throw new Error('Error de conexión al servidor. Verifica tu internet.');
  }
  
  if (res.status === 401 && endpoint !== '/api/auth/login') { 
    handleLogout(); 
    throw new Error('Sesión expirada. Inicia sesión nuevamente.'); 
  }
  
  let data;
  try {
    data = await res.json();
  } catch (parseError) {
    throw new Error(`Error del servidor (código ${res.status})`);
  }
  
  if (!res.ok) throw new Error(data.error || `Error del servidor (código ${res.status})`);
  return data;
}

// ============================================ AUTH ============================================
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errorEl = document.getElementById('login-error');
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const branch_id = document.getElementById('login-branch').value;

  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Ingresando...';
  errorEl.style.display = 'none';

  try {
    const data = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, branch_id })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    showMainApp();
    toast('Bienvenido, ' + currentUser.name, 'success');
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Iniciar Sesión</span><i class="fas fa-arrow-right"></i>';
  }
}

function togglePassword() {
  const input = document.getElementById('login-password');
  const icon = document.querySelector('.toggle-password i');
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fas fa-eye';
  }
}

function handleLogout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  document.getElementById('login-screen').style.display = '';
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-form').reset();
}

function showMainApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-app').style.display = 'flex';
  updateUserInfo();
  fetchSettings().then(() => navigateTo('dashboard'));
}

async function fetchSettings() {
  try {
    settings = await api('/api/settings');
    const name = settings.store_name || 'Mi Tiendita';
    const currentBranchName = (typeof currentUser !== 'undefined' && currentUser && currentUser.branch_name) ? currentUser.branch_name : '';
    const fullStoreName = currentBranchName ? `${name} - ${currentBranchName}` : name;

    const sidebarTitle = document.getElementById('sidebar-store-name');
    if (sidebarTitle) sidebarTitle.textContent = fullStoreName;
    const loginTitle = document.getElementById('login-store-name');
    if (loginTitle) loginTitle.textContent = fullStoreName;

    if (settings.store_logo) {
      // Sidebar logo
      const sidebarLogoIcon = document.querySelector('.sidebar-logo i');
      if (sidebarLogoIcon) sidebarLogoIcon.style.display = 'none';
      const sidebarLogoLabel = document.querySelector('.sidebar-logo');
      if (sidebarLogoLabel && !sidebarLogoLabel.querySelector('img')) {
        sidebarLogoLabel.innerHTML = `<img src="${settings.store_logo}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;margin-right:12px;" id="sidebar-logo-img"> <span class="sidebar-title" id="sidebar-store-name">${fullStoreName}</span>`;
      }
      
      // Login logo
      const loginLogo = document.querySelector('.login-logo');
      if (loginLogo) {
        loginLogo.innerHTML = `<img src="${settings.store_logo}" style="width:100%;height:100%;border-radius:inherit;object-fit:cover;" alt="Logo">`;
      }
    }

    updateSidebarPermissions();

    // Aplicar tema
    document.documentElement.setAttribute('data-theme', settings.theme || 'midnight');

    // Iniciar auto-refresco de tasa si está configurado
    startExchangeRateAutoRefresh();
  } catch (err) {
    console.error('Error fetching settings:', err);
  }
}

function fmt(n) {
  const baseSymbol = settings.currency_symbol || '$';
  // Usamos un locale neutro para el formato de miles y decimales
  const formatter = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `${baseSymbol}${formatter.format(n)}`;
}

function fmtDeter(n, targetCurrency) {
  const base = settings.currency_base || 'USD';
  const secondary = settings.currency_secondary || 'USD';
  const rate = parseFloat(settings.exchange_rate) || 1;

  if (!targetCurrency || targetCurrency === base) return fmt(n);

  if (targetCurrency === secondary) {
    // Para la moneda secundaria, si no hay símbolo configurado, usamos el código (USD, EUR, etc)
    const formatter = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
    return `${secondary} ${formatter.format(n / rate)}`;
  }

  return fmt(n);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function updateUserInfo() {
  if (!currentUser) return;
  const avatar = document.getElementById('user-avatar');
  avatar.textContent = currentUser.name.charAt(0).toUpperCase();
  avatar.style.background = currentUser.avatar_color || '#6366f1';
  document.getElementById('user-name').textContent = currentUser.name;
  document.getElementById('user-role').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Vendedor';
}

function canEdit() {
  return currentUser && (currentUser.role === 'admin' || currentUser.can_edit == 1);
}

function canDelete() {
  return currentUser && (currentUser.role === 'admin' || currentUser.can_delete == 1);
}

function updateSidebarPermissions() {
  if (!currentUser) return;
  const isAdmin = currentUser.role === 'admin';
  document.querySelectorAll('.nav-item').forEach(item => {
    const section = item.getAttribute('data-section');
    const adminSections = ['products', 'categories', 'suppliers', 'expenses', 'users', 'settings', 'reports'];
    if (adminSections.includes(section) && !isAdmin) {
      item.style.display = 'none';
    } else {
      item.style.display = 'flex';
    }
  });
}

// ============================================ NAVIGATION ============================================
function navigateTo(section, event) {
  if (event) event.preventDefault();
  currentSection = section;

  // Limpiar estado activo de TODOS los botones antes de marcar el nuevo
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));

  const activeNav = document.querySelector(`[data-section="${section}"]`);
  if (activeNav) activeNav.classList.add('active');

  const searchBox = document.getElementById('global-search-box');
  const searchInput = document.getElementById('global-search');

  const sectionConfig = {
    'dashboard': { title: 'Dashboard', subtitle: 'Resumen general del sistema', search: false },
    'products': { title: 'Productos', subtitle: 'Gestión de inventario', search: true, adminOnly: true },
    'categories': { title: 'Categorías', subtitle: 'Organización de productos', search: false, adminOnly: true },
    'sales': { title: 'Ventas', subtitle: 'Historial de ventas', search: true },
    'new-sale': { title: 'Nueva Venta', subtitle: 'Punto de venta', search: false },
    'quotes': { title: 'Cotizaciones', subtitle: 'Presupuestos para clientes', search: true },
    'purchase-orders': { title: 'Órdenes de Compra', subtitle: 'Pedidos a proveedores', search: true, adminOnly: true },
    'users': { title: 'Usuarios', subtitle: 'Gestión de usuarios', search: false, adminOnly: true },
    'suppliers': { title: 'Proveedores', subtitle: 'Gestión de proveedores', search: false, adminOnly: true },
    'settings': { title: 'Configuración', subtitle: 'Ajustes del sistema', search: false, adminOnly: true },
    'expenses': { title: 'Gastos', subtitle: 'Gestión de egresos', search: false, adminOnly: true },
    'reports': { title: 'Reportes', subtitle: 'Análisis y estadísticas', search: false, adminOnly: true },
    'expiring': { title: 'Vencimientos', subtitle: 'Productos próximos a vencer', search: false }
  };

  const config = sectionConfig[section] || {};
  if (config.adminOnly && currentUser.role !== 'admin') {
    toast('Acceso restringido solo para administradores', 'error');
    navigateTo('dashboard');
    return;
  }
  document.getElementById('page-title').textContent = config.title || '';
  document.getElementById('page-subtitle').textContent = config.subtitle || '';
  searchBox.style.display = config.search ? 'flex' : 'none';
  if (searchInput) searchInput.value = '';

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');

  loadSection(section);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
}

async function loadSection(section) {
  const body = document.getElementById('content-body');
  body.innerHTML = '<div class="spinner"></div>';

  try {
    switch (section) {
      case 'dashboard': await loadDashboard(body); break;
      case 'products': await loadProducts(body); break;
      case 'categories': await loadCategories(body); break;
      case 'sales': await loadSales(body); break;
      case 'new-sale': await loadNewSale(body); break;
      case 'users': await loadUsers(body); break;
      case 'settings': await loadSettings(body); break;
      case 'reports': await loadReports(body); break;
      case 'suppliers': await loadSuppliers(body); break;
      case 'expenses': await loadExpenses(body); break;
      case 'quotes': await loadQuotes(body); break;
      case 'purchase-orders': await loadPurchaseOrders(body); break;
      case 'expiring': await loadExpiring(body); break;
    }
  } catch (err) {
    body.innerHTML = `<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><h3>Error</h3><p>${err.message}</p></div>`;
  }
}

// ============================================ DASHBOARD ============================================
async function loadDashboard(container) {
  const [stats, chart, topProducts, recentSales, lowStock] = await Promise.all([
    api('/api/dashboard/stats'),
    api('/api/dashboard/sales-chart'),
    api('/api/dashboard/top-products'),
    api('/api/dashboard/recent-sales'),
    api('/api/dashboard/low-stock')
  ]);

  const fmtSub = (n) => {
    if (!settings.currency_secondary || settings.currency_secondary === settings.currency_base) return '';
    return ` / ${fmtDeter(n, settings.currency_secondary)}`;
  };

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card purple">
        <div class="stat-header">
          <span class="stat-label">Productos</span>
          <div class="stat-icon"><i class="fas fa-box"></i></div>
        </div>
        <div class="stat-value">${stats.totalProducts}</div>
        <div class="stat-sub">${stats.totalCategories} categorías</div>
      </div>
      <div class="stat-card green">
        <div class="stat-header">
          <span class="stat-label">Ventas Hoy</span>
          <div class="stat-icon"><i class="fas fa-shopping-cart"></i></div>
        </div>
        <div class="stat-value">${fmt(stats.todaySalesTotal)}</div>
        <div class="stat-sub">${stats.todaySalesCount} ventas ${fmtSub(stats.todaySalesTotal)}</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-header">
          <span class="stat-label">Ventas del Mes</span>
          <div class="stat-icon"><i class="fas fa-chart-line"></i></div>
        </div>
        <div class="stat-value">${fmt(stats.monthSalesTotal)}</div>
        <div class="stat-sub">${stats.monthSalesCount} ventas ${fmtSub(stats.monthSalesTotal)}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-header">
          <span class="stat-label">Valor Inventario</span>
          <div class="stat-icon"><i class="fas fa-coins"></i></div>
        </div>
        <div class="stat-value">${fmt(stats.inventoryRetailValue)}</div>
        <div class="stat-sub">Costo: ${fmt(stats.inventoryCostValue)} ${fmtSub(stats.inventoryRetailValue)}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-header">
          <span class="stat-label">Stock Bajo</span>
          <div class="stat-icon"><i class="fas fa-exclamation-triangle"></i></div>
        </div>
        <div class="stat-value">${stats.lowStock}</div>
        <div class="stat-sub">Productos bajo mínimo</div>
      </div>
      <div class="stat-card pink">
        <div class="stat-header">
          <span class="stat-label">Ganancia Est.</span>
          <div class="stat-icon"><i class="fas fa-trophy"></i></div>
        </div>
        <div class="stat-value">${fmt(stats.inventoryRetailValue - stats.inventoryCostValue)}</div>
        <div class="stat-sub">Margen estimado ${fmtSub(stats.inventoryRetailValue - stats.inventoryCostValue)}</div>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="dashboard-card" style="grid-column: span 2;">
        <div class="dashboard-card-header">
          <h3><i class="fas fa-chart-bar" style="color: var(--primary-light); margin-right:8px;"></i>Ventas últimos 30 días</h3>
        </div>
        <div class="dashboard-card-body">
          <div class="chart-container" id="sales-chart"></div>
        </div>
      </div>
      <div class="dashboard-card">
        <div class="dashboard-card-header">
          <h3><i class="fas fa-fire" style="color: #f59e0b; margin-right:8px;"></i>Productos más vendidos</h3>
        </div>
        <div class="dashboard-card-body">
          ${topProducts.length ? topProducts.map((p, i) => `
            <div class="top-product-item">
              <div class="top-product-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">${i + 1}</div>
              <div class="top-product-info">
                <div class="top-product-name">${p.product_name}</div>
                <div class="top-product-sales">${p.total_sold} vendidos</div>
              </div>
              <div class="top-product-revenue">${fmt(p.total_revenue)}</div>
            </div>
          `).join('') : '<div class="empty-state"><p>Sin datos</p></div>'}
        </div>
      </div>
      <div class="dashboard-card">
        <div class="dashboard-card-header">
          <h3><i class="fas fa-exclamation-circle" style="color: var(--danger); margin-right:8px;"></i>Stock bajo</h3>
        </div>
        <div class="dashboard-card-body">
          ${lowStock.length ? lowStock.map(p => `
            <div class="low-stock-item">
              <div class="stock-indicator ${p.stock === 0 ? 'critical' : 'warning'}"></div>
              <div class="low-stock-info">
                <div class="low-stock-name">${p.name}</div>
                <div class="low-stock-detail">Mín: ${p.min_stock}</div>
              </div>
              <div class="low-stock-count" style="color: ${p.stock === 0 ? 'var(--danger)' : 'var(--warning)'}">${p.stock}</div>
            </div>
          `).join('') : '<div class="empty-state"><p>¡Todo en orden!</p></div>'}
        </div>
      </div>
      <div class="dashboard-card" style="grid-column: span 2;">
        <div class="dashboard-card-header">
          <h3><i class="fas fa-receipt" style="color: var(--success-light); margin-right:8px;"></i>Ventas recientes</h3>
        </div>
        <div class="dashboard-card-body">
          ${recentSales.length ? recentSales.map(s => `
            <div class="recent-sale-item">
              <div class="recent-sale-info">
                <span class="recent-sale-invoice">${s.invoice_number}</span>
                <span class="recent-sale-date">${formatDate(s.created_at)} • ${s.customer_name}</span>
              </div>
              <span class="recent-sale-method badge ${s.payment_method === 'efectivo' ? 'badge-success' : s.payment_method === 'tarjeta' ? 'badge-info' : 'badge-purple'}">${s.payment_method}</span>
              <span class="recent-sale-total">${fmt(s.total)}</span>
            </div>
          `).join('') : '<div class="empty-state"><p>Sin ventas recientes</p></div>'}
        </div>
      </div>
    </div>
  `;

  renderChart(chart);
}

function renderChart(data) {
  const container = document.getElementById('sales-chart');
  if (!container || !data.length) {
    if (container) container.innerHTML = '<div class="empty-state"><p>Sin datos de ventas</p></div>';
    return;
  }

  const maxTotal = Math.max(...data.map(d => d.total));

  container.innerHTML = `
    <div class="chart-bars">
      ${data.map(d => {
    const height = maxTotal > 0 ? Math.max(4, (d.total / maxTotal) * 100) : 4;
    const date = new Date(d.date);
    const label = `${date.getDate()}/${date.getMonth() + 1}`;
    const formattedValue = fmt(d.total);
    return `<div class="chart-bar" style="height:${height}%" data-tooltip="${label}: ${formattedValue} (${d.count} ventas)"></div>`;
  }).join('')}
    </div>
    <div class="chart-labels">
      <span>${formatDateShort(data[0].date)}</span>
      <span>${formatDateShort(data[Math.floor(data.length / 2)].date)}</span>
      <span>${formatDateShort(data[data.length - 1].date)}</span>
    </div>
  `;
}

// ============================================ PRODUCTS ============================================
let allProducts = [];
async function loadProducts(container, search = '') {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const data = await api(`/api/products${params}`);
  allProducts = data.products;

  container.innerHTML = `
    <div class="table-container">
      <div class="table-toolbar">
        <div class="table-toolbar-left">
          <span style="color:var(--text-muted);font-size:0.85rem;">${data.total} productos</span>
        </div>
        <button class="btn btn-primary" onclick="openProductModal()">
          <i class="fas fa-plus"></i> Nuevo Producto
        </button>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th>SKU</th>
              <th>Categoría</th>
              <th>Precio</th>
              <th>Costo</th>
              <th>Stock</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${allProducts.length ? allProducts.map(p => `
              <tr>
                <td>
                  <div class="td-product">
                    <div class="product-img-mini">
                      ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<i class="fas fa-image" style="opacity:0.3"></i>`}
                    </div>
                    <div>
                      <strong>${p.name}</strong><br>
                      <small style="color:var(--text-muted)">${p.supplier_name || 'Sin proveedor'}</small>
                    </div>
                  </div>
                </td>
                <td><code style="color:var(--text-muted);font-size:0.8rem;">${p.sku}</code></td>
                <td>${p.category_name || '-'}</td>
                <td style="font-weight:600;">${fmt(p.price)}</td>
                <td style="color:var(--text-muted);">${fmt(p.cost)}</td>
                <td>
                  <span class="badge ${p.stock <= 0 ? 'badge-danger' : p.stock <= p.min_stock ? 'badge-warning' : 'badge-success'}">
                    ${p.stock} ${p.unit}
                  </span>
                </td>
                <td>
                  <span class="badge ${p.status === 'active' ? 'badge-success' : 'badge-danger'}">
                    ${p.status === 'active' ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td class="text-right">
                  <div class="action-buttons">
                    ${canEdit() ? `<button class="action-btn edit" onclick="openProductModal(${p.id})"><i class="fas fa-pen"></i></button>` : ''}
                    ${canDelete() ? `<button class="action-btn delete" onclick="deleteProduct(${p.id}, '${p.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('') : `
              <tr><td colspan="8">
                <div class="empty-state"><i class="fas fa-box-open"></i><h3>Sin productos</h3><p>Crea tu primer producto</p></div>
              </td></tr>
            `}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function openProductModal(id = null) {
  const [categories, suppliers] = await Promise.all([api('/api/categories'), api('/api/suppliers')]);
  let product = { name: '', description: '', sku: '', barcode: '', category_id: '', supplier_id: '', price: '', cost: '', stock: 0, min_stock: 5, unit: 'unidad', status: 'active', image_url: '' };
  if (id) product = await api(`/api/products/${id}`);

  document.getElementById('modal-title').textContent = id ? 'Editar Producto' : 'Nuevo Producto';
  document.getElementById('modal-body').innerHTML = `
    <form id="product-form" onsubmit="saveProduct(event, ${id || 'null'})">
      <div class="form-row">
        <div class="form-group">
          <label>Nombre</label>
          <input type="text" id="pf-name" value="${product.name}" required>
        </div>
        <div class="form-group">
          <label>Código de Barras / QR</label>
          <div style="display:flex;gap:8px;">
            <input type="text" id="pf-barcode" value="${product.barcode || ''}" placeholder="Escanear o ingresar...">
            <button type="button" class="btn btn-ghost" onclick="startScanner('pf-barcode')" style="padding:0 12px;"><i class="fas fa-barcode"></i></button>
          </div>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>SKU</label>
          <input type="text" id="pf-sku" value="${product.sku}" required>
        </div>
        <div class="form-group">
          <label>Categoría</label>
          <select id="pf-category" class="filter-select" style="width:100%;padding:12px 16px;">
            <option value="">Sin categoría</option>
            ${categories.map(c => `<option value="${c.id}" ${product.category_id == c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>Proveedor</label>
          <select id="pf-supplier" class="filter-select" style="width:100%;padding:12px 16px;">
            <option value="">Sin proveedor</option>
            ${suppliers.map(s => `<option value="${s.id}" ${product.supplier_id == s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div id="reader-container" style="display:none;margin-bottom:20px;border:2px solid var(--primary);border-radius:var(--radius-md);overflow:hidden;">
        <div id="reader" style="width:100%"></div>
        <button type="button" class="btn btn-danger" onclick="stopScanner()" style="width:100%;border-radius:0;">Detener Escáner</button>
      </div>

      <div class="form-row" style="align-items: flex-start;">
        <div class="form-group" style="flex: 1;">
          <label>Imagen del Producto</label>
          <div class="img-upload-container">
            <div id="img-preview" class="img-preview">
               ${product.image_url ? `<img src="${product.image_url}">` : '<i class="fas fa-camera"></i>'}
            </div>
            <div style="flex:1;">
               <input type="file" id="pf-file" accept="image/*" style="display:none;" onchange="previewImage(this)">
               <input type="hidden" id="pf-image_url" value="${product.image_url || ''}">
               <button type="button" class="btn btn-ghost" onclick="document.getElementById('pf-file').click()"><i class="fas fa-upload"></i> Subir Foto</button>
               <p style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">JPG, PNG o WEBP. Máx 2MB.</p>
            </div>
          </div>
        </div>
        <div class="form-group" style="flex: 2;">
          <label>Descripción</label>
          <textarea id="pf-desc" rows="4" style="resize:vertical">${product.description || ''}</textarea>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Precio de Venta</label>
          <input type="number" step="0.01" id="pf-price" value="${product.price}" required>
        </div>
        <div class="form-group">
          <label>Costo</label>
          <input type="number" step="0.01" id="pf-cost" value="${product.cost}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Stock</label>
          <input type="number" id="pf-stock" value="${product.stock}">
        </div>
        <div class="form-group">
          <label>Stock Mínimo</label>
          <input type="number" id="pf-minstock" value="${product.min_stock}">
        </div>
        <div class="form-group">
          <label>Fecha de Vencimiento (Caducidad)</label>
          <input type="date" id="pf-expiration" value="${product.expiration_date ? product.expiration_date.split('T')[0] : ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Unidad</label>
          <input type="text" id="pf-unit" value="${product.unit || 'unidad'}">
        </div>
        ${id ? `<div class="form-group">
          <label>Estado</label>
          <select id="pf-status" class="filter-select" style="width:100%;padding:12px 16px;">
            <option value="active" ${product.status === 'active' ? 'selected' : ''}>Activo</option>
            <option value="inactive" ${product.status === 'inactive' ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>` : ''}
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> ${id ? 'Actualizar' : 'Crear'}</button>
      </div>
    </form>
  `;
  openModal();
}

async function saveProduct(e, id) {
  e.preventDefault();

  const fileInput = document.getElementById('pf-file');
  let imageUrl = document.getElementById('pf-image_url').value;

  if (fileInput.files.length > 0) {
    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      imageUrl = data.url;
    } catch (err) { console.error('Upload error:', err); }
  }

  const data = {
    name: document.getElementById('pf-name').value,
    sku: document.getElementById('pf-sku').value,
    barcode: document.getElementById('pf-barcode').value,
    category_id: document.getElementById('pf-category').value || null,
    supplier_id: document.getElementById('pf-supplier').value || null,
    description: document.getElementById('pf-desc').value,
    price: parseFloat(document.getElementById('pf-price').value),
    cost: parseFloat(document.getElementById('pf-cost').value) || 0,
    stock: parseInt(document.getElementById('pf-stock').value) || 0,
    min_stock: parseInt(document.getElementById('pf-minstock').value) || 5,
    unit: document.getElementById('pf-unit').value || 'unit',
    image_url: imageUrl,
    expiration_date: document.getElementById('pf-expiration').value || null
  };

  const statusEl = document.getElementById('pf-status');
  if (statusEl) data.status = statusEl.value;

  try {
    if (id) {
      await api(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      toast('Producto actualizado', 'success');
    } else {
      await api('/api/products', { method: 'POST', body: JSON.stringify(data) });
      toast('Producto creado', 'success');
    }
    closeModal();
    navigateTo('products');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteProduct(id, name) {
  if (!confirm(`¿Eliminar "${name}"?`)) return;
  try {
    await api(`/api/products/${id}`, { method: 'DELETE' });
    toast('Producto eliminado', 'success');
    navigateTo('products');
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================ CATEGORIES ============================================
async function loadCategories(container) {
  const categories = await api('/api/categories');

  const iconMap = {
    cpu: 'fa-microchip', shirt: 'fa-shirt', apple: 'fa-apple-whole', home: 'fa-house',
    dumbbell: 'fa-dumbbell', briefcase: 'fa-briefcase', package: 'fa-box',
    car: 'fa-car', motorcycle: 'fa-motorcycle', utencils: 'fa-utensils', medication: 'fa-pills', hammer: 'fa-hammer',
    gamepad: 'fa-gamepad', book: 'fa-book', mobile: 'fa-mobile-screen',
    gift: 'fa-gift', glasses: 'fa-glasses', shoes: 'fa-shoe-prints'
  };

  container.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px;">
      ${canEdit() ? `<button class="btn btn-primary" onclick="openCategoryModal()"><i class="fas fa-plus"></i> Nueva Categoría</button>` : ''}
    </div>
    <div class="categories-grid">
      ${categories.map(c => `
        <div class="category-card">
          <div class="category-card-header">
            <div class="category-icon-wrap" style="background:${c.color}20;color:${c.color}">
              <i class="fas ${iconMap[c.icon] || 'fa-box'}"></i>
            </div>
            <div class="action-buttons">
              ${canEdit() ? `<button class="action-btn edit" onclick="openCategoryModal(${c.id})"><i class="fas fa-pen"></i></button>` : ''}
              ${canDelete() ? `<button class="action-btn delete" onclick="deleteCategory(${c.id}, '${c.name}')"><i class="fas fa-trash"></i></button>` : ''}
            </div>
          </div>
          <h3>${c.name}</h3>
          <p>${c.description || 'Sin descripción'}</p>
          <div class="category-product-count"><i class="fas fa-box" style="margin-right:6px;"></i>${c.product_count || 0} productos</div>
        </div>
      `).join('')}
    </div>
  `;
}

async function openCategoryModal(id = null) {
  let cat = { name: '', description: '', color: '#6366f1', icon: 'package' };
  if (id) {
    const cats = await api('/api/categories');
    cat = cats.find(c => c.id === id) || cat;
  }

  document.getElementById('modal-title').textContent = id ? 'Editar Categoría' : 'Nueva Categoría';
  document.getElementById('modal-body').innerHTML = `
    <form onsubmit="saveCategory(event, ${id || 'null'})">
      <div class="form-group">
        <label>Nombre</label>
        <input type="text" id="cf-name" value="${cat.name}" required>
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <textarea id="cf-desc" rows="2">${cat.description || ''}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Color</label>
          <input type="color" id="cf-color" value="${cat.color}" style="width:100%;height:42px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-input);cursor:pointer;">
        </div>
        <div class="form-group">
          <label>Icono</label>
          <select id="cf-icon" class="filter-select" style="width:100%;padding:12px 16px;">
            <option value="package" ${cat.icon === 'package' ? 'selected' : ''}>📦 Paquete (General)</option>
            <option value="cpu" ${cat.icon === 'cpu' ? 'selected' : ''}>💻 Electrónica</option>
            <option value="shirt" ${cat.icon === 'shirt' ? 'selected' : ''}>👕 Ropa y Moda</option>
            <option value="apple" ${cat.icon === 'apple' ? 'selected' : ''}>🍎 Alimentos y Bebidas</option>
            <option value="home" ${cat.icon === 'home' ? 'selected' : ''}>🏠 Hogar</option>
            <option value="dumbbell" ${cat.icon === 'dumbbell' ? 'selected' : ''}>💪 Deportes</option>
            <option value="briefcase" ${cat.icon === 'briefcase' ? 'selected' : ''}>💼 Oficina / Negocios</option>
            <option value="car" ${cat.icon === 'car' ? 'selected' : ''}>🚗 Automotriz</option>
            <option value="motorcycle" ${cat.icon === 'motorcycle' ? 'selected' : ''}>🏍️ Motos / Repuestos</option>
            <option value="utencils" ${cat.icon === 'utencils' ? 'selected' : ''}>🍴 Restaurante / Cocina</option>
            <option value="medication" ${cat.icon === 'medication' ? 'selected' : ''}>💊 Salud / Farmacia</option>
            <option value="hammer" ${cat.icon === 'hammer' ? 'selected' : ''}>🔨 Herramientas / Ferretería</option>
            <option value="gamepad" ${cat.icon === 'gamepad' ? 'selected' : ''}>🎮 Juguetes / Videojuegos</option>
            <option value="book" ${cat.icon === 'book' ? 'selected' : ''}>📚 Librería / Educación</option>
            <option value="mobile" ${cat.icon === 'mobile' ? 'selected' : ''}>📱 Telefonía</option>
            <option value="gift" ${cat.icon === 'gift' ? 'selected' : ''}>🎁 Regalos / Detalles</option>
            <option value="glasses" ${cat.icon === 'glasses' ? 'selected' : ''}>👓 Óptica / Accesorios</option>
            <option value="shoes" ${cat.icon === 'shoes' ? 'selected' : ''}>👟 Calzado</option>
          </select>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> ${id ? 'Actualizar' : 'Crear'}</button>
      </div>
    </form>
  `;
  openModal();
}

async function saveCategory(e, id) {
  e.preventDefault();
  const data = {
    name: document.getElementById('cf-name').value,
    description: document.getElementById('cf-desc').value,
    color: document.getElementById('cf-color').value,
    icon: document.getElementById('cf-icon').value
  };
  try {
    if (id) {
      await api(`/api/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      toast('Categoría actualizada', 'success');
    } else {
      await api('/api/categories', { method: 'POST', body: JSON.stringify(data) });
      toast('Categoría creada', 'success');
    }
    closeModal();
    navigateTo('categories');
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteCategory(id, name) {
  if (!confirm(`¿Desactivar categoría "${name}"?`)) return;
  try {
    await api(`/api/categories/${id}`, { method: 'DELETE' });
    toast('Categoría desactivada', 'success');
    navigateTo('categories');
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================ SALES ============================================
async function loadSales(container, search = '') {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const sales = await api(`/api/sales${params}`);

  container.innerHTML = `
    <div class="table-container">
      <div class="table-toolbar">
        <span style="color:var(--text-muted);font-size:0.85rem;">${sales.length} ventas</span>
        <button class="btn btn-primary" onclick="navigateTo('new-sale')"><i class="fas fa-plus"></i> Nueva Venta</button>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Cliente</th>
              <th>Vendedor</th>
              <th>Método</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Ver</th>
            </tr>
          </thead>
          <tbody>
            ${sales.length ? sales.map(s => `
              <tr>
                <td><strong>${s.invoice_number}</strong></td>
                <td>${s.customer_name}</td>
                <td>${s.user_name || '-'}</td>
                <td><span class="badge ${s.payment_method === 'efectivo' ? 'badge-success' : s.payment_method === 'tarjeta' ? 'badge-info' : 'badge-purple'}">${s.payment_method}</span></td>
                <td style="font-weight:700;">${fmt(s.total)}</td>
                <td><span class="badge ${s.status === 'completada' ? 'badge-success' : s.status === 'pendiente' ? 'badge-warning' : 'badge-danger'}">${s.status}</span></td>
                <td style="color:var(--text-muted);font-size:0.85rem;">${formatDate(s.created_at)}</td>
                <td>
                  <button class="action-btn edit" onclick="viewSaleDetail(${s.id})"><i class="fas fa-eye"></i></button>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="8"><div class="empty-state"><i class="fas fa-receipt"></i><h3>Sin ventas</h3></div></td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function viewSaleDetail(id) {
  const sale = await api(`/api/sales/${id}`);

  document.getElementById('modal-title').textContent = `Venta ${sale.invoice_number}`;
  document.getElementById('modal-body').innerHTML = `
    <div style="margin-bottom:20px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:var(--text-muted)">Cliente:</span><strong>${sale.customer_name}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:var(--text-muted)">Método:</span><span class="badge ${sale.payment_method === 'efectivo' ? 'badge-success' : 'badge-info'}">${sale.payment_method}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
        <span style="color:var(--text-muted)">Fecha:</span><span>${formatDate(sale.created_at)}</span>
      </div>
    </div>
    <table style="width:100%;">
      <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
      <tbody>
        ${(sale.items || []).map(i => `
          <tr>
            <td>${i.product_name}</td>
            <td>${i.quantity}</td>
            <td>${fmt(i.unit_price)}</td>
            <td style="font-weight:600;">${fmt(i.subtotal)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <div style="text-align:right;margin-top:16px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
      <button class="btn btn-ghost" onclick='printTicket(${JSON.stringify(sale)})'><i class="fas fa-print"></i> Re-imprimir Ticket</button>
      <span style="font-size:1.3rem;font-weight:800;color:var(--primary-light);">${fmt(sale.total)}</span>
    </div>
  `;
  openModal();
}

// ============================================ NEW SALE (POS) ============================================
let posProducts = [];

async function loadNewSale(container) {
  const data = await api('/api/products?limit=200');
  posProducts = data.products.filter(p => p.status === 'active');
  cart = [];
  renderPOS(container);
}

function renderPOS(container) {
  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

  container.innerHTML = `
    <div class="pos-layout">
      <div class="pos-products">
        <div class="pos-products-header">
          <div class="sidebar-logo">
            ${settings.store_logo ? `<img src="${settings.store_logo}" style="width:40px;height:40px;border-radius:8px;object-fit:cover;margin-right:12px;">` : `<i class="fas fa-boxes-stacked"></i>`}
            <span id="pos-store-name">${settings.store_name || 'Inventario Pro'}</span>
          </div>
          <div class="pos-search">
            <i class="fas fa-search"></i>
            <input type="text" id="pos-search-input" placeholder="Buscar producto o escanear..." oninput="filterPOSProducts(this.value)">
            <button class="btn btn-ghost" onclick="startScanner('pos-search-input')" style="margin-left:8px;padding:0 12px;border:none;"><i class="fas fa-barcode"></i></button>
          </div>
        </div>
        <div id="reader-container" style="display:none;margin-bottom:20px;border:2px solid var(--primary);border-radius:var(--radius-md);overflow:hidden;">
          <div id="reader" style="width:100%"></div>
          <button type="button" class="btn btn-danger" onclick="stopScanner()" style="width:100%;border-radius:0;">Detener Escáner</button>
        </div>
        <div class="pos-product-grid" id="pos-grid">
          ${posProducts.map(p => `
            <div class="pos-product-card ${p.stock <= 0 ? 'out-of-stock' : ''}" onclick="addToCart(${p.id})">
              <div class="pos-product-card-img">
                ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<i class="fas fa-image"></i>`}
              </div>
              <div class="pos-product-card-body">
                <div class="pos-product-name">${p.name}</div>
                <div class="pos-product-price">${fmt(p.price)}</div>
                <div class="pos-product-stock">${p.stock} dispon.</div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="pos-cart">
        <div class="pos-cart-header">
          <h3><i class="fas fa-shopping-cart" style="margin-right:8px;color:var(--primary-light);"></i>Carrito</h3>
          <div class="cart-count">${cart.length}</div>
        </div>
        ${cart.length ? `
          <div class="pos-cart-items">
            ${cart.map((item, idx) => `
              <div class="cart-item">
                <div class="cart-item-info">
                  <div class="cart-item-name">${item.name}</div>
                  <div class="cart-item-price">${fmt(item.unit_price)} c/u</div>
                </div>
                <div class="cart-item-qty">
                  <button class="qty-btn" onclick="updateCartQty(${idx}, -1)"><i class="fas fa-minus"></i></button>
                  <span>${item.quantity}</span>
                  <button class="qty-btn" onclick="updateCartQty(${idx}, 1)"><i class="fas fa-plus"></i></button>
                </div>
                <div class="cart-item-subtotal">${fmt(item.quantity * item.unit_price)}</div>
                <button class="cart-item-remove" onclick="removeFromCart(${idx})"><i class="fas fa-times"></i></button>
              </div>
            `).join('')}
          </div>
          <div class="pos-cart-summary">
            <div class="cart-summary-row"><span>Subtotal (sin imp.)</span><span>${fmt(cartTotal / (1 + (parseFloat(settings.tax_rate || 0) / 100)))}</span></div>
            <div class="cart-summary-row" style="font-size:0.8rem;color:var(--text-muted);"><span>Impuesto (${settings.tax_rate || 0}%)</span><span>${fmt(cartTotal - (cartTotal / (1 + (parseFloat(settings.tax_rate || 0) / 100))))}</span></div>
            <div class="cart-summary-row total"><span>Total a Pagar</span><span>${fmt(cartTotal)}</span></div>
          </div>
          <div class="pos-cart-actions">
            <div class="form-group">
              <label>Cliente</label>
              <input type="text" id="pos-customer" placeholder="Cliente General" value="">
            </div>
            <div class="form-group">
              <label>Método de pago</label>
              <select id="pos-method" class="filter-select" style="width:100%;padding:12px 16px;" onchange="toggleCashFields(this.value)">
                <option value="efectivo">Efectivo</option>
                <option value="tarjeta">Tarjeta</option>
                <option value="transferencia">Transferencia</option>
                <option value="credito">Pendiente (Fiar)</option>
                ${settings.currency_base === 'VES' ? '<option value="pagomovil">Pago Móvil</option>' : ''}
                ${settings.currency_base === 'COP' ? '<option value="nequi">Nequi</option>' : ''}
              </select>
            </div>
            <div id="pos-cash-fields" style="display:block;margin-bottom:12px;padding:12px;background:rgba(255,255,255,0.03);border-radius:var(--radius-sm);border:1px solid var(--border);">
              <div class="form-group" style="margin-bottom:8px;">
                <label style="font-size:0.75rem;color:var(--text-muted);">Monto Recibido</label>
                <input type="number" id="pos-amount-received" placeholder="0.00" oninput="calculateChange()" style="font-size:1.1rem;font-weight:700;">
              </div>
              <div class="cart-summary-row" style="font-size:1.1rem;color:var(--success-light);font-weight:800;margin-top:8px;">
                <span>Cambio</span><span id="pos-change-amount">${fmt(0)}</span>
              </div>
            </div>
            <button class="btn btn-success btn-checkout" onclick="processSale()">
              <i class="fas fa-check-circle"></i> Completar Venta - ${fmt(cartTotal)}
            </button>
          </div>
        ` : `
          <div class="pos-cart-empty">
            <i class="fas fa-cart-plus"></i>
            <p>Selecciona productos para agregarlos al carrito</p>
          </div>
        `}
      </div>
    </div>
  `;
}

function filterPOSProducts(query) {
  const grid = document.getElementById('pos-grid');
  const lower = query.toLowerCase();
  const filtered = posProducts.filter(p =>
    p.name.toLowerCase().includes(lower) || p.sku.toLowerCase().includes(lower)
  );

  grid.innerHTML = filtered.map(p => `
    <div class="pos-product-card ${p.stock <= 0 ? 'out-of-stock' : ''}" onclick="addToCart(${p.id})">
      <div class="pos-product-card-img">
        ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<i class="fas fa-image"></i>`}
      </div>
      <div class="pos-product-card-body">
        <div class="pos-product-name">${p.name}</div>
        <div class="pos-product-price">${fmt(p.price)}</div>
        <div class="pos-product-stock">${p.stock} dispon.</div>
      </div>
    </div>
  `).join('');
}

function addToCart(productId) {
  const product = posProducts.find(p => p.id === productId);
  if (!product || product.stock <= 0) return;

  const existing = cart.find(i => i.product_id === productId);
  if (existing) {
    if (existing.quantity >= product.stock) {
      toast('Stock insuficiente', 'warning');
      return;
    }
    existing.quantity++;
  } else {
    cart.push({ product_id: productId, name: product.name, unit_price: product.price, quantity: 1, max_stock: product.stock });
  }
  renderPOS(document.getElementById('content-body'));
}

function updateCartQty(index, delta) {
  cart[index].quantity += delta;
  if (cart[index].quantity <= 0) {
    cart.splice(index, 1);
  } else if (cart[index].quantity > cart[index].max_stock) {
    cart[index].quantity = cart[index].max_stock;
    toast('Stock máximo alcanzado', 'warning');
  }
  renderPOS(document.getElementById('content-body'));
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderPOS(document.getElementById('content-body'));
}

function toggleCashFields(method) {
  const fields = document.getElementById('pos-cash-fields');
  fields.style.display = method === 'efectivo' ? 'block' : 'none';
  if (method !== 'efectivo') {
    document.getElementById('pos-amount-received').value = '';
    document.getElementById('pos-change-amount').textContent = fmt(0);
  }
}

function calculateChange() {
  const cartTotal = cart.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const received = parseFloat(document.getElementById('pos-amount-received').value) || 0;
  const change = received - cartTotal;
  const changeEl = document.getElementById('pos-change-amount');

  if (change < 0) {
    changeEl.textContent = fmt(0);
    changeEl.style.color = 'var(--danger-light)';
  } else {
    changeEl.textContent = fmt(change);
    changeEl.style.color = 'var(--success-light)';
  }
}

async function processSale() {
  if (!cart.length) return;

  const btn = document.querySelector('.btn-checkout');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';

  const total = cart.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const method = document.getElementById('pos-method').value;
  let received = total;

  if (method === 'efectivo') {
    received = parseFloat(document.getElementById('pos-amount-received').value) || total;
    if (received < total) {
      toast('El monto recibido debe ser mayor o igual al total', 'warning');
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-check-circle"></i> Completar Venta - ' + fmt(total);
      return;
    }
  }

  const taxRate = parseFloat(settings.tax_rate || 0);
  const taxAmount = total - (total / (1 + (taxRate / 100)));
  const subtotal = total - taxAmount;

  const saleData = {
    customer_name: document.getElementById('pos-customer').value || 'Cliente General',
    payment_method: method,
    amount_paid: received,
    branch_name: settings.branch_name || 'Principal',
    status: method === 'credito' ? 'pendiente' : 'completada',
    tax_rate: taxRate,
    tax_amount: taxAmount,
    subtotal: subtotal,
    items: cart.map(i => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price
    }))
  };

  try {
    const sale = await api('/api/sales', { method: 'POST', body: JSON.stringify(saleData) });

    // Si es efectivo y hubo cambio, mostrar mensaje especial
    if (method === 'efectivo' && sale.change_amount > 0) {
      alert(`Venta Completada.\nTotal: ${fmt(total)}\nRecibido: ${fmt(received)}\nCAMBIO: ${fmt(sale.change_amount)}`);
    }

    if (confirm('¿Desea imprimir el ticket?')) {
      printTicket(sale);
    }

    cart = [];
    toast(`Venta ${sale.invoice_number} completada`, 'success');
    navigateTo('new-sale');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check-circle"></i> Completar Venta';
  }
}

// ============================================ USERS ============================================
async function loadUsers(container) {
  if (currentUser.role !== 'admin') {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i><h3>Acceso restringido</h3><p>Solo administradores</p></div>';
    return;
  }

  const users = await api('/api/users');
  container.innerHTML = `
    <div class="table-container">
      <div class="table-toolbar">
        <span style="color:var(--text-muted);font-size:0.85rem;">${users.length} usuarios</span>
        <button class="btn btn-primary" onclick="openUserModal()"><i class="fas fa-plus"></i> Nuevo Usuario</button>
      </div>
      <table>
        <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Sucursal</th><th>Permisos</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td>
                <div class="td-product">
                  <div class="user-avatar" style="background:${u.avatar_color};width:32px;height:32px;font-size:0.75rem;">${u.name.charAt(0)}</div>
                  <strong>${u.name}</strong>
                </div>
              </td>
              <td style="color:var(--text-muted);">${u.email}</td>
              <td><span class="badge ${u.role === 'admin' ? 'badge-purple' : 'badge-info'}">${u.role}</span></td>
              <td style="color:var(--text-muted);font-size:0.85rem;">${u.branch_name || 'Global'}</td>
              <td>
                <div style="display:flex;gap:4px;">
                   ${u.can_edit ? '<span class="badge badge-success" title="Puede Crear/Editar">E</span>' : ''}
                   ${u.can_delete ? '<span class="badge badge-danger" title="Puede Borrar">D</span>' : ''}
                </div>
              </td>
              <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Activo' : 'Inactivo'}</span></td>
              <td>
                <button class="action-btn edit" onclick='openUserModal(${JSON.stringify(u)})'><i class="fas fa-pen"></i></button>
                ${u.id !== currentUser.id ? `
                  <button class="action-btn delete" onclick="deleteUser(${u.id}, '${u.name}')"><i class="fas fa-trash"></i></button>
                ` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function openUserModal(user = null) {
  const branches = await api('/api/branches');
  const isEdit = !!user;
  document.getElementById('modal-title').textContent = isEdit ? `Editar Usuario: ${user.name}` : 'Nuevo Usuario';
  document.getElementById('modal-body').innerHTML = `
    <form onsubmit="saveUser(event, ${user ? user.id : 'null'})">
      <div class="form-group">
        <label>Nombre</label>
        <input type="text" id="uf-name" value="${user ? user.name : ''}" required>
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="uf-email" value="${user ? user.email : ''}" required>
      </div>
      <div class="form-group">
        <label>Contraseña ${isEdit ? '(dejar vacío para no cambiar)' : ''}</label>
        <input type="password" id="uf-password" ${isEdit ? '' : 'required'} minlength="6">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Rol</label>
          <select id="uf-role" class="filter-select" style="width:100%;padding:12px 16px;">
            <option value="vendedor" ${user && user.role === 'vendedor' ? 'selected' : ''}>Vendedor</option>
            <option value="admin" ${user && user.role === 'admin' ? 'selected' : ''}>Administrador</option>
          </select>
        </div>
        <div class="form-group">
          <label>Estado</label>
          <select id="uf-active" class="filter-select" style="width:100%;padding:12px 16px;">
            <option value="1" ${!user || user.is_active ? 'selected' : ''}>Activo</option>
            <option value="0" ${user && !user.is_active ? 'selected' : ''}>Inactivo</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1;">
          <label>Sucursal Asignada</label>
          <select id="uf-branch" class="filter-select" style="width:100%;padding:12px 16px;">
            ${branches.map(b => `<option value="${b.id}" ${user && user.branch_id === b.id ? 'selected' : ''}>${b.name}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group" id="seller-permissions" style="display: ${user && user.role === 'admin' ? 'none' : 'block'}">
        <h4 style="margin-bottom:12px;font-size:0.85rem;color:var(--primary-light)">Permisos Especiales</h4>
        <div style="display:flex;gap:24px;">
           <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
             <input type="checkbox" id="uf-can_edit" ${user && user.can_edit ? 'checked' : ''} style="width:auto;"> Crear/Editar
           </label>
           <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
             <input type="checkbox" id="uf-can_delete" ${user && user.can_delete ? 'checked' : ''} style="width:auto;"> Borrar Datos
           </label>
        </div>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> ${isEdit ? 'Actualizar' : 'Crear'}</button>
      </div>
    </form>
  `;

  // Ocultar/Mostrar permisos según el rol seleccionado
  document.getElementById('uf-role').onchange = function () {
    document.getElementById('seller-permissions').style.display = this.value === 'admin' ? 'none' : 'block';
  };

  openModal();
}

async function saveUser(e, id) {
  e.preventDefault();
  const data = {
    name: document.getElementById('uf-name').value,
    email: document.getElementById('uf-email').value,
    role: document.getElementById('uf-role').value,
    is_active: parseInt(document.getElementById('uf-active').value),
    branch_id: document.getElementById('uf-branch').value,
    can_edit: document.getElementById('uf-can_edit').checked,
    can_delete: document.getElementById('uf-can_delete').checked
  };

  const pass = document.getElementById('uf-password').value;
  if (pass) data.password = pass;

  try {
    if (id) {
      await api(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      toast('Usuario actualizado', 'success');
    } else {
      await api('/api/users', { method: 'POST', body: JSON.stringify(data) });
      toast('Usuario creado', 'success');
    }
    closeModal();
    navigateTo('users');
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteUser(id, name) {
  if (!confirm(`¿Desactivar usuario "${name}"?`)) return;
  try {
    await api(`/api/users/${id}`, { method: 'DELETE' });
    toast('Usuario desactivado', 'success');
    navigateTo('users');
  } catch (err) { toast(err.message, 'error'); }
}

function printTicket(sale) {
  const printArea = document.getElementById('ticket-print-area');
  const storeName = settings.store_name || 'Mi Tienda';

  printArea.innerHTML = `
    <div class="ticket">
      <div class="ticket-header">
        <h2>${storeName}</h2>
        <p>Sistema de Inventario</p>
        <p>Fecha: ${formatDate(sale.created_at)}</p>
      </div>
      <div class="ticket-info">
        <p><strong>Factura:</strong> ${sale.invoice_number}</p>
        <p><strong>Cliente:</strong> ${sale.customer_name}</p>
        <p><strong>Vendedor:</strong> ${sale.user_name || currentUser.name}</p>
        <p><strong>Método:</strong> ${sale.payment_method}</p>
      </div>
      <table class="ticket-table">
        <thead>
          <tr>
            <th>Cant.</th>
            <th>Producto</th>
            <th style="text-align:right">Sub</th>
          </tr>
        </thead>
        <tbody>
          ${sale.items.map(i => `
            <tr>
              <td>${i.quantity}</td>
              <td>${i.product_name}</td>
              <td style="text-align:right">${fmt(i.subtotal)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="ticket-footer">
        ${sale.amount_paid ? `<div class="ticket-footer-row"><span>Pagado:</span><span>${fmt(sale.amount_paid)}</span></div>` : ''}
        ${sale.change_amount ? `<div class="ticket-footer-row"><span>Cambio:</span><span>${fmt(sale.change_amount)}</span></div>` : ''}
        <div class="ticket-footer-row total">
          <span>TOTAL:</span>
          <span>${fmt(sale.total)}</span>
        </div>
      </div>
      <div class="ticket-thanks">
        <p>¡Gracias por su compra!</p>
        <p>Vuelva pronto</p>
      </div>
    </div>
  `;

  window.print();
}

function printQuote(q) {
  const printArea = document.getElementById('ticket-print-area');
  const storeName = settings.store_name || 'Mi Tienda';

  printArea.innerHTML = `
    <div class="ticket">
      <div class="ticket-header">
        <h2 style="margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">COTIZACIÓN</h2>
        <h3>${storeName}</h3>
        <p>Fecha: ${formatDate(q.created_at)}</p>
        <p>Vence: ${q.expiration_date ? q.expiration_date.split('T')[0] : '-'}</p>
      </div>
      <div class="ticket-info">
        <p><strong>Nro:</strong> ${q.quote_number}</p>
        <p><strong>Cliente:</strong> ${q.customer_name}</p>
      </div>
      <table class="ticket-table">
        <thead>
          <tr>
            <th>Cant.</th>
            <th>Producto</th>
            <th style="text-align:right">Sub</th>
          </tr>
        </thead>
        <tbody>
          ${q.items.map(i => `
            <tr>
              <td>${i.quantity}</td>
              <td>${i.product_name}</td>
              <td style="text-align:right">${fmt(i.quantity * i.unit_price)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="ticket-footer">
        <div class="ticket-footer-row total">
          <span>TOTAL:</span>
          <span>${fmt(q.total)}</span>
        </div>
      </div>
      <div class="ticket-thanks">
        <p>Este documento es una cotización informativa y no representa una factura fiscal.</p>
      </div>
    </div>
  `;
  window.print();
}

function printPurchaseOrder(o) {
  const printArea = document.getElementById('ticket-print-area');
  const storeName = settings.store_name || 'Mi Tienda';

  printArea.innerHTML = `
    <div class="ticket">
      <div class="ticket-header">
        <h2 style="margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">ORDEN DE COMPRA</h2>
        <h3>${storeName}</h3>
        <p>Fecha: ${formatDate(o.created_at)}</p>
      </div>
      <div class="ticket-info">
        <p><strong>Orden Nro:</strong> ${o.order_number}</p>
        <p><strong>Proveedor:</strong> ${o.supplier_name}</p>
      </div>
      <table class="ticket-table">
        <thead>
          <tr>
            <th>Cant.</th>
            <th>Producto</th>
            <th style="text-align:right">Sub</th>
          </tr>
        </thead>
        <tbody>
          ${o.items.map(i => `
            <tr>
              <td>${i.quantity}</td>
              <td>${i.product_name}</td>
              <td style="text-align:right">${fmt(i.quantity * i.unit_cost)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="ticket-footer">
        <div class="ticket-footer-row total">
          <span>TOTAL:</span>
          <span>${fmt(o.total)}</span>
        </div>
      </div>
      <div class="ticket-thanks">
        <p>Documento interno de compra.</p>
      </div>
    </div>
  `;
  window.print();
}

async function handleLogoUpload(input) {
  if (!input.files || !input.files[0]) return;
  const formData = new FormData();
  formData.append('image', input.files[0]);
  try {
    toast('Subiendo logo...', 'info');
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
      body: formData
    });
    const data = await res.json();
    if (data.url) {
      document.getElementById('set-store_logo').value = window.location.origin + data.url;
      toast('Logo cargado. Guarda los cambios para aplicar.', 'success');
    }
  } catch (err) { toast('Error al subir logo', 'error'); }
}

async function backupDB() {
  toast('Preparando backup SQL...', 'info');
  try {
    const response = await fetch('/api/settings/backup/sql', {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
    });
    if (!response.ok) throw new Error('Error al descargar');
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_${settings.store_name || 'tienda'}_${new Date().toISOString().slice(0, 10)}.sql`;
    a.click();
    toast('Backup descargado correctamente', 'success');
  } catch (err) { toast('Error al generar backup', 'error'); }
}

async function showCashClosing() {
  const sales = await api('/api/sales');
  const today = new Date().toISOString().slice(0, 10);
  const todaySales = sales.filter(s => s.created_at.startsWith(today));

  const byMethod = todaySales.reduce((acc, s) => {
    acc[s.payment_method] = (acc[s.payment_method] || 0) + parseFloat(s.total);
    return acc;
  }, {});

  const total = todaySales.reduce((sum, s) => sum + parseFloat(s.total), 0);

  document.getElementById('modal-title').textContent = 'Cierre de Caja - ' + today;
  document.getElementById('modal-body').innerHTML = `
    <div style="padding:10px;">
      <p style="margin-bottom:20px;color:var(--text-muted);">Resumen de ventas del día de hoy.</p>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${Object.entries(byMethod).map(([m, val]) => `
          <div style="display:flex;justify-content:space-between;padding:12px;background:var(--bg-card);border-radius:var(--radius-sm);border:1px solid var(--border);">
            <strong style="text-transform:capitalize;">${m}:</strong>
            <span style="font-weight:700;color:var(--primary-light);">${fmt(val)}</span>
          </div>
        `).join('')}
        <div style="display:flex;justify-content:space-between;padding:16px;background:var(--primary);border-radius:var(--radius-sm);margin-top:10px;">
          <strong style="color:white;">TOTAL DÍA:</strong>
          <span style="font-weight:800;font-size:1.2rem;color:white;">${fmt(total)}</span>
        </div>
      </div>
      <div style="margin-top:24px;text-align:center;">
        <button class="btn btn-primary" onclick="window.print()"><i class="fas fa-print"></i> Imprimir Reporte Z</button>
      </div>
    </div>
  `;
  openModal();
}

// ============================================ EXPENSES ============================================
async function loadExpenses(container) {
  const expenses = await api('/api/expenses');
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  container.innerHTML = `
    <div class="table-container">
      <div class="table-toolbar">
         <div>
            <span style="color:var(--text-muted);font-size:0.85rem;">${expenses.length} gastos registrados</span>
            <div style="font-weight:700;color:var(--danger-light);margin-top:4px;">Total Gastos: ${fmt(total)}</div>
         </div>
         ${canEdit() ? `<button class="btn btn-danger" onclick="openExpenseModal()"><i class="fas fa-plus"></i> Registrar Gasto</button>` : ''}
      </div>
      <table style="width:100%;">
        <thead>
          <tr>
            <th>Categoría</th>
            <th>Descripción</th>
            <th>Monto</th>
            <th>Vendedor</th>
            <th>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.length ? expenses.map(e => `
            <tr>
              <td><span class="badge badge-purple">${e.category}</span></td>
              <td style="font-size:0.85rem;color:var(--text-muted);">${e.description || '-'}</td>
              <td style="font-weight:700;color:var(--danger-light);">${fmt(e.amount)}</td>
              <td>${e.user_name || '-'}</td>
              <td style="color:var(--text-muted);font-size:0.85rem;">${formatDate(e.created_at)}</td>
              <td>
                ${canDelete() ? `<button class="action-btn delete" onclick="deleteExpense(${e.id})"><i class="fas fa-trash"></i></button>` : ''}
              </td>
            </tr>
          `).join('') : `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-wallet"></i><h3>Sin gastos</h3></div></td></tr>`}
        </tbody>
      </table>
    </div>
  `;
}

function openExpenseModal() {
  document.getElementById('modal-title').textContent = 'Registrar Gasto';
  document.getElementById('modal-body').innerHTML = `
    <form onsubmit="saveExpense(event)">
      <div class="form-group">
        <label>Categoría del Gasto</label>
        <select id="ef-category" class="filter-select" style="width:100%;padding:12px 16px;">
          <option value="Servicios (Luz/Agua/Internet)">Servicios (Luz/Agua/Internet)</option>
          <option value="Alquiler">Alquiler</option>
          <option value="Salarios">Salarios</option>
          <option value="Compras a Proveedores">Compras a Proveedores</option>
          <option value="Publicidad">Publicidad</option>
          <option value="Mantenimiento">Mantenimiento</option>
          <option value="Otros">Otros</option>
        </select>
      </div>
      <div class="form-group">
        <label>Monto</label>
        <input type="number" step="0.01" id="ef-amount" placeholder="0.00" required>
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <textarea id="ef-description" rows="3" placeholder="Detalle del gasto..."></textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> Guardar Gasto</button>
      </div>
    </form>
  `;
  openModal();
}

async function saveExpense(e) {
  e.preventDefault();
  const data = {
    category: document.getElementById('ef-category').value,
    amount: parseFloat(document.getElementById('ef-amount').value),
    description: document.getElementById('ef-description').value
  };

  try {
    await api('/api/expenses', { method: 'POST', body: JSON.stringify(data) });
    toast('Gasto registrado', 'success');
    closeModal();
    navigateTo('expenses');
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteExpense(id) {
  if (!confirm('¿Eliminar este registro de gasto?')) return;
  try {
    await api(`/api/expenses/${id}`, { method: 'DELETE' });
    toast('Gasto eliminado', 'success');
    navigateTo('expenses');
  } catch (err) { toast(err.message, 'error'); }
}

// ============================================ UTILITIES ============================================
function handleSearch(value) {
  switch (currentSection) {
    case 'products': loadProducts(document.getElementById('content-body'), value); break;
    case 'sales': loadSales(document.getElementById('content-body'), value); break;
    case 'quotes': loadQuotes(document.getElementById('content-body'), value); break;
    case 'purchase-orders': loadPurchaseOrders(document.getElementById('content-body'), value); break;
    case 'suppliers': loadSuppliers(document.getElementById('content-body')); break;
    case 'expenses': loadExpenses(document.getElementById('content-body')); break;
  }
}

function openModal() {
  document.getElementById('modal-overlay').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').style.display = 'none';
  document.body.style.overflow = '';
}

function toast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-circle', info: 'fa-info-circle' };

  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `
    <i class="fas ${icons[type]} toast-icon"></i>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>
  `;
  container.appendChild(t);
  setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 300); }, 4000);
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
}

// ============================================ SETTINGS ============================================
async function loadSettings(container) {
  if (currentUser.role !== 'admin') {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-lock"></i><h3>Acceso Denegado</h3><p>Solo los administradores pueden ver esta sección.</p></div>';
    return;
  }

  await fetchSettings();

  container.innerHTML = `
    <div class="settings-container" style="max-width: 800px; margin: 0 auto; padding: 20px;">
      <!-- SECCION: Empresa -->
      <div class="dashboard-card">
        <div class="dashboard-card-header">
          <h3><i class="fas fa-store"></i> Empresa</h3>
        </div>
        <div class="dashboard-card-body">
          <form id="settings-form" onsubmit="saveSettings(event)">
            <div class="form-row">
              <div class="form-group" style="flex:2;">
                <label>Nombre de la Empresa</label>
                <input type="text" id="set-store_name" value="${settings.store_name || ''}">
              </div>
              <div class="form-group" style="flex:1;">
                <label>Tema de Interfaz</label>
                <select id="set-theme" class="filter-select" style="width:100%;padding:10px 16px;">
                  <option value="midnight" ${settings.theme === 'midnight' ? 'selected' : ''}>Medianoche</option>
                  <option value="aura" ${settings.theme === 'aura' ? 'selected' : ''}>Aura (Púrpura)</option>
                  <option value="forest" ${settings.theme === 'forest' ? 'selected' : ''}>Bosque</option>
                  <option value="ocean" ${settings.theme === 'ocean' ? 'selected' : ''}>Océano</option>
                  <option value="light" ${settings.theme === 'light' ? 'selected' : ''}>Polar (Claro)</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Logo de la Tienda</label>
              <div style="display:flex;gap:10px;">
                <input type="text" id="set-store_logo" value="${settings.store_logo || ''}" placeholder="URL del logo o sube un archivo" style="flex:1;">
                <label class="btn btn-ghost" style="padding:10px;cursor:pointer;">
                  <i class="fas fa-upload"></i>
                  <input type="file" style="display:none;" onchange="handleLogoUpload(this)">
                </label>
              </div>
            </div>

            <div style="margin:24px 0 12px;padding-top:16px;border-top:1px solid var(--border);">
              <h4 style="font-size:.85rem;color:var(--primary-light);margin-bottom:16px;"><i class="fas fa-coins" style="margin-right:6px;"></i>Moneda y Precios</h4>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:2;">
                <label>Moneda Base</label>
                <select id="set-currency_base" class="filter-select" style="width:100%;padding:10px 16px;">
                  <optgroup label="Global">
                    <option value="USD" ${settings.currency_base === 'USD' ? 'selected' : ''}>Dólar (USD)</option>
                    <option value="EUR" ${settings.currency_base === 'EUR' ? 'selected' : ''}>Euro (EUR)</option>
                  </optgroup>
                  <optgroup label="Latinoamérica">
                    <option value="ARS" ${settings.currency_base === 'ARS' ? 'selected' : ''}>Peso Argentino</option>
                    <option value="BOB" ${settings.currency_base === 'BOB' ? 'selected' : ''}>Boliviano</option>
                    <option value="BRL" ${settings.currency_base === 'BRL' ? 'selected' : ''}>Real Brasileño</option>
                    <option value="CLP" ${settings.currency_base === 'CLP' ? 'selected' : ''}>Peso Chileno</option>
                    <option value="COP" ${settings.currency_base === 'COP' ? 'selected' : ''}>Peso Colombiano</option>
                    <option value="CRC" ${settings.currency_base === 'CRC' ? 'selected' : ''}>Colón Costarricense</option>
                    <option value="CUP" ${settings.currency_base === 'CUP' ? 'selected' : ''}>Peso Cubano</option>
                    <option value="DOP" ${settings.currency_base === 'DOP' ? 'selected' : ''}>Peso Dominicano</option>
                    <option value="GTQ" ${settings.currency_base === 'GTQ' ? 'selected' : ''}>Quetzal</option>
                    <option value="HNL" ${settings.currency_base === 'HNL' ? 'selected' : ''}>Lempira</option>
                    <option value="MXN" ${settings.currency_base === 'MXN' ? 'selected' : ''}>Peso Mexicano</option>
                    <option value="NIO" ${settings.currency_base === 'NIO' ? 'selected' : ''}>Córdoba</option>
                    <option value="PAB" ${settings.currency_base === 'PAB' ? 'selected' : ''}>Balboa</option>
                    <option value="PYG" ${settings.currency_base === 'PYG' ? 'selected' : ''}>Guaraní</option>
                    <option value="PEN" ${settings.currency_base === 'PEN' ? 'selected' : ''}>Sol Peruano</option>
                    <option value="UYU" ${settings.currency_base === 'UYU' ? 'selected' : ''}>Peso Uruguayo</option>
                    <option value="VES" ${settings.currency_base === 'VES' ? 'selected' : ''}>Bolívar Venezolano</option>
                  </optgroup>
                </select>
              </div>
              <div class="form-group" style="flex:1;">
                <label>Símbolo</label>
                <input type="text" id="set-currency_symbol" value="${settings.currency_symbol || '$'}">
              </div>
              <div class="form-group" style="flex:1;">
                <label>Impuesto (%)</label>
                <input type="number" step="0.01" id="set-tax_rate" value="${settings.tax_rate || '18.00'}">
              </div>
            </div>

            <div style="margin:24px 0 12px;padding-top:16px;border-top:1px solid var(--border);">
              <h4 style="font-size:.85rem;color:var(--primary-light);margin-bottom:16px;"><i class="fas fa-exchange-alt" style="margin-right:6px;"></i>Tasa de Cambio</h4>
            </div>
            <div class="form-row">
              <div class="form-group" style="flex:1;">
                <label>Moneda de Referencia</label>
                <select id="set-currency_secondary" class="filter-select" style="width:100%;padding:10px 16px;">
                  <option value="USD" ${settings.currency_secondary === 'USD' ? 'selected' : ''}>Dólar (USD)</option>
                  <option value="EUR" ${settings.currency_secondary === 'EUR' ? 'selected' : ''}>Euro (EUR)</option>
                </select>
              </div>
              <div class="form-group" style="flex:1;">
                <label>Tasa de Cambio</label>
                <div style="display:flex;gap:8px;">
                  <input type="text" id="set-exchange_rate" value="${settings.exchange_rate || '1.0000'}">
                  <button type="button" class="btn btn-ghost" onclick="updateAutoExchangeRate()" style="padding:0 12px;" title="Actualizar desde API"><i class="fas fa-sync-alt"></i></button>
                </div>
              </div>
              <div class="form-group" style="flex:1;">
                <label>Auto-actualizar (min)</label>
                <input type="number" id="set-exchange_refresh_interval" value="${settings.exchange_refresh_interval || '0'}" placeholder="0 = off">
                <small style="color:var(--text-muted);font-size:.65rem;">0 = desactivado</small>
              </div>
            </div>

            <div style="margin:24px 0 12px;padding-top:16px;border-top:1px solid var(--border);">
              <h4 style="font-size:.85rem;color:var(--primary-light);margin-bottom:16px;"><i class="fas fa-sliders-h" style="margin-right:6px;"></i>Opciones</h4>
            </div>
            <div class="form-group">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:12px;background:rgba(255,255,255,.03);border-radius:var(--radius-sm);border:1px solid var(--border);">
                <input type="checkbox" id="set-allow_negative_stock" ${settings.allow_negative_stock === 'true' ? 'checked' : ''} style="width:auto;">
                <div>
                  <span style="font-weight:600;">Permitir facturación sin stock</span>
                  <div style="font-size:.75rem;color:var(--text-muted);margin-top:2px;">El inventario podrá quedar en números negativos</div>
                </div>
              </label>
            </div>
            <div class="modal-actions" style="margin-top:24px;">
              <button type="submit" class="btn btn-primary" id="save-settings-btn"><i class="fas fa-save"></i> Guardar Cambios</button>
            </div>
          </form>
        </div>
      </div>
      
      <div class="dashboard-card" style="margin-top:20px;">
        <div class="dashboard-card-header">
          <h3><i class="fas fa-building"></i> Gestión de Sucursales</h3>
        </div>
        <div class="dashboard-card-body">
           <div id="settings-branches-list" style="margin-bottom:15px;">Cargando...</div>
           <div style="display:flex;gap:10px;">
              <input type="text" id="new-branch-name" placeholder="Nombre de nueva sucursal" class="filter-select" style="padding:8px 12px;flex:1;">
              <button class="btn btn-primary btn-sm" onclick="saveNewBranch()"><i class="fas fa-plus"></i> Agregar</button>
           </div>
        </div>
      </div>
    </div>
  `;
  setTimeout(() => loadSettingsBranches(), 200);
}

// Branch Management logic inside Settings
async function loadSettingsBranches() {
  const container = document.getElementById('settings-branches-list');
  try {
    const branches = await api('/api/branches');
    container.innerHTML = `
      <table style="width:100%; border-collapse:collapse; margin-top:10px;">
        <tbody>
          ${branches.map(b => `
            <tr style="border-bottom:1px solid var(--border);">
              <td style="padding:10px 0;"><strong>${b.name}</strong></td>
              <td style="text-align:right;">
                 <button class="action-btn edit" onclick="editBranch(${b.id}, '${b.name.replace(/'/g, "\\'")}')"><i class="fas fa-pen"></i></button>
                 <button class="action-btn delete" onclick="deleteBranch(${b.id})"><i class="fas fa-trash"></i></button>
              </td>
            </tr>
          `).join('') || '<p>No hay sucursales. Esto causará errores en el sistema.</p>'}
        </tbody>
      </table>
    `;
  } catch(e) {
    container.innerHTML = '<p style="color:var(--danger);">Error cargando sucursales.</p>';
  }
}

async function saveNewBranch() {
  const name = document.getElementById('new-branch-name').value;
  if (!name) return toast('Agrega un nombre', 'warning');
  try {
     await api('/api/branches', { method: 'POST', body: JSON.stringify({ name }) });
     toast('Sucursal creada', 'success');
     document.getElementById('new-branch-name').value = '';
     loadSettingsBranches();
  } catch(e) { toast(e.message, 'error'); }
}

async function editBranch(id, oldName) {
  const newName = prompt('Nuevo nombre de la sucursal:', oldName);
  if (!newName || newName === oldName) return;
  try {
     await api(`/api/branches/${id}`, { method: 'PUT', body: JSON.stringify({ name: newName }) });
     toast('Sucursal actualizada', 'success');
     loadSettingsBranches();
  } catch(e) { toast(e.message, 'error'); }
}

async function deleteBranch(id) {
  if (!confirm('¿Eliminar esta sucursal?')) return;
  try {
     await api(`/api/branches/${id}`, { method: 'DELETE' });
     toast('Sucursal eliminada', 'success');
     loadSettingsBranches();
  } catch(e) { toast(e.message, 'error'); }
}

async function saveSettings(e) {
  e.preventDefault();
  const btn = document.getElementById('save-settings-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

  const data = {
    store_logo: document.getElementById('set-store_logo').value,
    theme: document.getElementById('set-theme').value,
    currency_base: document.getElementById('set-currency_base').value,
    currency_symbol: document.getElementById('set-currency_symbol').value,
    currency_secondary: document.getElementById('set-currency_secondary').value,
    exchange_rate: document.getElementById('set-exchange_rate').value.replace(',', '.'),
    tax_rate: document.getElementById('set-tax_rate').value,
    exchange_refresh_interval: document.getElementById('set-exchange_refresh_interval').value,
    allow_negative_stock: document.getElementById('set-allow_negative_stock').checked.toString()
  };

  try {
    await api('/api/settings', { method: 'POST', body: JSON.stringify(data) });
    await fetchSettings();
    toast('Configuración guardada correctamente', 'success');
    // Forzar recarga de la sección
    setTimeout(() => navigateTo('settings'), 500);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Guardar Cambios';
  }
}

// ============================================ REPORTS ============================================
async function loadReports(container) {
  const stats = await api('/api/dashboard/stats');
  const recentSales = await api('/api/dashboard/recent-sales');

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card purple">
        <div class="stat-header"><span class="stat-label">Ingresos del Mes (Ventas)</span></div>
        <div class="stat-value">${fmt(stats.monthSalesTotal)}</div>
      </div>
      <div class="stat-card orange">
        <div class="stat-header"><span class="stat-label">Gastos del Mes (Costos/Servicios)</span></div>
        <div class="stat-value" style="color:var(--danger-light);">${fmt(stats.monthExpensesTotal)}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-header"><span class="stat-label">Ganancia Neta Est.</span></div>
        <div class="stat-value">${fmt(stats.monthSalesTotal - stats.monthExpensesTotal)}</div>
        <div class="stat-sub">Ingresos menos Gastos</div>
      </div>
    </div>
    
    <div class="dashboard-card" style="margin-top:20px;">
       <div class="dashboard-card-header">
         <h3><i class="fas fa-file-pdf"></i> Generar Reportes</h3>
       </div>
       <div class="dashboard-card-body" style="display:flex;gap:20px;flex-wrap:wrap;">
          <button class="btn btn-ghost" onclick="showCashClosing()"><i class="fas fa-file-invoice-dollar"></i> Cierre de Caja del Día</button>
          <button class="btn btn-ghost" onclick="printProductsReport()"><i class="fas fa-file-download"></i> Inventario de Productos (PDF)</button>
          <button class="btn btn-ghost" onclick="backupDB()"><i class="fas fa-database"></i> Descargar Backup de Base de Datos</button>
          <button class="btn btn-ghost" onclick="printSalesReport()"><i class="fas fa-chart-line"></i> Reporte de Ventas Mensual</button>
       </div>
    </div>
  `;
}

async function printProductsReport() {
    toast('Generando reporte PDF...', 'info');
    try {
        const payload = await api('/api/products?limit=1000');
        const printArea = document.getElementById('ticket-print-area');
        printArea.innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Inventario de Productos</h2>
                <p>Generado el: ${formatDate(new Date().toISOString())}</p>
                <table style="width:100%; border-collapse: collapse; margin-top:20px;">
                   <thead>
                      <tr style="border-bottom: 2px solid #ccc; text-align: left;">
                         <th>SKU</th>
                         <th>Nombre</th>
                         <th>Precio</th>
                         <th>Stock</th>
                      </tr>
                   </thead>
                   <tbody>
                      ${payload.products.map(p => `
                         <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 5px 0;">${p.sku}</td>
                            <td>${p.name}</td>
                            <td>${fmt(p.price)}</td>
                            <td>${p.stock}</td>
                         </tr>
                      `).join('')}
                   </tbody>
                </table>
            </div>
        `;
        window.print();
    } catch(e) { toast('Error generando reporte', 'error'); }
}

async function printSalesReport() {
    toast('Generando reporte PDF...', 'info');
    try {
        const chartData = await api('/api/dashboard/sales-chart');
        const printArea = document.getElementById('pdf-print-area');
        if (!printArea) {
            const div = document.createElement('div');
            div.id = 'pdf-print-area';
            document.body.appendChild(div);
        }
        document.getElementById('pdf-print-area').innerHTML = `
            <div style="font-family: Arial, sans-serif; padding: 20px;">
                <h2>Reporte de Ventas Mensual</h2>
                <p>Generado el: ${formatDate(new Date().toISOString())}</p>
                <table style="width:100%; border-collapse: collapse; margin-top:20px;">
                   <thead>
                      <tr style="border-bottom: 2px solid #ccc; text-align: left;">
                         <th>Fecha</th>
                         <th>Ventas Realizadas</th>
                         <th>Total Generado</th>
                      </tr>
                   </thead>
                   <tbody>
                      ${chartData.map(d => `
                         <tr style="border-bottom: 1px solid #eee;">
                            <td style="padding: 5px 0;">${formatDateShort(d.date)}</td>
                            <td>${d.count}</td>
                            <td>${fmt(d.total)}</td>
                         </tr>
                      `).join('')}
                   </tbody>
                </table>
            </div>
        `;
        window.print();
    } catch(e) { toast('Error generando reporte', 'error'); }
}

// ============================================ SUPPLIERS ============================================
async function loadSuppliers(container) {
  const suppliers = await api('/api/suppliers');
  container.innerHTML = `
    <div class="table-container">
      <div class="table-toolbar">
        <span style="color:var(--text-muted);font-size:0.85rem;">${suppliers.length} proveedores</span>
        ${canEdit() ? `<button class="btn btn-primary" onclick="openSupplierModal()"><i class="fas fa-plus"></i> Nuevo Proveedor</button>` : ''}
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Proveedor</th>
              <th>Contacto</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>RNC / Tax ID</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${suppliers.map(s => `
              <tr>
                <td><strong>${s.name}</strong></td>
                <td>${s.contact_person || '-'}</td>
                <td>${s.email || '-'}</td>
                <td>${s.phone || '-'}</td>
                <td>${s.tax_id || '-'}</td>
                <td>
                  <div class="action-buttons">
                    ${canEdit() ? `<button class="action-btn edit" onclick="openSupplierModal(${s.id})"><i class="fas fa-pen"></i></button>` : ''}
                    ${canDelete() ? `<button class="action-btn delete" onclick="deleteSupplier(${s.id}, '${s.name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function openSupplierModal(id = null) {
  let sup = { name: '', contact_person: '', email: '', phone: '', address: '', tax_id: '' };
  if (id) {
    const sups = await api('/api/suppliers');
    sup = sups.find(s => s.id === id) || sup;
  }

  document.getElementById('modal-title').textContent = id ? 'Editar Proveedor' : 'Nuevo Proveedor';
  document.getElementById('modal-body').innerHTML = `
    <form onsubmit="saveSupplier(event, ${id || 'null'})">
      <div class="form-group">
        <label>Nombre del Proveedor</label>
        <input type="text" id="sf-name" value="${sup.name}" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Persona de Contacto</label>
          <input type="text" id="sf-contact" value="${sup.contact_person || ''}">
        </div>
        <div class="form-group">
          <label>RNC / Tax ID</label>
          <input type="text" id="sf-taxid" value="${sup.tax_id || ''}">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Email</label>
          <input type="email" id="sf-email" value="${sup.email || ''}">
        </div>
        <div class="form-group">
          <label>Teléfono</label>
          <input type="text" id="sf-phone" value="${sup.phone || ''}">
        </div>
      </div>
      <div class="form-group">
        <label>Dirección</label>
        <textarea id="sf-address" rows="2">${sup.address || ''}</textarea>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary"><i class="fas fa-save"></i> ${id ? 'Actualizar' : 'Crear'}</button>
      </div>
    </form>
  `;
  openModal();
}

async function saveSupplier(e, id) {
  e.preventDefault();
  const data = {
    name: document.getElementById('sf-name').value,
    contact_person: document.getElementById('sf-contact').value,
    tax_id: document.getElementById('sf-taxid').value,
    email: document.getElementById('sf-email').value,
    phone: document.getElementById('sf-phone').value,
    address: document.getElementById('sf-address').value
  };
  try {
    if (id) {
      await api(`/api/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) });
      toast('Proveedor actualizado', 'success');
    } else {
      await api('/api/suppliers', { method: 'POST', body: JSON.stringify(data) });
      toast('Proveedor creado', 'success');
    }
    closeModal();
    navigateTo('suppliers');
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteSupplier(id, name) {
  if (!confirm(`¿Desactivar proveedor "${name}"?`)) return;
  try {
    await api(`/api/suppliers/${id}`, { method: 'DELETE' });
    toast('Proveedor desactivado', 'success');
    navigateTo('suppliers');
  } catch (err) { toast(err.message, 'error'); }
}

async function updateAutoExchangeRate() {
  const baseEl = document.getElementById('set-currency_base');
  const refEl = document.getElementById('set-currency_secondary');
  const rateInput = document.getElementById('set-exchange_rate');

  const base = baseEl ? baseEl.value : settings.currency_base;
  const ref = refEl ? refEl.value : settings.currency_secondary;

  if (base === ref) {
    if (rateInput) rateInput.value = '1.0000';
    return;
  }

  try {
    if (rateInput) toast('Consultando tasa oficial...', 'info');
    const data = await api(`/api/settings/fetch-exchange-rate?base=${base}&reference=${ref}`);
    if (rateInput) {
      rateInput.value = data.rate;
      toast(`Tasa actualizada: 1 ${ref} = ${data.rate} ${base}`, 'success');
    }
    return data.rate;
  } catch (err) {
    if (rateInput) toast('No se pudo actualizar automáticamente', 'error');
  }
}

function startExchangeRateAutoRefresh() {
  if (exchangeRefreshTimer) clearInterval(exchangeRefreshTimer);

  const interval = parseInt(settings.exchange_refresh_interval) || 0;
  if (interval <= 0) return;

  console.log(`Auto-refresco de tasa activado: cada ${interval} minutos`);
  exchangeRefreshTimer = setInterval(async () => {
    try {
      const newRate = await updateAutoExchangeRate();
      if (newRate && newRate !== settings.exchange_rate) {
        // Actualizar en BD
        settings.exchange_rate = newRate;
        await api('/api/settings', { method: 'POST', body: JSON.stringify(settings) });
        console.log('Tasa de cambio actualizada automáticamente:', newRate);
      }
    } catch (e) { console.error('Error en auto-refresco de tasa:', e); }
  }, interval * 60 * 1000);
}

// ============================================ SCANNER ============================================
function startScanner(targetInputId) {
  const container = document.getElementById('reader-container') || createReaderContainer();
  container.style.display = 'block';

  if (html5QrCode) {
    html5QrCode.stop().then(() => startScan(targetInputId));
  } else {
    startScan(targetInputId);
  }
}

function startScan(targetInputId) {
  html5QrCode = new Html5Qrcode("reader");
  const config = { fps: 10, qrbox: { width: 250, height: 150 } };

  html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
    const input = document.getElementById(targetInputId);
    if (input) {
      input.value = decodedText;
      toast('Código detectado: ' + decodedText, 'success');

      // If it's POS search, trigger search
      if (targetInputId === 'pos-search-input') {
        filterPOSProducts(decodedText);
      }
    }
    stopScanner();
  }, (errorMessage) => {
    // Silently ignore failures to find qr code
  }).catch((err) => {
    toast('Error al iniciar cámara: ' + err, 'error');
    stopScanner();
  });
}

function stopScanner() {
  if (html5QrCode) {
    html5QrCode.stop().then(() => {
      const container = document.getElementById('reader-container');
      if (container) container.style.display = 'none';
      html5QrCode = null;
    }).catch(err => {
      const container = document.getElementById('reader-container');
      if (container) container.style.display = 'none';
      html5QrCode = null;
    });
  } else {
    const container = document.getElementById('reader-container');
    if (container) container.style.display = 'none';
  }
}

function createReaderContainer() {
  // If not exists in current section, we might need a general way to show it
  // But usually it's in the modals or static sections
  return document.getElementById('reader-container');
}

// ============================================ QUOTES (COTIZACIONES) ============================================
async function loadQuotes(container, search = '') {
  const params = search ? `?search=${encodeURIComponent(search)}` : '';
  const quotes = await api(`/api/quotes${params}`);

  container.innerHTML = `
    <div class="table-container">
      <div class="table-toolbar">
        <span style="color:var(--text-muted);font-size:0.85rem;">${quotes.length} cotizaciones</span>
        <button class="btn btn-primary" onclick="openQuoteModal()"><i class="fas fa-plus"></i> Nueva Cotización</button>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Número</th>
              <th>Cliente</th>
              <th>Vencimiento</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${quotes.length ? quotes.map(q => `
              <tr>
                <td><strong>${q.quote_number}</strong></td>
                <td>${q.customer_name}</td>
                <td>${q.expiration_date ? q.expiration_date.split('T')[0] : '-'}</td>
                <td style="font-weight:600;">${fmt(q.total)}</td>
                <td><span class="badge badge-${q.status === 'aceptada' ? 'success' : q.status === 'vencida' ? 'danger' : 'warning'}">${q.status}</span></td>
                <td>
                  <div class="action-buttons">
                    <button class="action-btn view" onclick="viewQuote(${q.id})"><i class="fas fa-eye"></i></button>
                    ${q.status === 'pendiente' ? `<button class="action-btn success" title="Convertir a Venta" onclick="convertQuoteToSale(${q.id})"><i class="fas fa-shopping-cart"></i></button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('') : '<tr><td colspan="6" class="text-center">No hay cotizaciones</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function openQuoteModal() {
  const products = await api('/api/products?limit=200');
  allProducts = products.products;
  cart = []; // Reuse cart for quote creation

  document.getElementById('modal-title').textContent = 'Nueva Cotización';
  document.getElementById('modal-body').innerHTML = `
    <div class="pos-container" style="height: auto; max-height: 80vh;">
      <div class="pos-main" style="flex: 1;">
        <div class="form-group">
          <label>Nombre del Cliente</label>
          <input type="text" id="qf-customer" placeholder="Cliente General" style="margin-bottom: 10px;">
        </div>
        <div class="form-group">
          <label>Válido hasta</label>
          <input type="date" id="qf-expiration" style="margin-bottom: 10px;">
        </div>
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" id="quote-prod-search" placeholder="Buscar productos..." oninput="filterQuoteProducts(this.value)">
        </div>
        <div id="quote-prod-list" class="pos-products-grid" style="grid-template-columns: repeat(3, 1fr); margin-top: 10px; height: 300px; overflow-y: auto;">
          ${products.products.map(p => `
            <div class="pos-product-card" onclick="addToQuote(${p.id})">
              <div class="product-img-mini" style="width:100%; height:60px;">${p.image_url ? `<img src="${p.image_url}">` : '<i class="fas fa-box"></i>'}</div>
              <p style="font-size:0.8rem; margin:5px 0;">${p.name}</p>
              <p style="font-weight:bold;">${fmt(p.price)}</p>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="pos-sidebar" style="width: 300px; margin-left: 20px;">
        <h3>Items</h3>
        <div id="quote-cart" style="height: 350px; overflow-y: auto; border: 1px solid var(--border); padding: 5px; margin-bottom: 10px;">
          <p class="text-center" style="color:var(--text-muted); padding-top:20px;">Selecciona productos</p>
        </div>
        <div class="pos-summary">
          <div class="summary-row"><span>Subtotal:</span><span id="quote-subtotal">${fmt(0)}</span></div>
          <div class="summary-row" style="font-weight:bold; font-size:1.2rem;"><span>Total:</span><span id="quote-total">${fmt(0)}</span></div>
        </div>
        <button class="btn btn-primary" onclick="saveQuote()" style="width:100%; margin-top:10px;"><i class="fas fa-save"></i> Generar Cotización</button>
      </div>
    </div>
  `;
  openModal();
}

function addToQuote(id) {
  const prod = allProducts.find(p => p.id === id);
  if (!prod) return;
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ id: prod.id, name: prod.name, price: prod.price, quantity: 1 });
  }
  updateQuoteCart();
}

function updateQuoteCart() {
  const list = document.getElementById('quote-cart');
  let subtotal = 0;
  list.innerHTML = cart.map(item => {
    subtotal += parseFloat(item.price || 0) * parseInt(item.quantity || 1, 10);
    return `
            <div style="display:flex; justify-content:space-between; margin-bottom:10px; padding-bottom:5px; border-bottom:1px solid var(--border);">
                <div>
                   <div style="font-size:0.85rem; font-weight:bold;">${item.name}</div>
                   <div style="font-size:0.75rem;">${fmt(item.price)} x ${item.quantity}</div>
                </div>
                <div style="display:flex; gap:5px; align-items:center;">
                   <button class="btn-sm" onclick="changeQuoteQty(${item.id}, -1)">-</button>
                   <button class="btn-sm" onclick="changeQuoteQty(${item.id}, 1)">+</button>
                </div>
            </div>
        `;
  }).join('') || '<p class="text-center" style="padding:20px;">Vacio</p>';
  const subTotalEl = document.getElementById('quote-subtotal');
  if (subTotalEl) subTotalEl.textContent = fmt(subtotal);
  document.getElementById('quote-total').textContent = fmt(subtotal);
}

function changeQuoteQty(id, delta) {
  const i = cart.find(x => x.id === id);
  if (i) {
    i.quantity += delta;
    if (i.quantity <= 0) cart = cart.filter(x => x.id !== id);
    updateQuoteCart();
  }
}

async function saveQuote() {
  if (cart.length === 0) return toast('Agrega productos', 'error');
  const data = {
    customer_name: document.getElementById('qf-customer').value,
    expiration_date: document.getElementById('qf-expiration').value,
    items: cart.map(i => ({ product_id: i.id, product_name: i.name, quantity: i.quantity, unit_price: i.price }))
  };
  try {
    await api('/api/quotes', { method: 'POST', body: JSON.stringify(data) });
    toast('Cotización generada', 'success');
    closeModal();
    navigateTo('quotes');
  } catch (e) { toast(e.message, 'error'); }
}

async function convertQuoteToSale(id) {
  const quote = await api(`/api/quotes/${id}`);
  if (!confirm(`¿Convertir cotización ${quote.quote_number} a venta?`)) return;
  try {
    const data = {
      customer_name: quote.customer_name,
      items: quote.items.map(i => ({ product_id: i.product_id, quantity: i.quantity, unit_price: i.unit_price })),
      payment_method: 'efectivo',
      amount_paid: quote.total
    };
    await api('/api/sales', { method: 'POST', body: JSON.stringify(data) });
    await api(`/api/quotes/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'aceptada' }) });
    toast('Venta realizada con éxito', 'success');
    navigateTo('sales');
  } catch (e) { toast(e.message, 'error'); }
}

async function viewQuote(id) {
  const q = await api(`/api/quotes/${id}`);
  document.getElementById('modal-title').textContent = `Cotización ${q.quote_number}`;
  document.getElementById('modal-body').innerHTML = `
        <div style="padding:10px;">
           <p><strong>Cliente:</strong> ${q.customer_name}</p>
           <p><strong>Fecha:</strong> ${formatDate(q.created_at)}</p>
           <p><strong>Válido hasta:</strong> ${q.expiration_date ? q.expiration_date.split('T')[0] : '-'}</p>
           <hr style="margin:10px 0;">
           <table>
             <thead><tr><th>Item</th><th>Cant</th><th>Precio</th><th>Sub</th></tr></thead>
             <tbody>
                ${q.items.map(i => `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>${fmt(i.unit_price)}</td><td>${fmt(i.subtotal)}</td></tr>`).join('')}
             </tbody>
           </table>
           <div style="text-align:right; margin-top:15px; font-size:1.2rem; font-weight:bold;">
              Total: ${fmt(q.total)}
           </div>
           <button class="btn btn-primary" onclick='printQuote(${JSON.stringify(q).replace(/'/g, "&apos;")})' style="width:100%; margin-top:20px;">
             <i class="fas fa-print"></i> Imprimir Cotización
           </button>
        </div>
    `;
  openModal();
}

// ============================================ PURCHASE ORDERS (ÓRDENES DE COMPRA) ============================================
async function loadPurchaseOrders(container, search = '') {
  const orders = await api(`/api/purchase-orders${search ? `?search=${search}` : ''}`);

  container.innerHTML = `
    <div class="table-container">
      <div class="table-toolbar">
        <span style="color:var(--text-muted);font-size:0.85rem;">${orders.length} órdenes</span>
        <button class="btn btn-primary" onclick="openPurchaseOrderModal()"><i class="fas fa-plus"></i> Nueva Orden</button>
      </div>
      <div style="overflow-x:auto;">
        <table>
          <thead>
            <tr>
              <th>Orden</th>
              <th>Proveedor</th>
              <th>Fecha</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Factura</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${orders.map(o => `
              <tr>
                <td><strong>${o.order_number}</strong></td>
                <td>${o.supplier_name || '-'}</td>
                <td>${formatDate(o.created_at)}</td>
                <td>${fmt(o.total)}</td>
                <td><span class="badge badge-${o.status === 'recibida' ? 'success' : 'warning'}">${o.status}</span></td>
                <td>${o.invoice_file_url ? `<a href="${o.invoice_file_url}" target="_blank" class="badge badge-info"><i class="fas fa-file-invoice"></i> Ver</a>` : '-'}</td>
                <td>
                  <div class="action-buttons">
                    <button class="action-btn view" onclick="viewPurchaseOrder(${o.id})"><i class="fas fa-eye"></i></button>
                    ${o.status === 'pendiente' ? `<button class="action-btn success" title="Recibir Mercancía" onclick="receivePurchaseOrder(${o.id})"><i class="fas fa-check-double"></i></button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function openPurchaseOrderModal() {
  const suppliers = await api('/api/suppliers');
  const products = await api('/api/products?limit=200');
  allProducts = products.products;
  cart = [];

  document.getElementById('modal-title').textContent = 'Nueva Orden de Compra';
  document.getElementById('modal-body').innerHTML = `
    <div class="form-group">
      <label>Proveedor</label>
      <select id="pof-supplier" class="filter-select" style="width:100%; padding:10px;">
        <option value="">Seleccionar Proveedor...</option>
        ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
      </select>
    </div>
    <div class="pos-container" style="height: auto; max-height: 80vh;">
      <div class="pos-main" style="flex: 1;">
        <div class="search-box">
          <i class="fas fa-search"></i>
          <input type="text" placeholder="Producto para comprar..." oninput="filterQuoteProducts(this.value)">
        </div>
        <div id="quote-prod-list" class="pos-products-grid" style="grid-template-columns: repeat(3, 1fr); margin-top:10px; height:300px; overflow-y:auto;">
           ${products.products.map(p => `<div class="pos-product-card" onclick="addToOrder(${p.id})">
              <p style="font-size:0.8rem; margin:5px 0;">${p.name}</p>
              <p style="color:var(--text-muted);">Costo: ${fmt(p.cost)}</p>
           </div>`).join('')}
        </div>
      </div>
      <div class="pos-sidebar" style="width: 300px; margin-left: 20px;">
        <h3>Items a Pedir</h3>
        <div id="quote-cart" style="height:350px; overflow-y:auto; border:1px solid var(--border); padding:5px;"></div>
        <div class="pos-summary">
           <div class="summary-row" style="font-weight:bold;"><span>Total:</span><span id="quote-total">${fmt(0)}</span></div>
        </div>
        <button class="btn btn-primary" onclick="savePurchaseOrder()" style="width:100%; margin-top:10px;"><i class="fas fa-truck"></i> Emitir Orden</button>
      </div>
    </div>
  `;
  openModal();
}

function addToOrder(id) {
  const prod = allProducts.find(p => p.id === id);
  if (!prod) return;
  const existing = cart.find(i => i.id === id);
  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ id: prod.id, name: prod.name, price: prod.cost, quantity: 1 });
  }
  updateQuoteCart();
}

async function savePurchaseOrder() {
  const supplier_id = document.getElementById('pof-supplier').value;
  if (!supplier_id) return toast('Selecciona un proveedor', 'error');
  if (cart.length === 0) return toast('Agrega productos', 'error');

  const data = {
    supplier_id,
    items: cart.map(i => ({ product_id: i.id, product_name: i.name, quantity: i.quantity, unit_cost: i.price }))
  };
  try {
    await api('/api/purchase-orders', { method: 'POST', body: JSON.stringify(data) });
    toast('Orden de compra emitida', 'success');
    closeModal();
    navigateTo('purchase-orders');
  } catch (e) { toast(e.message, 'error'); }
}

async function receivePurchaseOrder(id) {
  const order = await api(`/api/purchase-orders/${id}`);
  document.getElementById('modal-title').textContent = `Recibir Orden ${order.order_number}`;
  document.getElementById('modal-body').innerHTML = `
        <p>Al confirmar el recibo, el stock de los productos aumentará automáticamente.</p>
        <div class="form-group" style="margin-top:20px;">
           <label>Factura del Proveedor (Opcional)</label>
           <input type="file" id="rof-invoice-file" onchange="previewInvoiceUpload(this)">
           <input type="hidden" id="rof-invoice-url">
           <div id="invoice-preview-msg"></div>
        </div>
        <div class="modal-actions">
           <button class="btn btn-primary" onclick="confirmReceiveOrder(${id})"><i class="fas fa-check"></i> Confirmar Ingreso de Mercancía</button>
        </div>
    `;
  openModal();
}

async function confirmReceiveOrder(id) {
  const fileInput = document.getElementById('rof-invoice-file');
  let invoiceUrl = '';
  if (fileInput.files.length > 0) {
    const formData = new FormData();
    formData.append('image', fileInput.files[0]);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    const data = await res.json();
    invoiceUrl = data.url;
  }

  try {
    await api(`/api/purchase-orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status: 'recibida', invoice_file_url: invoiceUrl }) });
    toast('Mercancía recibida e inventario actualizado', 'success');
    closeModal();
    navigateTo('purchase-orders');
  } catch (e) { toast(e.message, 'error'); }
}

async function viewPurchaseOrder(id) {
  const o = await api(`/api/purchase-orders/${id}`);
  document.getElementById('modal-title').textContent = `Orden ${o.order_number}`;
  document.getElementById('modal-body').innerHTML = `
        <div>
           <p><strong>Proveedor:</strong> ${o.supplier_name}</p>
           <p><strong>Fecha:</strong> ${formatDate(o.created_at)}</p>
           <p><strong>Estado:</strong> ${o.status}</p>
           ${o.invoice_file_url ? `<p><strong>Factura:</strong> <a href="${o.invoice_file_url}" target="_blank">Ver Archivo</a></p>` : ''}
           <hr>
           <table>
             <thead><tr><th>Producto</th><th>Cant</th><th>Costo</th><th>Sub</th></tr></thead>
             <tbody>
                ${o.items.map(i => `<tr><td>${i.product_name}</td><td>${i.quantity}</td><td>${fmt(i.unit_cost)}</td><td>${fmt(i.subtotal)}</td></tr>`).join('')}
             </tbody>
           </table>
           <div style="text-align:right; font-size:1.2rem; font-weight:bold; margin-top:10px;">Total: ${fmt(o.total)}</div>
           <button class="btn btn-primary" onclick='printPurchaseOrder(${JSON.stringify(o).replace(/'/g, "&apos;")})' style="width:100%; margin-top:20px;">
             <i class="fas fa-print"></i> Imprimir Orden
           </button>
        </div>
    `;
  openModal();
}

// ============================================ EXPIRATION (VENCIMIENTOS) ============================================
async function loadExpiring(container) {
  const products = await api('/api/products/reports/expiring');

  container.innerHTML = `
        <div class="table-container">
            <div class="table-toolbar">
                <span style="color:var(--text-muted);font-size:0.85rem;">${products.length} productos por vencer en los próximos 30 días</span>
            </div>
            <div style="overflow-x:auto;">
                <table>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>SKU</th>
                            <th>Stock</th>
                            <th>Vencimiento</th>
                            <th>Días restantes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(p => {
    const diff = Math.ceil((new Date(p.expiration_date) - new Date()) / (1000 * 60 * 60 * 24));
    return `
                            <tr>
                                <td><strong>${p.name}</strong></td>
                                <td>${p.sku}</td>
                                <td><span class="badge ${p.stock <= 0 ? 'badge-danger' : 'badge-info'}">${p.stock}</span></td>
                                <td style="color:${diff <= 7 ? 'var(--danger)' : 'var(--warning)'}; font-weight:bold;">${p.expiration_date.split('T')[0]}</td>
                                <td><span class="badge ${diff <= 7 ? 'badge-danger' : 'badge-warning'}">${diff} días</span></td>
                            </tr>`;
  }).join('') || '<tr><td colspan="5" class="text-center">No hay productos próximos a vencer</td></tr>'}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function filterQuoteProducts(q) {
  const list = document.getElementById('quote-prod-list');
  const prods = allProducts.filter(p => p.name.toLowerCase().includes(q.toLowerCase()) || p.sku.toLowerCase().includes(q.toLowerCase()));
  list.innerHTML = prods.map(p => `
        <div class="pos-product-card" onclick="${currentSection === 'quotes' ? 'addToQuote' : 'addToOrder'}(${p.id})">
           <div class="product-img-mini" style="width:100%; height:60px;">${p.image_url ? `<img src="${p.image_url}">` : '<i class="fas fa-box"></i>'}</div>
           <p style="font-size:0.8rem; margin:5px 0;">${p.name}</p>
           <p style="font-weight:bold;">${currentSection === 'quotes' ? fmt(p.price) : fmt(p.cost)}</p>
        </div>
    `).join('') || '<p>No hay resultados</p>';
}

function previewInvoiceUpload(input) {
  const msg = document.getElementById('invoice-preview-msg');
  if (input.files && input.files[0]) {
    msg.innerHTML = `<p style="color:var(--success); font-size:0.8rem; margin-top:5px;"><i class="fas fa-file"></i> Archivo listo: ${input.files[0].name}</p>`;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit' });
}

// ============================================ PREVIEW IMAGE ============================================

// ============================================ INIT ============================================
let branchRetries = 0;
const MAX_BRANCH_RETRIES = 5;

async function loadBranches() {
  try {
    const res = await fetch('/api/auth/branches', { cache: 'no-store' });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${res.status}`);
    }
    const branches = await res.json();
    const branchSelect = document.getElementById('login-branch');
    if (branchSelect) {
      if (branches.length === 0) {
        branchSelect.innerHTML = '<option value="" style="color: black;">No hay sucursales configuradas</option>';
      } else {
        branchSelect.innerHTML = branches.map(b => `<option value="${b.id}" style="color: black;">${b.name}</option>`).join('');
      }
    }
    branchRetries = 0; // Reset on success
  } catch (e) {
    console.warn(`Error cargando sucursales (intento ${branchRetries + 1}/${MAX_BRANCH_RETRIES}):`, e.message);
    branchRetries++;
    if (branchRetries < MAX_BRANCH_RETRIES) {
      setTimeout(loadBranches, 3000);
    } else {
      const branchSelect = document.getElementById('login-branch');
      if (branchSelect) {
        branchSelect.innerHTML = '<option value="" style="color: black;">Error al cargar sucursales</option>';
      }
      const errorEl = document.getElementById('login-error');
      if (errorEl) {
        errorEl.textContent = 'No se pudieron cargar las sucursales. Verifica la conexión al servidor.';
        errorEl.style.display = 'block';
      }
    }
  }
}

(async function init() {
  await loadBranches();
  if (token) {
    try {
      currentUser = await api('/api/auth/me');
      showMainApp();
    } catch {
      handleLogout();
    }
  }
})();

