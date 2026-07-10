require('dotenv').config();
const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3001;

// Setup database pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('[DATABASE] Error connecting to database:', err.message);
  } else {
    console.log('[DATABASE] Connected to database successfully at:', res.rows[0].now);
  }
});

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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
