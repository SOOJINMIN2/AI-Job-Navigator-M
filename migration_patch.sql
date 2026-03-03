-- ============================================================
-- AI Job Navigator - 마이그레이션 패치
-- 이미 Supabase DB가 생성된 경우 이 파일만 실행하세요.
-- Supabase SQL Editor에서 실행: https://supabase.com/dashboard
-- ============================================================

-- 1. consulting_requests 테이블에 누락된 컬럼 추가
ALTER TABLE public.consulting_requests
  ALTER COLUMN student_id DROP NOT NULL;  -- NULL 허용 (컨설턴트 직접 생성 케이스)

ALTER TABLE public.consulting_requests
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS cover_letter_text TEXT;

-- 2. results 테이블에 created_at 추가 (없는 경우)
ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. get_my_role() 함수 생성 (없는 경우)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. 컨설턴트 INSERT/DELETE 정책 추가 (없는 경우)
DO $$
BEGIN
  -- Consultants can insert requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consulting_requests'
    AND policyname = 'Consultants can insert requests'
  ) THEN
    CREATE POLICY "Consultants can insert requests" ON public.consulting_requests
      FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
      );
  END IF;

  -- Consultants can delete requests
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'consulting_requests'
    AND policyname = 'Consultants can delete requests'
  ) THEN
    CREATE POLICY "Consultants can delete requests" ON public.consulting_requests
      FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
      );
  END IF;

  -- Consultants can manage all documents (기존 SELECT-only 정책 업그레이드)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'documents'
    AND policyname = 'Consultants can manage all documents'
  ) THEN
    CREATE POLICY "Consultants can manage all documents" ON public.documents
      USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
      );
  END IF;
END $$;

-- 5. Storage 정책 (documents 버킷이 존재하는 경우)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'documents') THEN
    -- 업로드 정책
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'objects'
      AND policyname = 'Authenticated users can upload documents'
    ) THEN
      CREATE POLICY "Authenticated users can upload documents"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');
    END IF;

    -- 읽기 정책
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE tablename = 'objects'
      AND policyname = 'Public read access for documents'
    ) THEN
      CREATE POLICY "Public read access for documents"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'documents');
    END IF;
  END IF;
END $$;

-- 확인: 변경사항 조회
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'consulting_requests'
ORDER BY ordinal_position;
