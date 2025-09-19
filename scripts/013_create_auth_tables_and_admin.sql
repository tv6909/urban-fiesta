-- Create user_profiles table for role-based access control
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'seller', 'viewer')),
  permissions JSONB DEFAULT '{}',
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on user_profiles
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can view their own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles" ON user_profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert profiles" ON user_profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update profiles" ON user_profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create cart table if it doesn't exist
CREATE TABLE IF NOT EXISTS cart (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cart_items table if it doesn't exist  
CREATE TABLE IF NOT EXISTS cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID REFERENCES cart(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on cart tables
ALTER TABLE cart ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for cart tables
CREATE POLICY "Allow all operations on cart" ON cart FOR ALL USING (true);
CREATE POLICY "Allow all operations on cart_items" ON cart_items FOR ALL USING (true);

-- Create function to handle user profile creation on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, permissions)
  VALUES (
    NEW.id,
    NEW.email,
    'viewer', -- Default role
    '{}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to automatically create user profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Insert admin user profile manually (since the user should already exist in auth.users)
-- First, let's check if admin user exists and create profile
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Try to find existing admin user
  SELECT id INTO admin_user_id 
  FROM auth.users 
  WHERE email = 'admin@hzshop.com' 
  LIMIT 1;
  
  -- If admin user exists, create/update profile
  IF admin_user_id IS NOT NULL THEN
    INSERT INTO public.user_profiles (id, email, role, permissions, created_by)
    VALUES (
      admin_user_id,
      'admin@hzshop.com',
      'admin',
      '{"all": true}'::jsonb,
      admin_user_id
    )
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      permissions = '{"all": true}'::jsonb,
      updated_at = NOW();
      
    RAISE NOTICE 'Admin profile created/updated for existing user';
  ELSE
    RAISE NOTICE 'Admin user not found in auth.users - please create manually';
  END IF;
END $$;
