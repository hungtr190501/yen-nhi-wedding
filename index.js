require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const multer = require('multer');

const app = express();
const port = process.env.PORT || 3001;

// Setup uploads folder
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer disk storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'service-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// Setup database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.query('SELECT NOW()', async (err, res) => {
  if (err) {
    console.error('[DATABASE] Error connecting to database:', err.message);
  } else {
    console.log('[DATABASE] Connected to database successfully at:', res.rows[0].now);
    // Run schema migrations to add promotion/discount columns and settings table
    try {
      await pool.query('ALTER TABLE public.yn_services ADD COLUMN IF NOT EXISTS discount_price numeric;');
      await pool.query('ALTER TABLE public.yn_services ADD COLUMN IF NOT EXISTS promo_text text;');
      
      // Create settings table
      await pool.query(`
        CREATE TABLE IF NOT EXISTS public.yn_settings (
          key text PRIMARY KEY,
          value text NOT NULL
        );
      `);
      
      // Seed default settings if empty
      const checkSettings = await pool.query('SELECT COUNT(*) FROM public.yn_settings');
      if (Number(checkSettings.rows[0].count) === 0) {
        const seedQuery = `
          INSERT INTO public.yn_settings (key, value) VALUES
          ('site_name', 'Yến Nhi Wedding'),
          ('hotline', '0909.123.456 (Zalo)'),
          ('address', 'Kiost số 17 Thống Nhất, Phường Phú Thọ Hoà, TP. Hồ Chí Minh'),
          ('email', 'yennhiwedding@gmail.com'),
          ('working_hours', '07:00 - 21:00 (Tất cả các ngày trong tuần)'),
          ('footer_desc', 'Thương hiệu trang trí cưới hỏi trọn gói hàng đầu. Tận tâm - Uy tín - Tinh xảo trong từng khâu thiết kế phông màn gia tiên, cổng hoa cưới hỏi.'),
          ('footer_copyright', '© 2026 Yến Nhi Wedding Studio. Thiết kế và phát triển trọn gói với màu đỏ may mắn.'),
          ('map_iframe', 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3919.467406969566!2d106.63413817579737!3d10.775850959211364!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31752ea2db74a3f5%3A0xe54e3d37a85dfcf2!2zMTcgVGjhu5FuZyBOaOG6pXQsIFBow7ogVGjhu40gSG_DoCwgVMOibiBQaMO6LCBI4buTIENow60gTWluaCwgVmnhu4d0IE5hbQ!5e0!3m2!1svi!2s!4v1720603700000!5m2!1svi!2s');
        `;
        await pool.query(seedQuery);
        console.log('[DATABASE] Seeded default website settings.');
      }
      
      console.log('[DATABASE] Database schema migrations completed successfully.');
    } catch (migrationErr) {
      console.error('[DATABASE] Migration error:', migrationErr.message);
    }
  }
});

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadsDir));

// Fallback config route (for backwards compatibility/placeholder)
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: '',
    supabaseAnonKey: ''
  });
});

// Get all categories
app.get('/api/categories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.yn_categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all services
app.get('/api/services', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.yn_services ORDER BY is_featured DESC, price ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching services:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create booking
app.post('/api/bookings', async (req, res) => {
  const { id, customer_name, customer_phone, customer_email, event_date, event_address, notes, services } = req.body;
  if (!customer_name || !customer_phone || !event_date || !event_address) {
    return res.status(400).json({ error: 'Thiếu thông tin đặt lịch bắt buộc.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Insert into yn_bookings
    const bookingQuery = `
      INSERT INTO public.yn_bookings (id, customer_name, customer_phone, customer_email, event_date, event_address, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    await client.query(bookingQuery, [id, customer_name, customer_phone, customer_email, event_date, event_address, notes]);

    // Insert into yn_booking_items
    if (services && services.length > 0) {
      const itemQuery = `
        INSERT INTO public.yn_booking_items (booking_id, service_id, quantity)
        VALUES ($1, $2, 1)
      `;
      for (const serviceId of services) {
        await client.query(itemQuery, [id, serviceId]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, bookingId: id });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Failed to create booking:', err);
    res.status(500).json({ error: 'Không thể tạo booking: ' + err.message });
  } finally {
    client.release();
  }
});

// Admin Authentication Middleware
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const adminAuth = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (token === ADMIN_PASSWORD) {
    next();
  } else {
    res.status(401).json({ error: 'Không có quyền truy cập.' });
  }
};

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: ADMIN_PASSWORD });
  } else {
    res.status(401).json({ error: 'Mật khẩu không chính xác.' });
  }
});

// Admin Get all Bookings with items
app.get('/api/admin/bookings', adminAuth, async (req, res) => {
  try {
    const query = `
      SELECT 
        b.id, b.customer_name, b.customer_phone, b.customer_email, b.event_date, b.event_address, b.notes, b.status, b.created_at,
        COALESCE(
          json_agg(
            json_build_object(
              'id', s.id,
              'name', s.name,
              'price', s.price,
              'unit', s.unit
            )
          ) FILTER (WHERE s.id IS NOT NULL),
          '[]'::json
        ) AS services
      FROM public.yn_bookings b
      LEFT JOIN public.yn_booking_items bi ON b.id = bi.booking_id
      LEFT JOIN public.yn_services s ON bi.service_id = s.id
      GROUP BY b.id
      ORDER BY b.created_at DESC;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin bookings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin Update booking status
app.patch('/api/admin/bookings/:id/status', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Trạng thái không hợp lệ.' });
  }
  try {
    const result = await pool.query(
      'UPDATE public.yn_bookings SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy booking.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating booking status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin Delete booking
app.delete('/api/admin/bookings/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM public.yn_bookings WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy booking.' });
    }
    res.json({ success: true, message: 'Đã xóa booking thành công.' });
  } catch (err) {
    console.error('Error deleting booking:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin upload image endpoint
app.post('/api/admin/upload', adminAuth, (req, res) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('[UPLOAD ERROR]', err);
      return res.status(500).json({ error: 'Không thể upload ảnh: ' + err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Không có file nào được tải lên.' });
    }
    res.json({ success: true, url: `/uploads/${req.file.filename}` });
  });
});

// Admin Create Service
app.post('/api/admin/services', adminAuth, async (req, res) => {
  const { category_id, name, description, price, discount_price, unit, image_url, features, is_featured, promo_text } = req.body;
  if (!name || !price || !category_id) {
    return res.status(400).json({ error: 'Thiếu thông tin dịch vụ bắt buộc.' });
  }
  try {
    const query = `
      INSERT INTO public.yn_services (category_id, name, description, price, discount_price, unit, image_url, features, is_featured, promo_text)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const result = await pool.query(query, [
      category_id,
      name,
      description || null,
      price,
      discount_price || null,
      unit || 'gói',
      image_url || null,
      features || [],
      !!is_featured,
      promo_text || null
    ]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error creating service:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin Update Service
app.patch('/api/admin/services/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { category_id, name, description, price, discount_price, unit, image_url, features, is_featured, promo_text } = req.body;
  if (!name || !price || !category_id) {
    return res.status(400).json({ error: 'Thiếu thông tin dịch vụ bắt buộc.' });
  }
  try {
    const query = `
      UPDATE public.yn_services
      SET category_id = $1, name = $2, description = $3, price = $4, discount_price = $5, unit = $6, image_url = $7, features = $8, is_featured = $9, promo_text = $10
      WHERE id = $11
      RETURNING *;
    `;
    const result = await pool.query(query, [
      category_id,
      name,
      description || null,
      price,
      discount_price || null,
      unit || 'gói',
      image_url || null,
      features || [],
      !!is_featured,
      promo_text || null,
      id
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy dịch vụ.' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating service:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin Delete Service
app.delete('/api/admin/services/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM public.yn_services WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy dịch vụ.' });
    }
    res.json({ success: true, message: 'Đã xóa dịch vụ thành công.' });
  } catch (err) {
    console.error('Error deleting service:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get website settings
app.get('/api/settings', async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM public.yn_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json(settings);
  } catch (err) {
    console.error('Error fetching settings:', err);
    res.status(500).json({ error: err.message });
  }
});

// Update website settings
app.patch('/api/admin/settings', adminAuth, async (req, res) => {
  const settings = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(settings)) {
      await client.query(
        'INSERT INTO public.yn_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value',
        [key, value]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, message: 'Cập nhật cấu hình thành công.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating settings:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Serve Admin Panel Frontend Page explicitly
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Serve frontend for all pages (fallback for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`[YEN-NHI] Wedding Studio Web app running on port ${port}`);
});
