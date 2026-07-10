let bookings = [];
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

// Currency formatting (VND)
function formatVND(value) {
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
});

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

// Render everything
function renderDashboard() {
  updateStats();
  renderTable();
}

// Update stats cards and filter tab count badges
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
  
  // Filter bookings
  let filtered = bookings;
  if (activeFilter !== 'all') {
    filtered = filtered.filter(b => b.status === activeFilter);
  }
  
  // Search filter
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
    // Format date
    let dateStr = booking.event_date;
    try {
      const d = new Date(booking.event_date);
      dateStr = d.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch(e){}

    // Services list
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

    // Notes
    const notesHtml = booking.notes 
      ? `<span class="booking-notes-text">${booking.notes}</span>` 
      : `<span style="color: var(--text-muted); font-style: italic;">Không có ghi chú</span>`;

    // Status classes for dropdown
    const selectClass = `status-select status-${booking.status}`;

    // Create row
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

// Change booking status API call
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
    
    // Update local state and re-render
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      booking.status = newStatus;
    }
    renderDashboard();
  } catch (err) {
    alert(err.message);
    fetchBookings(); // refresh UI to resolve mismatch
  }
};

// Delete booking API call
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
    
    // Update local state and re-render
    bookings = bookings.filter(b => b.id !== id);
    renderDashboard();
  } catch (err) {
    alert(err.message);
  }
};

// Search listener
searchInput.addEventListener('input', (e) => {
  searchQuery = e.target.value;
  renderTable();
});

// Filters listener
filterTabs.querySelectorAll('.filter-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    filterTabs.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeFilter = tab.getAttribute('data-status');
    renderTable();
  });
});
