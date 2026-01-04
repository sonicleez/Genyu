-- =============================================
-- COMPLETE ADMIN SETUP - RUN THIS FIRST!
-- This fixes all permission and column issues
-- =============================================

-- 1. Ensure profiles table has all needed columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Create index for role lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- 2. Create is_admin function (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Set your admin users
UPDATE profiles SET role = 'admin' WHERE email IN (
    'admin@example.com',
    'dangle@renoschuyler.com',
    'xvirion@gmail.com'
);

-- 4. Drop old restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- 5. Create new policies that allow admins to see all
CREATE POLICY "Users can view own profile or admins can view all" ON profiles
    FOR SELECT USING (
        auth.uid() = id 
        OR is_admin()
    );

CREATE POLICY "Users can update own profile or admins can update all" ON profiles
    FOR UPDATE USING (
        auth.uid() = id 
        OR is_admin()
    );

CREATE POLICY "Users can insert own profile" ON profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- 6. Fix user_global_stats policies  
DROP POLICY IF EXISTS "Users can view own stats" ON user_global_stats;
DROP POLICY IF EXISTS "Admins can view all stats" ON user_global_stats;

CREATE POLICY "Users can view stats or admins can view all" ON user_global_stats
    FOR SELECT USING (
        auth.uid() = user_id 
        OR is_admin()
    );

-- 7. Fix generated_images_history policies
DROP POLICY IF EXISTS "Users can view own images" ON generated_images_history;
DROP POLICY IF EXISTS "Admins can view all images" ON generated_images_history;

CREATE POLICY "Users can view images or admins can view all" ON generated_images_history
    FOR SELECT USING (
        auth.uid() = user_id 
        OR is_admin()
    );

-- 8. Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_global_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_images_history ENABLE ROW LEVEL SECURITY;

-- 9. Verify setup
SELECT 'Checking admin users:' AS status;
SELECT id, email, role FROM profiles WHERE role = 'admin';

SELECT 'Testing is_admin function:' AS status;
SELECT is_admin() as current_user_is_admin;

SELECT 'Setup complete!' AS status;
