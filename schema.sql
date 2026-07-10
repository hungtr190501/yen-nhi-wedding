-- Create dummy auth schema and role function if not exists (for standard Postgres compatibility)
CREATE SCHEMA IF NOT EXISTS auth;
CREATE OR REPLACE FUNCTION auth.role() RETURNS text AS $$
  SELECT 'authenticated'::text;
$$ LANGUAGE sql STABLE;

-- ==========================================================
-- 1. Create Tables
-- ==========================================================

-- Category Table
CREATE TABLE IF NOT EXISTS public.yn_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  image_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Services / Rentals Catalog Table
CREATE TABLE IF NOT EXISTS public.yn_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.yn_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  discount_price numeric, -- Optional discounted price
  unit text DEFAULT 'gói', -- 'gói', 'ngày', 'bộ', 'chiếc'
  image_url text,
  features text[] DEFAULT '{}'::text[], -- List of what is included
  is_featured boolean DEFAULT false,
  promo_text text, -- Optional promo text (e.g. "Tặng bia", "Free vận chuyển")
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Bookings Table (Customer Inquiries)
CREATE TABLE IF NOT EXISTS public.yn_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  customer_phone text NOT NULL,
  customer_email text,
  event_date date NOT NULL, -- Ngày làm lễ
  event_address text NOT NULL, -- Địa chỉ dựng rạp/gia tiên
  notes text, -- Yêu cầu riêng biệt
  status text DEFAULT 'pending', -- 'pending', 'confirmed', 'completed', 'cancelled'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Booking Line Items (Which packages/cars they rented)
CREATE TABLE IF NOT EXISTS public.yn_booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES public.yn_bookings(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.yn_services(id) ON DELETE RESTRICT,
  quantity integer DEFAULT 1,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================================
-- 2. Row Level Security (RLS) & Policies
-- ==========================================================
ALTER TABLE public.yn_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yn_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yn_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.yn_booking_items ENABLE ROW LEVEL SECURITY;

-- Public read permissions
DROP POLICY IF EXISTS "Public Read Categories" ON public.yn_categories;
CREATE POLICY "Public Read Categories" ON public.yn_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public Read Services" ON public.yn_services;
CREATE POLICY "Public Read Services" ON public.yn_services FOR SELECT USING (true);

-- Public insert permissions for booking/inquiries
DROP POLICY IF EXISTS "Public Insert Bookings" ON public.yn_bookings;
CREATE POLICY "Public Insert Bookings" ON public.yn_bookings FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Insert Booking Items" ON public.yn_booking_items;
CREATE POLICY "Public Insert Booking Items" ON public.yn_booking_items FOR INSERT WITH CHECK (true);

-- Admin read/modify rules (for DroidDeploy Headless CMS dashboard)
DROP POLICY IF EXISTS "Admin All Categories" ON public.yn_categories;
CREATE POLICY "Admin All Categories" ON public.yn_categories FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin All Services" ON public.yn_services;
CREATE POLICY "Admin All Services" ON public.yn_services FOR ALL USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin Read Bookings" ON public.yn_bookings;
CREATE POLICY "Admin Read Bookings" ON public.yn_bookings FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin All Booking Items" ON public.yn_booking_items;
CREATE POLICY "Admin All Booking Items" ON public.yn_booking_items FOR ALL USING (auth.role() = 'authenticated');


-- ==========================================================
-- 3. Seed Initial Categories and Services
-- ==========================================================

-- Insert Categories
INSERT INTO public.yn_categories (slug, name, description, image_url) VALUES
('gia-tien', 'Trang Trí Gia Tiên', 'Trang trí bàn thờ tổ tiên sang trọng, tôn kính, kết hợp nét truyền thống Việt Nam và thiết kế hiện đại.', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/cat_gia_tien.jpg')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.yn_categories (slug, name, description, image_url) VALUES
('rap-cuoi', 'Rạp Cưới & Cổng Hoa', 'Thiết kế rạp cưới ngoài trời sang trọng, cổng hoa lụa/hoa tươi đón khách được hoàn thiện tinh xảo.', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/cat_rap_cuoi.jpg')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.yn_categories (slug, name, description, image_url) VALUES
('mam-trap', 'Mâm Tráp Rồng Phượng', 'Bộ tráp ăn hỏi rồng phượng thủ công từ lá dứa, cau tươi, kết hoa quả nghệ thuật vô cùng hoành tráng.', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/cat_mam_trap.jpg')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;

INSERT INTO public.yn_categories (slug, name, description, image_url) VALUES
('xe-hoa', 'Thuê Xe Hoa & Xe 16 Chỗ', 'Cung cấp xe hoa đón dâu cao cấp được trang trí hoa lộng lẫy cùng xe 16 chỗ đưa đón hai họ chu đáo.', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/cat_xe_hoa.jpg')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description;


-- Insert Services/Packages
DO $$
DECLARE
  cat_giatien_id uuid;
  cat_rap_id uuid;
  cat_trap_id uuid;
  cat_xe_id uuid;
BEGIN
  -- Get IDs of inserted categories
  SELECT id INTO cat_giatien_id FROM public.yn_categories WHERE slug = 'gia-tien';
  SELECT id INTO cat_rap_id FROM public.yn_categories WHERE slug = 'rap-cuoi';
  SELECT id INTO cat_trap_id FROM public.yn_categories WHERE slug = 'mam-trap';
  SELECT id INTO cat_xe_id FROM public.yn_categories WHERE slug = 'xe-hoa';

  -- Clear existing services to prevent duplicates in seeding
  DELETE FROM public.yn_services WHERE category_id IN (cat_giatien_id, cat_rap_id, cat_trap_id, cat_xe_id);

  -- 1. Gia Tiên Packages
  INSERT INTO public.yn_services (category_id, name, description, price, unit, image_url, features, is_featured) VALUES
  (cat_giatien_id, 'Gói Gia Tiên Hồng Ngọc Đỏ Trắng', 'Trang trí gia tiên tông đỏ truyền thống kết hợp trắng tinh khôi mang lại sự thịnh vượng, may mắn.', 3500000, 'gói', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/serv_gia_tien_ruby.jpg', ARRAY['Bàn thờ gia tiên phủ vải cao cấp', 'Phông màn backdrop trang trí chữ Song Hỷ', 'Bộ lư đồng, cặp đèn cầy Long Phụng lớn', '2 bình hoa tươi bàn thờ', 'Bàn ký tên & Bàn hai họ dài cho 12 khách', '12 ghế tiffany trang trí nơ', '2 bộ tách trà gốm sứ cao cấp'], true),
  (cat_giatien_id, 'Gói Gia Tiên Cát Tường Cao Cấp', 'Gói gia tiên cao cấp kết hợp hoa sen và hoa hồng tươi rực rỡ mang nét đẹp quý phái ấm cúng.', 5500000, 'gói', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/serv_gia_tien_premium.jpg', ARRAY['Toàn bộ hoa trên phông nền & bàn họ đều là hoa tươi 100%', 'Bàn thờ gia tiên trang trí cổng hoa/phông hoa hoành tráng', 'Bộ bình trà sứ hoàng gia thắt nơ đỏ', '12 ghế Tiffany thắt nơ hoa tươi', 'Bảng chào đón khách (Welcome Board) thiết kế riêng', 'Tặng kèm nước suối in nhãn tên cô dâu chú rể'], false);

  -- 2. Rạp Cưới & Cổng Hoa Packages
  INSERT INTO public.yn_services (category_id, name, description, price, unit, image_url, features, is_featured) VALUES
  (cat_rap_id, 'Nhà Rạp Chiffon Đỏ Trắng (40 Khách)', 'Rạp cưới khung sắt bọc vải Chiffon lụa mềm mại, che mưa che nắng tốt và có tính thẩm mỹ rất cao.', 6000000, 'gói', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/serv_rap_chiffon.jpg', ARRAY['Rạp cưới kích thước tiêu chuẩn 4 bàn (40 ghế)', 'Trần rạp thả rèm voan xếp ly phối màu đỏ trắng', 'Hệ thống đèn Led vàng ấm áp treo trần', 'Cổng hoa lụa welcome thắt nơ rực rỡ', '4 bàn tròn kèm khăn phủ sang trọng', '40 ghế inox thắt nơ hoặc bọc vải đỏ'], true),
  (cat_rap_id, 'Cổng Hoa Rồng Phượng Nghệ Thuật', 'Cổng cưới được kết thủ công vô cùng tỉ mỉ bằng lá dừa, hoa cau, ớt đỏ và trái cây tươi hình Rồng Phượng uốn lượn sống động.', 4000000, 'bộ', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/serv_gate_dragon.jpg', ARRAY['Tạo hình Rồng và Phượng chầu uốn lượn tinh xảo', 'Sử dụng 100% lá dứa, cau tươi, lá dừa nước kết tay', 'Khung sắt chịu lực chắc chắn an toàn', 'Kèm bảng tên cô dâu chú rể cách điệu nghệ thuật'], false);

  -- 3. Mâm Tráp Quả Packages
  INSERT INTO public.yn_services (category_id, name, description, price, unit, image_url, features, is_featured) VALUES
  (cat_trap_id, 'Bộ Tráp Ăn Hỏi Rồng Phượng 7 Tráp', 'Bộ 7 mâm tráp truyền thống được kết hình Rồng Phượng sum vầy cực kỳ tinh xảo, đầy đặn lễ vật thượng hạng.', 6500000, 'bộ', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/serv_trap_7.jpg', ARRAY['Tráp Rồng Phượng kết trái cây tươi thượng hạng', 'Tráp Trầu Cau kết trái tròn đẹp kèm nhãn vàng chữ Hỷ', 'Tráp rượu Vodka/Champagne & Trà Ô Long thượng hạng', 'Tráp bánh Phu Thê truyền thống (ngôi sao hoặc hộp đỏ)', 'Tráp bánh cốm Hàng Than ngọt ngào', 'Tráp mứt hạt sen/hạt dưa thơm lừng', 'Tráp chè Tân Cương đặc sản'], true),
  (cat_trap_id, 'Bộ Tráp Truyền Thống Đơn Giản 5 Tráp', 'Bộ 5 mâm tráp đỏ sơn mài phủ khăn nhung đỏ truyền thống, lịch sự đầy đủ các lễ vật cơ bản cho lễ hỏi.', 3200000, 'bộ', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/serv_trap_5.jpg', ARRAY['Tráp Trầu Cau (60 hoặc 105 quả cau đẹp)', 'Tráp Trà & Rượu truyền thống', 'Tráp bánh phu thê xếp hình tháp', 'Tráp mứt sen kết tháp đỏ', 'Tráp hoa quả tươi ngũ quả'], false);

  -- 4. Xe Hoa & Xe 16 Chỗ
  INSERT INTO public.yn_services (category_id, name, description, price, unit, image_url, features, is_featured) VALUES
  (cat_xe_id, 'Thuê Xe Hoa VinFast VF8 Đỏ Mận', 'Dịch vụ thuê xe cưới VinFast VF8 màu đỏ rực rỡ, biểu tượng cho xe điện hiện đại, sang trọng và may mắn.', 3200000, 'chiếc', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/serv_car_vf8.jpg', ARRAY['Thuê trọn gói xe đón dâu trong 4 tiếng nội thành', 'Tài xế chuyên nghiệp lịch sự mặc vest đỏ/đen', 'Đã bao gồm hoa giả trang trí xe cao cấp tông đỏ trắng', 'Hỗ trợ thay hoa tươi theo yêu cầu (có phụ phí)'], true),
  (cat_xe_id, 'Thuê Xe 16 Chỗ Ford Transit Đưa Đón Họ', 'Dịch vụ cho thuê xe Transit 16 chỗ đời mới, máy lạnh êm ái để đưa đón đại gia đình nhà trai/nhà gái.', 2000000, 'ngày', 'https://atyvznsrzgnoaqfmvthp.supabase.co/storage/v1/object/public/uploads/serv_car_16.jpg', ARRAY['Thuê xe trọn gói trong ngày (dưới 100km)', 'Tài xế đón rước đúng giờ lịch sự cẩn thận', 'Xe đời mới ghế da êm ái, máy lạnh thổi mát rượi', 'Hỗ trợ dán chữ Song Hỷ trước xe'], false);

END $$;
