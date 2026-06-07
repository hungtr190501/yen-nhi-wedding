# Yến Nhi Wedding Studio - Web Portal 🌸

A gorgeous, responsive, red-and-white themed web portal for **Yến Nhi Wedding Studio**, specializing in premium wedding canopy rentals, ancestral altar decoration, traditional engagement trays, and luxury transport services.

This project is a **completely separate service** running on **Port 3001**, operating alongside the headless CMS API.

---

## 🚀 How to Run Locally

1. **Environment Configuration**:
   Create a `.env` file in the root of this folder containing:
   ```env
   PORT=3001
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI...
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start the Web Server**:
   ```bash
   npm start
   ```
   Open `http://localhost:3001` in your browser to view the customer-facing wedding portal.

---

## 🗄️ Database Setup & Migrations

Before launching, you must set up the database tables and feed the product catalog.

Copy the contents of **[schema.sql](file:///Users/mac/Desktop/CodeTime/Mobile/Android/Droid/yen-nhi-wedding/schema.sql)** and run them inside your **Supabase Project's SQL Editor**.

This query:
1. Creates the necessary tables (`yn_categories`, `yn_services`, `yn_bookings`, `yn_booking_items`).
2. Configures Row Level Security (RLS) rules allowing public visitors to read services and register booking reservations, while preventing unauthenticated write/read access to existing reservations.
3. Inserts initial high-quality products and descriptions (Vietnamese customs: Tráp Rồng Phượng, Gói Gia Tiên Đỏ Trắng, Rạp lụa Chiffon, Xe Hoa VinFast...).

---

## 🎨 Design System

- **Colors**: Red & White theme. Crimson Red (`#D32F2F`) representing luck/prosperity, and Soft Rose (`#FFEBEE` / `#FFFFFF`) representing romance and purity.
- **Typography**: Header tags use *Playfair Display* (classic romantic serif), and body text uses *Montserrat* (highly legible geometric sans-serif).
- **Features**:
  - Dynamic filtering categories (Tabs query Supabase directly).
  - Cost Calculator: Checking items instantly adds to the custom booking card and updates the estimated cost.
  - Responsive inquiry form submitting reservations directly to Supabase logs.
