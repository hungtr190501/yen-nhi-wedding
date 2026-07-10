let bookings = [];
let allServices = [];
let allCategories = [];
let activeFilter = 'all';
let searchQuery = '';

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const adminApp = document.getElementById('adminApp');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const bookingsTableBody = document.getElementById('bookingsTableBody');
const noBookingsMsg = document.getElementById('noBookingsMsg');
const searchInput = document.getElementById('adminSearchInput');
const filterTabs = document.getElementById('statusFilterTabs');

// Panel elements
const navTabs = document.querySelectorAll('.admin-nav-tab');
const panels = document.querySelectorAll('.admin-panel');
const adminServicesTableBody = document.getElementById('adminServicesTableBody');

// Service Modal elements
const serviceModal = document.getElementById('serviceModal');
const serviceForm = document.getElementById('serviceForm');
const addServiceBtn = document.getElementById('addServiceBtn');
const closeServiceModalBtn = document.getElementById('closeServiceModalBtn');
const cancelServiceModalBtn = document.getElementById('cancelServiceModalBtn');
const addFeatureInputBtn = document.getElementById('addFeatureInputBtn');
const srvFeaturesList = document.getElementById('srvFeaturesList');
const uploadTriggerBtn = document.getElementById('uploadTriggerBtn');
const srvImageFile = document.getElementById('srvImageFile');
const srvImageUrl = document.getElementById('srvImageUrl');
const srvImagePreview = document.getElementById('srvImagePreview');
const srvCategorySelect = document.getElementById('srvCategory');

// Currency formatting (VND)
function formatVND(value) {
  if (value === null || value === undefined || isNaN(value)) return '0 đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

// Check authorization on load
document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('yn_admin_token');
  if (token) {
    showDashboard();
  } else {
    showLogin();
  }
  setupNavigation();
  setupServiceModal();
});

// Setup Panel Navigation
function setupNavigation() {
  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const targetPanel = tab.getAttribute('data-panel');
      panels.forEach(p => {
        if (p.id === targetPanel) {
          p.classList.remove('hidden');
        } else {
          p.classList.add('hidden');
        }
      });

      if (targetPanel === 'servicesPanel') {
        loadCatalogData();
      }
    });
  });
}

// Login handling
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('adminPassword').value;
  loginError.classList.add('hidden');

  try {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      localStorage.setItem('yn_admin_token', data.token);
      showDashboard();
    } else {
      throw new Error(data.error || 'Đăng nhập thất bại');
    }
  } catch (err) {
    loginError.textContent = err.message;
    loginError.classList.remove('hidden');
  }
});

// Logout handling
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('yn_admin_token');
  showLogin();
});

function showLogin() {
  loginScreen.classList.remove('hidden');
  adminApp.classList.add('hidden');
  document.getElementById('adminPassword').value = '';
}

function showDashboard() {
  loginScreen.classList.add('hidden');
  adminApp.classList.remove('hidden');
  fetchBookings();
  loadCatalogData();
}

// Fetch bookings from backend
async function fetchBookings() {
  const token = localStorage.getItem('yn_admin_token');
  try {
    const res = await fetch('/api/admin/bookings', {
      headers: { 'x-admin-token': token }
    });
    if (res.status === 401) {
      localStorage.removeItem('yn_admin_token');
      showLogin();
      return;
    }
    if (!res.ok) throw new Error('Không thể tải danh sách đặt lịch.');
    
    bookings = await res.json();
    renderDashboard();
  } catch (err) {
    console.error('Fetch bookings failed:', err);
    alert(err.message);
  }
}

// Load Categories & Services for CRUD panel
async function loadCatalogData() {
  try {
    // 1. Fetch categories
    const catRes = await fetch('/api/categories');
    if (!catRes.ok) throw new Error('Không thể tải danh mục.');
    allCategories = await catRes.json();
    
    // Populate select element in modal
    srvCategorySelect.innerHTML = '<option value="">-- Chọn danh mục --</option>';
    allCategories.forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      opt.textContent = cat.name;
      srvCategorySelect.appendChild(opt);
    });

    // 2. Fetch services
    const srvRes = await fetch('/api/services');
    if (!srvRes.ok) throw new Error('Không thể tải danh sách dịch vụ.');
    allServices = await srvRes.json();

    renderAdminServices();
  } catch (err) {
    console.error('Load catalog failed:', err);
  }
}

// Render Bookings Dashboard
function renderDashboard() {
  updateStats();
  renderTable();
}

// Update stats cards
function updateStats() {
  const total = bookings.length;
  const pending = bookings.filter(b => b.status === 'pending').length;
  const confirmed = bookings.filter(b => b.status === 'confirmed').length;
  const completed = bookings.filter(b => b.status === 'completed').length;
  const cancelled = bookings.filter(b => b.status === 'cancelled').length;

  // Calculate revenue from confirmed and completed bookings
  let revenue = 0;
  bookings.forEach(b => {
    if (b.status === 'confirmed' || b.status === 'completed') {
      b.services.forEach(s => {
        revenue += Number(s.price);
      });
    }
  });

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statConfirmed').textContent = confirmed;
  document.getElementById('statRevenue').textContent = formatVND(revenue);

  // Update tabs counters
  document.getElementById('countAll').textContent = total;
  document.getElementById('countPending').textContent = pending;
  document.getElementById('countConfirmed').textContent = confirmed;
  document.getElementById('countCompleted').textContent = completed;
  document.getElementById('countCancelled').textContent = cancelled;
}

// Render booking table records
function renderTable() {
  bookingsTableBody.innerHTML = '';
  
  let filtered = bookings;
  if (activeFilter !== 'all') {
    filtered = filtered.filter(b => b.status === activeFilter);
  }
  
  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    filtered = filtered.filter(b => 
      b.customer_name.toLowerCase().includes(query) || 
      b.customer_phone.includes(query) ||
      (b.customer_email && b.customer_email.toLowerCase().includes(query)) ||
      b.event_address.toLowerCase().includes(query)
    );
  }

  if (filtered.length === 0) {
    noBookingsMsg.classList.remove('hidden');
    return;
  } else {
    noBookingsMsg.classList.add('hidden');
  }

  filtered.forEach(booking => {
    let dateStr = booking.event_date;
    try {
      const d = new Date(booking.event_date);
      dateStr = d.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch(e){}

    let totalCost = 0;
    let servicesHtml = '<ul class="admin-services-list">';
    if (booking.services && booking.services.length > 0) {
      booking.services.forEach(s => {
        totalCost += Number(s.price);
        servicesHtml += `<li><i class="fa-solid fa-gift"></i> ${s.name} (${formatVND(s.price)})</li>`;
      });
    } else {
      servicesHtml += '<li style="color: var(--text-muted);"><i class="fa-solid fa-triangle-exclamation"></i> Không có dịch vụ</li>';
    }
    servicesHtml += '</ul>';
    servicesHtml += `<div class="admin-booking-total">Tổng: <span>${formatVND(totalCost)}</span></div>`;

    const notesHtml = booking.notes 
      ? `<span class="booking-notes-text">${booking.notes}</span>` 
      : `<span style="color: var(--text-muted); font-style: italic;">Không có ghi chú</span>`;

    const selectClass = `status-select status-${booking.status}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <div class="cust-name">${booking.customer_name}</div>
        <div class="cust-contact">
          <a href="tel:${booking.customer_phone}"><i class="fa-solid fa-phone"></i> ${booking.customer_phone}</a>
          ${booking.customer_email ? `<br><a href="mailto:${booking.customer_email}"><i class="fa-solid fa-envelope"></i> ${booking.customer_email}</a>` : ''}
        </div>
      </td>
      <td>
        <div class="event-date-text"><i class="fa-regular fa-calendar-days"></i> ${dateStr}</div>
        <div class="event-address-text"><i class="fa-solid fa-location-dot"></i> ${booking.event_address}</div>
      </td>
      <td>${servicesHtml}</td>
      <td>${notesHtml}</td>
      <td>
        <select class="${selectClass}" onchange="changeBookingStatus('${booking.id}', this.value)">
          <option value="pending" ${booking.status === 'pending' ? 'selected' : ''}>Chờ xử lý</option>
          <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>Đã xác nhận</option>
          <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>Đã hoàn thành</option>
          <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>Đã hủy</option>
        </select>
      </td>
      <td style="text-align: center;">
        <button class="btn-delete-booking" onclick="deleteBooking('${booking.id}')" title="Xóa lịch đặt">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    bookingsTableBody.appendChild(tr);
  });
}

// Change booking status
window.changeBookingStatus = async function(id, newStatus) {
  const token = localStorage.getItem('yn_admin_token');
  try {
    const res = await fetch(`/api/admin/bookings/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': token
      },
      body: JSON.stringify({ status: newStatus })
    });
    if (res.status === 401) {
      localStorage.removeItem('yn_admin_token');
      showLogin();
      return;
    }
    if (!res.ok) throw new Error('Không thể cập nhật trạng thái.');
    
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      booking.status = newStatus;
    }
    renderDashboard();
  } catch (err) {
    alert(err.message);
    fetchBookings();
  }
};

// Delete booking
window.deleteBooking = async function(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa lịch đặt này? Hành động này không thể hoàn tác.')) {
    return;
  }
  const token = localStorage.getItem('yn_admin_token');
  try {
    const res = await fetch(`/api/admin/bookings/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token }
    });
    if (res.status === 401) {
      localStorage.removeItem('yn_admin_token');
      showLogin();
      return;
    }
    if (!res.ok) throw new Error('Không thể xóa lịch đặt.');
    bookings = bookings.filter(b => b.id !== id);
    renderDashboard();
  } catch (err) {
    alert(err.message);
  }
};

// Search & Filter listeners
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderTable();
});

filterTabs.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.getAttribute('data-status');
    renderTable();
  });
});


// ==========================================================
// Services Panel Actions (CRUD)
// ==========================================================

function renderAdminServices() {
  adminServicesTableBody.innerHTML = '';
  if (allServices.length === 0) {
    adminServicesTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
          <i class="fa-regular fa-folder-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
          Chưa có dịch vụ nào được tạo.
        </td>
      </tr>`;
    return;
  }

  allServices.forEach(srv => {
    // Find category name
    const category = allCategories.find(c => c.id === srv.category_id);
    const categoryName = category ? category.name : 'Chưa phân loại';

    // Image URL or fallback
    const imgUrl = srv.image_url || 'https://images.unsplash.com/photo-1549417229-aa67d3263c09?auto=format&fit=crop&q=80&w=150';

    // Price tags display
    let priceHtml = `<div><strong>${formatVND(Number(srv.price))}</strong> / ${srv.unit}</div>`;
    if (srv.discount_price) {
      priceHtml = `
        <div><span class="admin-srv-price-strike">${formatVND(Number(srv.price))}</span></div>
        <div><strong style="color: var(--primary);">${formatVND(Number(srv.discount_price))}</strong> / ${srv.unit}</div>
      `;
    }
    if (srv.promo_text) {
      priceHtml += `<div class="admin-srv-promo-badge" title="Mô tả khuyến mãi">${srv.promo_text}</div>`;
    }

    // Features preview
    const featuresList = (srv.features || [])
      .map(f => `<li><i class="fa-solid fa-check" style="color: var(--success); font-size: 0.75rem;"></i> ${f}</li>`)
      .join('');
    const featuresHtml = `<ul class="admin-srv-features-preview">${featuresList}</ul>`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="width: 100px;">
        <img src="${imgUrl}" alt="${srv.name}" class="admin-srv-thumb" onerror="this.src='https://images.unsplash.com/photo-1549417229-aa67d3263c09?auto=format&fit=crop&q=80&w=150';">
      </td>
      <td>
        <div class="admin-srv-name">${srv.name}</div>
        ${srv.is_featured ? '<span class="badge-featured">Nổi Bật</span>' : ''}
      </td>
      <td style="color: var(--text-muted);">${categoryName}</td>
      <td>${priceHtml}</td>
      <td>${featuresHtml}</td>
      <td style="text-align: center; width: 180px;">
        <div style="display: flex; gap: 0.5rem; justify-content: center;">
          <button class="btn btn-outline btn-sm" onclick="openEditServiceModal('${srv.id}')" title="Sửa dịch vụ">
            <i class="fa-solid fa-pencil"></i> Sửa
          </button>
          <button class="btn btn-outline btn-sm btn-delete" onclick="deleteService('${srv.id}')" title="Xóa dịch vụ" style="color: var(--primary);">
            <i class="fa-solid fa-trash-can"></i> Xóa
          </button>
        </div>
      </td>
    `;
    adminServicesTableBody.appendChild(tr);
  });
}

// Setup Service Modal listeners
function setupServiceModal() {
  addServiceBtn.addEventListener('click', () => {
    openAddServiceModal();
  });

  const closeBtns = [closeServiceModalBtn, cancelServiceModalBtn];
  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      serviceModal.classList.add('hidden');
    });
  });

  // Dynamic feature inputs addition
  addFeatureInputBtn.addEventListener('click', () => {
    addFeatureInputRow('');
  });

  // Image Upload handler
  uploadTriggerBtn.addEventListener('click', () => {
    srvImageFile.click();
  });

  srvImageFile.addEventListener('change', async () => {
    const file = srvImageFile.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('image', file);

    const token = localStorage.getItem('yn_admin_token');
    uploadTriggerBtn.disabled = true;
    uploadTriggerBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải...';

    try {
      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        headers: {
          'x-admin-token': token
        },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Tải ảnh thất bại.');

      srvImageUrl.value = data.url;
      srvImagePreview.src = data.url;
      srvImagePreview.classList.remove('hidden');
    } catch (err) {
      alert(err.message);
    } finally {
      uploadTriggerBtn.disabled = false;
      uploadTriggerBtn.innerHTML = '<i class="fa-solid fa-upload"></i> Tải ảnh lên';
    }
  });

  // Form submission handler
  serviceForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('srvId').value;
    const name = document.getElementById('srvName').value.trim();
    const category_id = srvCategorySelect.value;
    const price = Number(document.getElementById('srvPrice').value);
    const discountPriceVal = document.getElementById('srvDiscountPrice').value;
    const discount_price = discountPriceVal ? Number(discountPriceVal) : null;
    const unit = document.getElementById('srvUnit').value.trim();
    const promo_text = document.getElementById('srvPromoText').value.trim() || null;
    const image_url = srvImageUrl.value.trim() || null;
    const is_featured = document.getElementById('srvIsFeatured').checked;

    // Collect features from inputs
    const features = Array.from(srvFeaturesList.querySelectorAll('.feature-input-row input'))
      .map(input => input.value.trim())
      .filter(Boolean);

    const payload = {
      category_id,
      name,
      price,
      discount_price,
      unit,
      promo_text,
      image_url,
      features,
      is_featured
    };

    const token = localStorage.getItem('yn_admin_token');
    const method = id ? 'PATCH' : 'POST';
    const url = id ? `/api/admin/services/${id}` : '/api/admin/services';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-admin-token': token
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Không thể lưu dịch vụ.');

      serviceModal.classList.add('hidden');
      loadCatalogData();
    } catch (err) {
      alert(err.message);
    }
  });
}

function addFeatureInputRow(val) {
  const row = document.createElement('div');
  row.className = 'feature-input-row';
  row.style.display = 'flex';
  row.style.gap = '0.5rem';
  row.style.marginBottom = '0.5rem';
  row.innerHTML = `
    <input type="text" placeholder="Ví dụ: Bàn thờ kết hoa tươi 100%" value="${val}" style="flex: 1;">
    <button type="button" class="btn btn-outline btn-sm" onclick="this.parentElement.remove()" style="color: var(--primary); padding: 0.5rem 0.8rem; border-radius: 4px;">
      <i class="fa-solid fa-trash-can"></i>
    </button>
  `;
  srvFeaturesList.appendChild(row);
}

function openAddServiceModal() {
  document.getElementById('modalTitle').textContent = 'Thêm Dịch Vụ Mới';
  document.getElementById('srvId').value = '';
  serviceForm.reset();
  srvFeaturesList.innerHTML = '';
  srvImagePreview.classList.add('hidden');
  srvImagePreview.src = '';
  
  // Add 3 empty inputs for convenience
  addFeatureInputRow('');
  addFeatureInputRow('');
  addFeatureInputRow('');
  
  serviceModal.classList.remove('hidden');
}

window.openEditServiceModal = function(id) {
  const srv = allServices.find(s => s.id === id);
  if (!srv) return;

  document.getElementById('modalTitle').textContent = 'Sửa Thông Tin Dịch Vụ';
  document.getElementById('srvId').value = srv.id;
  document.getElementById('srvName').value = srv.name;
  srvCategorySelect.value = srv.category_id || '';
  document.getElementById('srvPrice').value = srv.price;
  document.getElementById('srvDiscountPrice').value = srv.discount_price || '';
  document.getElementById('srvUnit').value = srv.unit || 'gói';
  document.getElementById('srvPromoText').value = srv.promo_text || '';
  srvImageUrl.value = srv.image_url || '';
  document.getElementById('srvIsFeatured').checked = !!srv.is_featured;

  if (srv.image_url) {
    srvImagePreview.src = srv.image_url;
    srvImagePreview.classList.remove('hidden');
  } else {
    srvImagePreview.classList.add('hidden');
    srvImagePreview.src = '';
  }

  // Populate features list inputs
  srvFeaturesList.innerHTML = '';
  if (srv.features && srv.features.length > 0) {
    srv.features.forEach(f => {
      addFeatureInputRow(f);
    });
  } else {
    addFeatureInputRow('');
  }

  serviceModal.classList.remove('hidden');
};

window.deleteService = async function(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa dịch vụ này? Hành động này sẽ loại bỏ nó khỏi bảng danh mục trên web.')) {
    return;
  }
  
  const token = localStorage.getItem('yn_admin_token');
  try {
    const res = await fetch(`/api/admin/services/${id}`, {
      method: 'DELETE',
      headers: { 'x-admin-token': token }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Xóa dịch vụ thất bại.');
    loadCatalogData();
  } catch (err) {
    alert(err.message);
  }
};
