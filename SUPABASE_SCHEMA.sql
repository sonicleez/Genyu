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

-- 2.3 Create GOMMO_CREDENTIALS table (Gommo AI API credentials)
CREATE TABLE public.gommo_credentials (
    user_id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    domain TEXT NOT NULL,
    access_token TEXT NOT NULL,
    credits_ai INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for gommo_credentials
ALTER TABLE public.gommo_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own gommo credentials" ON public.gommo_credentials
  FOR ALL USING (auth.uid() = user_id);


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

-- ============================================================================
-- DOP LEARNING SYSTEM - RAG Vector Storage
-- Stores prompt learnings with embeddings for semantic search
-- ============================================================================

-- Enable pgvector extension (run once)
CREATE EXTENSION IF NOT EXISTS vector;

-- 8. DOP_PROMPT_RECORDS - Stores all generated prompts with embeddings
CREATE TABLE IF NOT EXISTS public.dop_prompt_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users ON DELETE CASCADE,
    
    -- Prompt data
    original_prompt TEXT NOT NULL,
    normalized_prompt TEXT NOT NULL,
    embedding vector(768), -- Gemini embedding dimension
    
    -- Generation context
    model_id TEXT NOT NULL,
    model_type TEXT NOT NULL, -- gemini, imagen, midjourney, etc.
    mode TEXT NOT NULL CHECK (mode IN ('character', 'scene')),
    aspect_ratio TEXT DEFAULT '16:9',
    
    -- Quality metrics
    quality_score REAL, -- 0.0-1.0 overall quality
    full_body_score REAL,
    background_score REAL,
    face_clarity_score REAL,
    match_score REAL,
    
    -- Status
    was_approved BOOLEAN DEFAULT false,
    was_retried BOOLEAN DEFAULT false,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    keywords TEXT[], -- Extracted keywords
    tags TEXT[] -- User-added tags
);

-- Index for fast vector similarity search
CREATE INDEX IF NOT EXISTS dop_prompt_embedding_idx 
ON public.dop_prompt_records 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Index for filtering
CREATE INDEX IF NOT EXISTS dop_prompt_model_idx ON public.dop_prompt_records(model_type, mode);
CREATE INDEX IF NOT EXISTS dop_prompt_user_idx ON public.dop_prompt_records(user_id);
CREATE INDEX IF NOT EXISTS dop_prompt_approved_idx ON public.dop_prompt_records(was_approved) WHERE was_approved = true;

-- 9. DOP_MODEL_LEARNINGS - Aggregated learnings per model type
CREATE TABLE IF NOT EXISTS public.dop_model_learnings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    model_type TEXT NOT NULL UNIQUE,
    
    -- Statistics
    total_generations INTEGER DEFAULT 0,
    approved_count INTEGER DEFAULT 0,
    avg_quality_score REAL DEFAULT 0,
    approval_rate REAL DEFAULT 0,
    
    -- Best practices (JSON)
    best_aspect_ratios JSONB DEFAULT '{}'::jsonb, -- {"9:16": 45, "16:9": 30}
    common_keywords JSONB DEFAULT '{}'::jsonb,    -- {"full body": 100, "8k": 80}
    successful_patterns TEXT[], -- Top 50 keywords
    
    -- Metadata
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 10. Vector similarity search function
CREATE OR REPLACE FUNCTION search_similar_prompts(
    query_embedding vector(768),
    match_model_type TEXT DEFAULT NULL,
    match_mode TEXT DEFAULT NULL,
    match_count INT DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    original_prompt TEXT,
    normalized_prompt TEXT,
    model_type TEXT,
    mode TEXT,
    quality_score REAL,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.original_prompt,
        r.normalized_prompt,
        r.model_type,
        r.mode,
        r.quality_score,
        1 - (r.embedding <=> query_embedding) AS similarity
    FROM public.dop_prompt_records r
    WHERE 
        r.was_approved = true
        AND r.quality_score >= 0.7
        AND (match_model_type IS NULL OR r.model_type = match_model_type)
        AND (match_mode IS NULL OR r.mode = match_mode)
        AND r.embedding IS NOT NULL
        AND 1 - (r.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY r.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- 11. Function to get best keywords for a model
CREATE OR REPLACE FUNCTION get_model_best_keywords(
    target_model_type TEXT,
    keyword_limit INT DEFAULT 20
)
RETURNS TABLE (keyword TEXT, frequency INT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        k.keyword::TEXT,
        k.frequency::INT
    FROM (
        SELECT 
            jsonb_object_keys(common_keywords) AS keyword,
            (common_keywords->>jsonb_object_keys(common_keywords))::INT AS frequency
        FROM public.dop_model_learnings
        WHERE model_type = target_model_type
    ) k
    ORDER BY k.frequency DESC
    LIMIT keyword_limit;
END;
$$;

-- RLS for DOP tables
ALTER TABLE public.dop_prompt_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dop_model_learnings ENABLE ROW LEVEL SECURITY;

-- Users can only see their own prompt records
CREATE POLICY "Users can manage own prompt records" ON public.dop_prompt_records
    FOR ALL USING (auth.uid() = user_id);

-- Model learnings are shared (read-only for users)
CREATE POLICY "Anyone can read model learnings" ON public.dop_model_learnings
    FOR SELECT USING (true);

-- Only system can update model learnings (via service role)
CREATE POLICY "Service role can update learnings" ON public.dop_model_learnings
    FOR ALL USING (auth.role() = 'service_role');
