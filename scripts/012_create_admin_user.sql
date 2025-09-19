-- Create the default admin user
-- This script creates the admin user that will be used to manage the system

-- First, let's create a function to create the admin user
CREATE OR REPLACE FUNCTION create_admin_user(
  admin_email TEXT,
  admin_password TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Create the auth user
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    admin_email,
    crypt(admin_password, gen_salt('bf')),
    NOW(),
    NOW(),
    NOW(),
    '{"provider": "email", "providers": ["email"]}',
    '{}',
    NOW(),
    NOW(),
    '',
    '',
    '',
    ''
  ) RETURNING id INTO admin_user_id;

  -- Create the user profile
  INSERT INTO public.user_profiles (
    id,
    email,
    role,
    permissions,
    created_by
  ) VALUES (
    admin_user_id,
    admin_email,
    'admin',
    '{"all": true}',
    admin_user_id
  );

  RETURN admin_user_id;
END;
$$;

-- Create the admin user with default credentials
-- Email: admin@hzshop.com
-- Password: admin123!
SELECT create_admin_user('admin@hzshop.com', 'admin123!');

-- Clean up the function
DROP FUNCTION create_admin_user(TEXT, TEXT);
