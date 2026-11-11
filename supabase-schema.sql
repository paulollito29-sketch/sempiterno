-- ==============================================================================
-- SEMPITERNO - SUPABASE DATABASE & REALTIME SETUP
-- ==============================================================================
-- Instrucciones:
-- 1. Ve a tu proyecto en https://supabase.com
-- 2. En el menú lateral izquierdo, haz clic en "SQL Editor"
-- 3. Pega todo el contenido de este archivo y haz clic en "Run" (abajo a la derecha)
-- 4. ¡Listo! Tu base de datos y sincronización en tiempo real quedarán activadas.
-- ==============================================================================

-- 1. TABLA: Ajustes de la Pareja (Contador, Nombres, etc.)
CREATE TABLE IF NOT EXISTS public.sempiterno_settings (
  id TEXT PRIMARY KEY DEFAULT 'couple_main',
  start_date TEXT NOT NULL DEFAULT '2026-06-04T00:00:00',
  partner1 JSONB DEFAULT '{"name": "Paulo", "nickname": "Gigio", "role": "Gigio", "avatarUrl": "/assets/gigio-rosita.jpg"}'::jsonb,
  partner2 JSONB DEFAULT '{"name": "Alexandra", "nickname": "Rosita", "role": "Rosita", "avatarUrl": "/assets/gigio-rosita.jpg"}'::jsonb,
  rating_style TEXT DEFAULT 'cheese',
  dark_mode BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fila inicial de ajustes si no existe
INSERT INTO public.sempiterno_settings (id, start_date)
VALUES ('couple_main', '2026-06-04T00:00:00')
ON CONFLICT (id) DO NOTHING;

-- 2. TABLA: Recuerdos (El Archivo)
CREATE TABLE IF NOT EXISTS public.sempiterno_memories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  photos JSONB DEFAULT '[]'::jsonb,
  location TEXT DEFAULT '',
  perspective_gigio TEXT DEFAULT '',
  perspective_rosita TEXT DEFAULT '',
  rating INTEGER DEFAULT 5,
  song_title TEXT,
  song_url TEXT,
  tags JSONB DEFAULT '[]'::jsonb,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA: Planes y Bucket List (Por Vivir)
CREATE TABLE IF NOT EXISTS public.sempiterno_plans (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT NOT NULL,
  budget TEXT DEFAULT '$$',
  status TEXT NOT NULL,
  scheduled_date TEXT,
  scheduled_time TEXT,
  location TEXT,
  dress_code TEXT,
  surprise_note TEXT,
  tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA: Directorio de Lugares (Nuestros Rincones)
CREATE TABLE IF NOT EXISTS public.sempiterno_places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL,
  zone TEXT DEFAULT '',
  what_we_ordered TEXT,
  review TEXT,
  would_return TEXT DEFAULT '¡Sí o sí!',
  rating INTEGER,
  price_range TEXT DEFAULT '$$',
  image_url TEXT,
  google_maps_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLA: Cápsulas del Tiempo (Cartas al Futuro)
CREATE TABLE IF NOT EXISTS public.sempiterno_capsules (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  unlock_date TEXT NOT NULL,
  secret_message TEXT NOT NULL,
  photos JSONB DEFAULT '[]'::jsonb,
  hint TEXT,
  is_custom_opened BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- SEGURIDAD: POLÍTICAS RLS (Row Level Security) Y PRIVILEGIOS
-- ------------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;

ALTER TABLE public.sempiterno_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sempiterno_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sempiterno_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sempiterno_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sempiterno_capsules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acceso público sempiterno_settings" ON public.sempiterno_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso público sempiterno_memories" ON public.sempiterno_memories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso público sempiterno_plans" ON public.sempiterno_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso público sempiterno_places" ON public.sempiterno_places FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acceso público sempiterno_capsules" ON public.sempiterno_capsules FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------------------------
-- REALTIME: TRANSMITIR CAMBIOS EN TIEMPO REAL
-- ------------------------------------------------------------------------------
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    public.sempiterno_settings,
    public.sempiterno_memories,
    public.sempiterno_plans,
    public.sempiterno_places,
    public.sempiterno_capsules;
COMMIT;

-- ------------------------------------------------------------------------------
-- ALMACENAMIENTO DE FOTOS (Storage Bucket)
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('sempiterno-photos', 'sempiterno-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

CREATE POLICY "Fotos públicas de Sempiterno lectura"
ON storage.objects FOR SELECT
USING (bucket_id = 'sempiterno-photos');

CREATE POLICY "Fotos públicas de Sempiterno subida"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'sempiterno-photos');

CREATE POLICY "Fotos públicas de Sempiterno actualización"
ON storage.objects FOR UPDATE
USING (bucket_id = 'sempiterno-photos');
