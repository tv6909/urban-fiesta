-- Add RLS policies to existing tables based on user roles

-- Categories table - Sellers and Admins can manage, Viewers can only read
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view categories
CREATE POLICY "authenticated_users_can_view_categories" ON public.categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins and sellers can insert categories
CREATE POLICY "admins_sellers_can_insert_categories" ON public.categories
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Only admins and sellers can update categories
CREATE POLICY "admins_sellers_can_update_categories" ON public.categories
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Only admins can delete categories
CREATE POLICY "admins_can_delete_categories" ON public.categories
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Products table - Similar permissions as categories
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view active products
CREATE POLICY "authenticated_users_can_view_products" ON public.products
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only admins and sellers can insert products
CREATE POLICY "admins_sellers_can_insert_products" ON public.products
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Only admins and sellers can update products
CREATE POLICY "admins_sellers_can_update_products" ON public.products
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Only admins can delete products
CREATE POLICY "admins_can_delete_products" ON public.products
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Shopkeepers table - Only admins and sellers can manage
ALTER TABLE public.shopkeepers ENABLE ROW LEVEL SECURITY;

-- Allow admins and sellers to view shopkeepers
CREATE POLICY "admins_sellers_can_view_shopkeepers" ON public.shopkeepers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Only admins and sellers can insert shopkeepers
CREATE POLICY "admins_sellers_can_insert_shopkeepers" ON public.shopkeepers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Only admins and sellers can update shopkeepers
CREATE POLICY "admins_sellers_can_update_shopkeepers" ON public.shopkeepers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Only admins can delete shopkeepers
CREATE POLICY "admins_can_delete_shopkeepers" ON public.shopkeepers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Cart and cart_items - All authenticated users can manage their own carts
ALTER TABLE public.cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to manage carts (session-based)
CREATE POLICY "authenticated_users_can_manage_carts" ON public.cart
  FOR ALL USING (auth.uid() IS NOT NULL);

CREATE POLICY "authenticated_users_can_manage_cart_items" ON public.cart_items
  FOR ALL USING (auth.uid() IS NOT NULL);

-- Receipts and related tables - Only admins and sellers can manage
ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Receipts policies
CREATE POLICY "admins_sellers_can_manage_receipts" ON public.receipts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

CREATE POLICY "admins_sellers_can_manage_receipt_items" ON public.receipt_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Returns policies
CREATE POLICY "admins_sellers_can_manage_returns" ON public.returns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

CREATE POLICY "admins_sellers_can_manage_return_items" ON public.return_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Payment history policies
CREATE POLICY "admins_sellers_can_manage_payment_history" ON public.payment_history
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Stock movements policies
CREATE POLICY "admins_sellers_can_manage_stock_movements" ON public.stock_movements
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'seller')
    )
  );

-- Settings table - Only admins can manage
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_can_manage_settings" ON public.settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
