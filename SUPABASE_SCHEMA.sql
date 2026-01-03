CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  subscription_expires_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure columns exist if table was already there
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMP WITH TIME ZONE;

-- Usage statistics for tracking image generation per user
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS usage_stats JSONB DEFAULT '{
  "1K": 0,
  "2K": 0,
  "4K": 0,
  "total": 0,
  "scenes": 0,
  "characters": 0,
  "products": 0,
  "concepts": 0,
  "textTokens": 0,
  "promptTokens": 0,
  "candidateTokens": 0,
  "textCalls": 0
}'::jsonb;

-- 2. Create USER_API_KEYS table (User-provided keys)
CREATE TABLE public.user_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL, -- e.g., 'gemini', 'openai'
  encrypted_key TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(user_id, provider)  -- Required for upsert on conflict
);

-- Add unique constraint if table already exists
CREATE UNIQUE INDEX IF NOT EXISTS user_api_keys_user_provider_unique 
ON public.user_api_keys(user_id, provider);

-- 2.1 Create SYSTEM_API_KEYS table (Admin-managed keys)
CREATE TABLE public.system_api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key_name TEXT NOT NULL,              -- Name for identification (e.g., "main_key", "backup_key")
  encrypted_key TEXT NOT NULL,          -- Encrypted API key
  provider TEXT DEFAULT 'gemini',       -- gemini, openai, etc.
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,        -- Track usage
  daily_limit INTEGER DEFAULT 1000,     -- Daily limit per key
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2.2 Add system_key_id to profiles for admin-assigned keys
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS system_key_id UUID REFERENCES public.system_api_keys(id);


-- 3. Create PROJECTS table (For cloud sync)
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  project_data JSONB DEFAULT '{}'::jsonb, -- Stores scenes, characters, products
  is_archived BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 5. Policies: Users can only see/edit their own data
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can manage own API keys" ON public.user_api_keys 
  FOR ALL USING (auth.uid() = user_id);

-- System API Keys: Users can only SELECT keys assigned to them
CREATE POLICY "Users can view assigned system key" ON public.system_api_keys 
  FOR SELECT USING (
    id IN (SELECT system_key_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can manage own projects" ON public.projects 
  FOR ALL USING (auth.uid() = user_id);

-- 6. Trigger to create profile on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, subscription_tier)
  VALUES (
    new.id, 
    COALESCE(new.email, new.raw_user_meta_data->>'email', ''),
    COALESCE(new.raw_user_meta_data->>'full_name', ''), 
    'free'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-enable trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- SCRIPT TO BACKFILL EXISTING EMAILS (Run this once)
-- UPDATE public.profiles p
-- SET email = u.email
-- FROM auth.users u
-- WHERE p.id = u.id AND (p.email IS NULL OR p.email = '');

-- 7. STORAGE SETUP (Manual or via SQL)
-- Run these to create the bucket and set permissions
INSERT INTO storage.buckets (id, name, public) 
VALUES ('project-assets', 'project-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Objects Policies
CREATE POLICY "Public Access to Assets" ON storage.objects 
  FOR SELECT USING (bucket_id = 'project-assets');

CREATE POLICY "Users can upload their own assets" ON storage.objects 
  FOR INSERT WITH CHECK (
    bucket_id = 'project-assets' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update/delete their own assets" ON storage.objects 
  FOR ALL USING (
    bucket_id = 'project-assets' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );
