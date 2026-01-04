-- =============================================
-- USER API KEYS TABLE + ADMIN POLICIES
-- =============================================

-- 1. Create user_api_keys table
CREATE TABLE IF NOT EXISTS user_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    key_type TEXT NOT NULL, -- 'gemini', 'gommo', 'openai', etc.
    key_value TEXT NOT NULL, -- Encrypted or raw key
    key_preview TEXT, -- First 8 + last 4 chars for display
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, key_type)
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_user_api_keys_user ON user_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_user_api_keys_type ON user_api_keys(key_type);

-- 3. Enable RLS
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Users can view their own keys
DROP POLICY IF EXISTS "Users can view own keys" ON user_api_keys;
CREATE POLICY "Users can view own keys" ON user_api_keys
    FOR SELECT USING (auth.uid() = user_id OR is_admin());

-- Users can insert their own keys
DROP POLICY IF EXISTS "Users can insert own keys" ON user_api_keys;
CREATE POLICY "Users can insert own keys" ON user_api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id OR is_admin());

-- Users can update their own keys
DROP POLICY IF EXISTS "Users can update own keys" ON user_api_keys;
CREATE POLICY "Users can update own keys" ON user_api_keys
    FOR UPDATE USING (auth.uid() = user_id OR is_admin());

-- Users can delete their own keys, admins can delete any
DROP POLICY IF EXISTS "Users can delete own keys" ON user_api_keys;
CREATE POLICY "Users can delete own keys" ON user_api_keys
    FOR DELETE USING (auth.uid() = user_id OR is_admin());

-- 5. View for admin to see key summary per user
CREATE OR REPLACE VIEW user_key_summary AS
SELECT 
    p.id as user_id,
    p.email,
    COALESCE(
        (SELECT COUNT(*) FROM user_api_keys WHERE user_id = p.id),
        0
    ) as total_keys,
    COALESCE(
        (SELECT array_agg(key_type) FROM user_api_keys WHERE user_id = p.id),
        '{}'::text[]
    ) as key_types
FROM profiles p;

-- Done!
SELECT 'User API Keys table created successfully!' AS status;
