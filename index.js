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

// Serve frontend for all pages (fallback for SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`[YEN-NHI] Wedding Studio Web app running on port ${port}`);
});
