-- =============================================
-- FIX GOMMO_CREDENTIALS RLS FOR ADMIN ACCESS
-- Run after SUPABASE_ADMIN_SIMPLE.sql
-- =============================================

-- Drop existing policies on gommo_credentials
DO $$ 
DECLARE
    policy_name TEXT;
BEGIN
    FOR policy_name IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'gommo_credentials'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON gommo_credentials', policy_name);
    END LOOP;
END $$;

-- Enable RLS
ALTER TABLE gommo_credentials ENABLE ROW LEVEL SECURITY;

-- Create admin-friendly policies
CREATE POLICY "gommo_select" ON gommo_credentials FOR SELECT 
    USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "gommo_insert" ON gommo_credentials FOR INSERT 
    WITH CHECK (auth.uid() = user_id OR is_admin());

CREATE POLICY "gommo_update" ON gommo_credentials FOR UPDATE 
    USING (auth.uid() = user_id OR is_admin());

CREATE POLICY "gommo_delete" ON gommo_credentials FOR DELETE 
    USING (auth.uid() = user_id OR is_admin());

-- Verify
SELECT 'Gommo credentials policies updated!' as status;
SELECT * FROM gommo_credentials LIMIT 5;
