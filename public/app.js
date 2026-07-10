let allCategories = [];
let allServices = [];
let allCombos = [];
let selectedServices = [];

// DOM Elements
const categoryTabs = document.getElementById('categoryTabs');
const servicesGrid = document.getElementById('servicesGrid');
const selectedItemsBox = document.getElementById('selectedItemsBox');
const bookingForm = document.getElementById('bookingForm');
const formStatus = document.getElementById('formStatus');
const mobileToggle = document.getElementById('mobileToggle');
const navBar = document.getElementById('navBar');

// Formatting helper for currency (VND)
function formatVND(value) {
  if (value === null || value === undefined || isNaN(value)) return '0 đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
}

// UUID Generator
function generateUUID() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Fallback images
const fallbackImages = {
  'gia-tien': 'https://images.unsplash.com/photo-1549417229-aa67d3263c09?auto=format&fit=crop&q=80&w=600',
  'rap-cuoi': 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&q=80&w=600',
  'mam-trap': 'https://images.unsplash.com/photo-1520854221256-174b1ec358ef?auto=format&fit=crop&q=80&w=600',
  'xe-hoa': 'https://images.unsplash.com/photo-1511527661048-7fe73d85e9a4?auto=format&fit=crop&q=80&w=600'
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  setupNavbar();
  setupMiniCartEvents();
  loadSelections();
  
  try {
    // Load configurations/settings
    await loadSettings();
    
    // Load catalog data directly from our Express server API
    await loadCatalog();
  } catch (err) {
    console.error('Initialization failed:', err);
    if (servicesGrid) {
      showError('Không thể kết nối đến cơ sở dữ liệu. Vui lòng kiểm tra môi trường hoặc thử lại.');
    }
  }
});

// Load website settings configuration
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (!res.ok) throw new Error('Không thể tải cấu hình website');
    const settings = await res.json();
    
    // Update logo texts
    const logoText = document.getElementById('cfgLogoText');
    if (logoText) {
      const nameParts = (settings.site_name || 'Yến Nhi Wedding').split(' ');
      if (nameParts.length > 1) {
        const mainName = nameParts.slice(0, -1).join(' ');
        const subName = nameParts[nameParts.length - 1];
        logoText.innerHTML = `${mainName} <span class="logo-sub">${subName}</span>`;
      } else {
        logoText.innerHTML = `${settings.site_name || 'Yến Nhi'} <span class="logo-sub">Wedding</span>`;
      }
    }
    
    const footerLogo = document.getElementById('cfgFooterLogo');
    if (footerLogo) {
      const nameParts = (settings.site_name || 'Yến Nhi Wedding').split(' ');
      if (nameParts.length > 1) {
        const mainName = nameParts.slice(0, -1).join(' ');
        const subName = nameParts[nameParts.length - 1];
        footerLogo.innerHTML = `${mainName} <span class="logo-sub">${subName}</span>`;
      } else {
        footerLogo.innerHTML = `${settings.site_name || 'Yến Nhi'} <span class="logo-sub">Wedding</span>`;
      }
    }
    
    // Update contact details
    const hotline = document.getElementById('cfgHotline');
    if (hotline) hotline.textContent = settings.hotline || '0909.123.456 (Zalo)';
    
    const address = document.getElementById('cfgAddress');
    if (address) address.textContent = settings.address || '';
    
    const workingHours = document.getElementById('cfgWorkingHours');
    if (workingHours) workingHours.textContent = settings.working_hours || '';
    
    // Update footer details
    const footerPhone = document.getElementById('cfgFooterPhone');
    if (footerPhone) footerPhone.textContent = settings.hotline || '0909.123.456 (Zalo)';
    
    const footerEmail = document.getElementById('cfgFooterEmail');
    if (footerEmail) footerEmail.textContent = settings.email || 'yennhiwedding@gmail.com';
    
    const footerAddress = document.getElementById('cfgFooterAddress');
    if (footerAddress) footerAddress.textContent = settings.address || '';
    
    const footerDesc = document.getElementById('cfgFooterDesc');
    if (footerDesc) footerDesc.textContent = settings.footer_desc || '';
    
    const footerCopyright = document.getElementById('cfgFooterCopyright');
    if (footerCopyright) footerCopyright.innerHTML = settings.footer_copyright || '';
    
    // Load map iframe
    const mapWrapper = document.getElementById('cfgMapWrapper');
    if (mapWrapper && settings.map_iframe) {
      const srcVal = settings.map_iframe.trim();
      if (srcVal.startsWith('http://') || srcVal.startsWith('https://')) {
        mapWrapper.innerHTML = `
          <iframe 
            src="${srcVal}" 
            width="100%" 
            height="100%" 
            style="border:0;" 
            allowfullscreen="" 
            loading="lazy" 
            referrerpolicy="no-referrer-when-downgrade">
          </iframe>
        `;
      } else if (srcVal.includes('<iframe')) {
        // It's a full iframe tag
        mapWrapper.innerHTML = srcVal;
        const iframe = mapWrapper.querySelector('iframe');
        if (iframe) {
          iframe.setAttribute('width', '100%');
          iframe.setAttribute('height', '100%');
          iframe.style.border = '0';
        }
      } else {
        // Assume Google Maps Embed Source URL without protocol or raw text
        mapWrapper.innerHTML = `
          <iframe 
            src="https://www.google.com/maps/embed?pb=${srcVal}" 
            width="100%" 
            height="100%" 
            style="border:0;" 
            allowfullscreen="" 
            loading="lazy" 
            referrerpolicy="no-referrer-when-downgrade">
          </iframe>
        `;
      }
    }
  } catch (err) {
    console.error('Load settings failed:', err);
  }
}

// Mobile navbar toggle
function setupNavbar() {
  if (mobileToggle && navBar) {
    mobileToggle.addEventListener('click', () => {
      navBar.classList.toggle('show');
      const icon = mobileToggle.querySelector('i');
      if (navBar.classList.contains('show')) {
        icon.className = 'fa-solid fa-xmark';
      } else {
        icon.className = 'fa-solid fa-bars';
      }
    });

    // Close menu when clicking nav link
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        document.querySelectorAll('.nav-link').forEach(nl => nl.classList.remove('active'));
        link.classList.add('active');
        
        navBar.classList.remove('show');
        mobileToggle.querySelector('i').className = 'fa-solid fa-bars';
      });
    });
  }
}

// Load selections from localStorage
function loadSelections() {
  const saved = localStorage.getItem('yn_selected_services');
  if (saved) {
    try {
      selectedServices = JSON.parse(saved);
    } catch (e) {
      selectedServices = [];
    }
  }
  updateSelectedServicesUI();
  updateFloatingWidgetUI();
  renderMiniCart();
}

// Save selections to localStorage
function saveSelections() {
  localStorage.setItem('yn_selected_services', JSON.stringify(selectedServices));
  renderMiniCart();
}

// Load categories, services, and combos from backend
async function loadCatalog() {
  // Fetch categories
  const catRes = await fetch('/api/categories');
  if (!catRes.ok) throw new Error('Không thể tải danh mục sản phẩm');
  allCategories = await catRes.json();
  
  // Fetch services
  const servRes = await fetch('/api/services');
  if (!servRes.ok) throw new Error('Không thể tải danh sách dịch vụ');
  allServices = await servRes.json();

  // Fetch combos
  const comboRes = await fetch('/api/combos');
  if (comboRes.ok) {
    allCombos = await comboRes.json();
  }

  const isCatalogPage = window.location.pathname.includes('san-pham.html');
  if (isCatalogPage) {
    renderCatalogTabs();
    renderCatalog('all');
    setupCatalogSearch();
  } else {
    // Render dynamic categories and services list on the homepage
    renderHomepageTabs();
    renderHomepageServices('all');
    updateSelectedServicesUI();
  }
}

// Render tabs specifically for the separate Products Page
function renderCatalogTabs() {
  const tabsContainer = document.getElementById('catalogCategoryTabs');
  if (!tabsContainer) return;

  let html = `
    <button class="tab-btn active" data-category="all">Tất cả</button>
    <button class="tab-btn" data-category="combos"><i class="fa-solid fa-gift"></i> Gói Combo</button>
  `;
  
  allCategories.forEach(cat => {
    html += `<button class="tab-btn" data-category="${cat.id}">${cat.name}</button>`;
  });
  
  tabsContainer.innerHTML = html;

  // Add click handlers
  tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const catId = btn.getAttribute('data-category');
      renderCatalog(catId);
    });
  });
}

// Render categories filter tabs on the homepage
function renderHomepageTabs() {
  const tabsContainer = document.getElementById('categoryTabs');
  if (!tabsContainer) return;

  let html = `<button class="tab-btn active" data-category="all">Tất cả</button>`;
  allCategories.forEach(cat => {
    html += `<button class="tab-btn" data-category="${cat.id}">${cat.name}</button>`;
  });
  tabsContainer.innerHTML = html;

  // Add click handlers
  tabsContainer.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const catId = btn.getAttribute('data-category');
      renderHomepageServices(catId);
    });
  });
}

// Render dynamic services list on the homepage
function renderHomepageServices(categoryId) {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  const filtered = categoryId === 'all' 
    ? allServices 
    : allServices.filter(s => s.category_id === categoryId);

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="loading-spinner" style="grid-column: 1/-1;">
        <i class="fa-solid fa-circle-info"></i> Không tìm thấy dịch vụ nào thuộc danh mục này.
      </div>`;
    return;
  }

  let html = '';
  filtered.forEach(srv => {
    html += renderServiceCardHtml(srv);
  });
  grid.innerHTML = html;
}

// Hook up search filter on Products page
function setupCatalogSearch() {
  const searchInput = document.getElementById('catalogSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const activeTab = document.querySelector('#catalogCategoryTabs .tab-btn.active');
      const catId = activeTab ? activeTab.getAttribute('data-category') : 'all';
      renderCatalog(catId);
    });
  }
}

// Render dynamic catalog list on separate Products page
function renderCatalog(categoryId) {
  const grid = document.getElementById('catalogServicesGrid');
  if (!grid) return;

  const searchInput = document.getElementById('catalogSearchInput');
  const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

  let filteredServices = allServices;
  let filteredCombos = allCombos;

  // 1. Filter by search query
  if (query) {
    filteredServices = allServices.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.description && s.description.toLowerCase().includes(query))
    );
    filteredCombos = allCombos.filter(c => 
      c.name.toLowerCase().includes(query) || 
      (c.description && c.description.toLowerCase().includes(query))
    );
  }

  // 2. Filter by category tab
  let html = '';
  if (categoryId === 'combos') {
    if (filteredCombos.length === 0) {
      html = `<div class="loading-spinner" style="grid-column: 1/-1;"><i class="fa-solid fa-circle-info"></i> Không tìm thấy Combo nào phù hợp.</div>`;
    } else {
      filteredCombos.forEach(combo => {
        html += renderComboCardHtml(combo);
      });
    }
  } else if (categoryId === 'all') {
    if (filteredCombos.length === 0 && filteredServices.length === 0) {
      html = `<div class="loading-spinner" style="grid-column: 1/-1;"><i class="fa-solid fa-circle-info"></i> Không tìm thấy gói dịch vụ cưới nào.</div>`;
    } else {
      filteredCombos.forEach(combo => {
        html += renderComboCardHtml(combo);
      });
      filteredServices.forEach(srv => {
        html += renderServiceCardHtml(srv);
      });
    }
  } else {
    // Show only specific category services
    const catServices = filteredServices.filter(s => s.category_id === categoryId);
    if (catServices.length === 0) {
      html = `<div class="loading-spinner" style="grid-column: 1/-1;"><i class="fa-solid fa-circle-info"></i> Không tìm thấy dịch vụ nào thuộc danh mục này.</div>`;
    } else {
      catServices.forEach(srv => {
        html += renderServiceCardHtml(srv);
      });
    }
  }

  grid.innerHTML = html;
}

// HTML builder for single services
function renderServiceCardHtml(service) {
  const isSelected = selectedServices.some(s => s.id === service.id);
  const category = allCategories.find(c => c.id === service.category_id);
  const slug = category ? category.slug : 'gia-tien';
  const imgUrl = service.image_url || fallbackImages[slug] || fallbackImages['gia-tien'];

  const featuresHtml = (service.features || [])
    .map(f => `<li><i class="fa-solid fa-check"></i> ${f}</li>`)
    .join('');

  let priceHtml = '';
  if (service.discount_price) {
    priceHtml = `
      <span class="price-original-strike">${formatVND(Number(service.price))}</span>
      <span class="price-discounted">${formatVND(Number(service.discount_price))}</span>
      <span class="service-unit">/ ${service.unit}</span>
    `;
  } else {
    priceHtml = `
      ${formatVND(Number(service.price))} <span class="service-unit">/ ${service.unit}</span>
    `;
  }

  const promoHtml = service.promo_text
    ? `<div class="service-promo-tag" title="Món quà đặc biệt"><i class="fa-solid fa-gift"></i> ${service.promo_text}</div>`
    : '';

  return `
    <div class="service-card animate-card" data-id="${service.id}">
      ${service.is_featured ? `<span class="service-badge">Phổ Biến</span>` : ''}
      <div class="service-img-wrapper" onclick="window.location.href='/chi-tiet.html?id=${service.id}'" style="cursor: pointer;">
        <img class="service-img" src="${imgUrl}" alt="${service.name}" onerror="this.onerror=null; this.src='${fallbackImages[slug]}';">
      </div>
      <div class="service-body">
        <h3 class="service-name">
          <a href="/chi-tiet.html?id=${service.id}" style="color: inherit; text-decoration: none; transition: color 0.2s;">${service.name}</a>
        </h3>
        <div class="service-price-tag">
          ${priceHtml}
        </div>
        ${promoHtml}
        <p class="service-desc">${service.description || 'Chưa có mô tả chi tiết cho gói này.'}</p>
        <ul class="service-features-list">
          ${featuresHtml}
        </ul>
        
        <div style="margin-top: 0.5rem; margin-bottom: 1.25rem;">
          <a href="/chi-tiet.html?id=${service.id}" style="color: var(--primary); font-size: 0.85rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">
            Xem chi tiết bài viết <i class="fa-solid fa-arrow-right-long"></i>
          </a>
        </div>
        
        <button class="btn btn-select btn-block ${isSelected ? 'selected' : ''}" onclick="toggleSelectService('${service.id}')">
          <i class="fa-solid ${isSelected ? 'fa-square-check' : 'fa-circle-plus'}"></i> 
          ${isSelected ? 'Đã Chọn Gói' : 'Chọn Dịch Vụ này'}
        </button>
      </div>
    </div>
  `;
}

// HTML builder for combos
function renderComboCardHtml(combo) {
  const isSelected = selectedServices.some(s => s.id === combo.id);
  const imgUrl = combo.image_url || fallbackImages['gia-tien'];

  const chipsHtml = (combo.services || []).map(s => `
    <span class="combo-service-chip" style="background-color: #fff5f5; border: 1px solid #ffcdd2; color: #b71c1c; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 20px; font-weight: 600; display: inline-flex; align-items: center; gap: 0.25rem; white-space: nowrap;">
      <i class="fa-solid fa-circle-check" style="font-size: 0.75rem; color: var(--primary);"></i> ${s.name}
    </span>
  `).join('');

  const promoHtml = combo.promo_text
    ? `<div class="service-promo-tag" title="Ưu đãi combo" style="background-color: #ffebee; color: #c62828; border-left-color: #e53935;"><i class="fa-solid fa-gift"></i> ${combo.promo_text}</div>`
    : '';

  return `
    <div class="service-card combo-card animate-card" data-id="${combo.id}" style="border: 2px solid #ffcdd2; background: #fffcfc;">
      <span class="service-badge" style="background-color: var(--primary); color: #fff;">GÓI COMBO</span>
      <div class="service-img-wrapper" onclick="window.location.href='/chi-tiet.html?id=${combo.id}'" style="cursor: pointer;">
        <img class="service-img" src="${imgUrl}" alt="${combo.name}">
      </div>
      <div class="service-body">
        <h3 class="service-name" style="font-family: var(--font-serif); font-size: 1.25rem;">
          <a href="/chi-tiet.html?id=${combo.id}" style="color: inherit; text-decoration: none; transition: color 0.2s;">${combo.name}</a>
        </h3>
        <div class="service-price-tag">
          <span class="price-discounted">${formatVND(Number(combo.price))}</span>
          <span class="service-unit">/ trọn gói</span>
        </div>
        ${promoHtml}
        <p class="service-desc">${combo.description || 'Gói combo tiết kiệm đặc biệt từ Yến Nhi Wedding.'}</p>
        
        <div style="font-size: 0.8rem; font-weight: 700; text-transform: uppercase; color: var(--text-main); margin-bottom: 0.5rem; letter-spacing: 0.5px;">Bao gồm các dịch vụ:</div>
        
        <!-- Spacious and responsive services chips layout -->
        <div class="combo-services-chips-container" style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.25rem;">
          ${chipsHtml || '<span style="font-size:0.8rem; color:var(--text-muted);">Chưa liên kết dịch vụ.</span>'}
        </div>
        
        <div style="margin-top: 0.5rem; margin-bottom: 1.25rem;">
          <a href="/chi-tiet.html?id=${combo.id}" style="color: var(--primary); font-size: 0.85rem; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;">
            Xem chi tiết bài viết <i class="fa-solid fa-arrow-right-long"></i>
          </a>
        </div>
        
        <button class="btn btn-select btn-block ${isSelected ? 'selected' : ''}" onclick="toggleSelectService('${combo.id}')">
          <i class="fa-solid ${isSelected ? 'fa-square-check' : 'fa-circle-plus'}"></i> 
          ${isSelected ? 'Đã Chọn Combo' : 'Chọn Combo Này'}
        </button>
      </div>
    </div>
  `;
}

// Toggle Service or Combo Selection
window.toggleSelectService = function(itemId) {
  let service = allServices.find(s => s.id === itemId);
  let combo = allCombos.find(c => c.id === itemId);
  let item = service || combo;

  // Fallback: if arrays aren't populated (e.g. on chi-tiet.html), find item in selectedServices
  if (!item) {
    item = selectedServices.find(s => s.id === itemId);
  }
  if (!item) return;

  const index = selectedServices.findIndex(s => s.id === itemId);
  const wasAdded = index === -1;
  if (index > -1) {
    selectedServices.splice(index, 1);
  } else {
    selectedServices.push(item);
  }

  // Save selections
  saveSelections();
  
  // Refresh widgets
  updateSelectedServicesUI();
  updateFloatingWidgetUI();

  // Animate the header cart icon on add
  if (wasAdded) {
    animateCartBounce();
  }
  
  // Re-render matching cards on current layout
  const isCatalogPage = window.location.pathname.includes('san-pham.html');
  if (isCatalogPage) {
    const activeTab = document.querySelector('#catalogCategoryTabs .tab-btn.active');
    const catId = activeTab ? activeTab.getAttribute('data-category') : 'all';
    renderCatalog(catId);
  } else if (document.getElementById('categoryTabs')) {
    const activeTab = document.querySelector('#categoryTabs .tab-btn.active');
    const catId = activeTab ? activeTab.getAttribute('data-category') : 'all';
    renderHomepageServices(catId);
  }

  // Animate the clicked button itself for visual feedback
  const clickedCard = document.querySelector(`.service-card[data-id="${itemId}"]`);
  if (clickedCard) {
    const btn = clickedCard.querySelector('.btn-select');
    if (btn) {
      btn.classList.add('btn-select-pop');
      setTimeout(() => btn.classList.remove('btn-select-pop'), 400);
    }
  }
};

// Update Selection Preview in Booking Form
function updateSelectedServicesUI() {
  if (!selectedItemsBox) return;

  if (selectedServices.length === 0) {
    selectedItemsBox.innerHTML = `Chưa chọn dịch vụ nào. Hãy truy cập trang <a href="/san-pham.html" style="color: var(--primary); font-weight: 700;">Dịch Vụ & Combo</a> để chọn gói phù hợp.`;
    return;
  }

  let total = 0;
  let html = `<div style="display: flex; flex-wrap: wrap;">`;
  
  selectedServices.forEach(item => {
    total += Number(item.price);
    html += `
      <span class="selected-item-tag">
        ${item.name} (${formatVND(item.price)})
        <i class="fa-solid fa-circle-xmark" onclick="toggleSelectService('${item.id}')"></i>
      </span>`;
  });
  
  html += `</div>`;
  html += `
    <div class="total-estimate-box">
      <span>Tổng Chi Phí Ước Tính:</span>
      <span>${formatVND(total)}</span>
    </div>`;

  selectedItemsBox.innerHTML = html;
}

// Update Floating summary counts widget
function updateFloatingWidgetUI() {
  const widget = document.getElementById('bookingFloatWidget');
  const countSpan = document.getElementById('floatSelectedCount');
  if (!widget || !countSpan) return;

  if (selectedServices.length === 0) {
    widget.classList.add('hidden');
  } else {
    countSpan.textContent = selectedServices.length;
    widget.classList.remove('hidden');
  }
}

// Handle client-side booking submissions
if (bookingForm) {
  bookingForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (selectedServices.length === 0) {
      showFormError('Vui lòng chọn ít nhất một dịch vụ/gói cưới trước khi gửi.');
      return;
    }

    const name = document.getElementById('custName').value.trim();
    const phone = document.getElementById('custPhone').value.trim();
    const email = document.getElementById('custEmail').value.trim();
    const date = document.getElementById('eventDate').value;
    const address = document.getElementById('eventAddress').value.trim();
    const notes = document.getElementById('bookingNotes').value.trim();

    const submitBtn = document.getElementById('submitBtn');
    const origBtnText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang gửi yêu cầu...`;

    try {
      const bookingId = generateUUID();
      const bookingPayload = {
        id: bookingId,
        customer_name: name,
        customer_phone: phone,
        customer_email: email || null,
        event_date: date,
        event_address: address,
        notes: notes || null,
        services: selectedServices.map(s => s.id)
      };

      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingPayload)
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Lỗi lưu trữ đặt lịch.');
      }

      showFormSuccess('Gửi yêu cầu thành công! Yến Nhi Wedding sẽ liên hệ lại Zalo/Hotline của bạn sớm nhất.');
      
      // Clear selections & storage
      selectedServices = [];
      saveSelections();
      
      updateSelectedServicesUI();
      updateFloatingWidgetUI();
      bookingForm.reset();
    } catch (err) {
      console.error('Submit booking failed:', err);
      showFormError('Lỗi kết nối: ' + err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnText;
    }
  });
}

// UI Alert Messaging Helpers
function showError(message) {
  const container = servicesGrid || document.getElementById('catalogServicesGrid');
  if (container) {
    container.innerHTML = `
      <div class="loading-spinner" style="color: var(--primary); font-weight: 600; grid-column: 1/-1;">
        <i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
        ${message}
      </div>`;
  }
}

function showFormError(message) {
  if (formStatus) {
    formStatus.textContent = message;
    formStatus.className = 'form-status error';
    formStatus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    alert(message);
  }
}

function showFormSuccess(message) {
  if (formStatus) {
    formStatus.textContent = message;
    formStatus.className = 'form-status success';
    formStatus.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    alert(message);
  }
}

// Mini Cart Actions & Display Logic
function setupMiniCartEvents() {
  const headerCartBtn = document.getElementById('headerCartBtn');
  const miniCartPanel = document.getElementById('miniCartPanel');
  const closeMiniCartBtn = document.getElementById('closeMiniCartBtn');
  
  if (headerCartBtn && miniCartPanel) {
    headerCartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      miniCartPanel.classList.toggle('hidden');
      renderMiniCart();
    });
  }
  if (closeMiniCartBtn && miniCartPanel) {
    closeMiniCartBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      miniCartPanel.classList.add('hidden');
    });
  }
  
  // Close on click outside
  document.addEventListener('click', (e) => {
    if (miniCartPanel && !miniCartPanel.classList.contains('hidden')) {
      if (!miniCartPanel.contains(e.target) && !headerCartBtn.contains(e.target)) {
        miniCartPanel.classList.add('hidden');
      }
    }
  });
}

function renderMiniCart() {
  const headerCount = document.getElementById('headerCartCount');
  if (headerCount) {
    headerCount.textContent = selectedServices.length;
  }

  const listContainer = document.getElementById('miniCartItemsList');
  const totalText = document.getElementById('miniCartTotalText');
  if (!listContainer) return;

  if (selectedServices.length === 0) {
    listContainer.innerHTML = `<div style="text-align:center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem 0;">Giỏ hàng trống.</div>`;
    if (totalText) totalText.textContent = '0 đ';
    return;
  }

  let total = 0;
  let html = '';
  selectedServices.forEach(item => {
    total += Number(item.price);
    html += `
      <div class="mini-cart-item" style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px dashed var(--border-light); padding-bottom: 0.5rem; margin-bottom: 0.5rem; gap: 0.5rem;">
        <div style="display:flex; flex-direction:column; gap:0.2rem;">
          <span style="font-weight:600; color:var(--text-main); font-size:0.85rem; display:block; max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${item.name}</span>
          <span style="color:var(--primary); font-size:0.8rem; font-weight:700;">${formatVND(Number(item.price))}</span>
        </div>
        <button class="mini-cart-item-remove" onclick="event.stopPropagation(); toggleSelectService('${item.id}')" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1rem; padding: 0.25rem; transition:color 0.2s;" title="Xóa khỏi giỏ hàng">
          <i class="fa-solid fa-trash-can" style="font-size:0.85rem;"></i>
        </button>
      </div>
    `;
  });

  listContainer.innerHTML = html;
  if (totalText) {
    totalText.textContent = formatVND(total);
  }
}

// Animate the header cart icon with a bounce + flash effect
function animateCartBounce() {
  const cartBtn = document.getElementById('headerCartBtn');
  if (!cartBtn) return;
  cartBtn.classList.add('cart-bounce');
  setTimeout(() => cartBtn.classList.remove('cart-bounce'), 600);

  // Also show a mini toast notification
  showCartToast();
}

// Lightweight toast notification when items are added
function showCartToast() {
  let toast = document.getElementById('cartToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cartToast';
    toast.className = 'cart-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = `✓ Đã thêm vào giỏ hàng (${selectedServices.length} gói)`;
  toast.classList.remove('cart-toast-hide');
  toast.classList.add('cart-toast-show');
  setTimeout(() => {
    toast.classList.remove('cart-toast-show');
    toast.classList.add('cart-toast-hide');
  }, 2000);
}
