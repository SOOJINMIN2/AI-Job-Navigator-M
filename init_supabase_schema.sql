-- ============================================================
-- AI Job Navigator - 전체 Supabase 스키마
-- ============================================================
-- 이 파일을 Supabase SQL Editor에서 처음부터 실행하세요.
-- 이미 DB가 있는 경우 아래 migration_patch.sql 을 대신 실행하세요.
-- ============================================================

-- Create users table (auth.users 미러링)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'consultant')),
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create consulting_requests table
-- ⚠️ student_id는 NULL 허용 (컨설턴트가 직접 생성한 케이스는 student_id 없음)
CREATE TABLE public.consulting_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES public.users(id) ON DELETE SET NULL,  -- NULL 허용 (컨설턴트 직접 생성)
  client_name TEXT,                                                  -- 컨설턴트가 입력하는 고객 이름
  target_company TEXT NOT NULL,
  job_description_url_or_text TEXT,
  cover_letter_text TEXT,                                            -- 자기소개서 텍스트
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.consulting_requests ENABLE ROW LEVEL SECURITY;

-- Create documents table
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.consulting_requests(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  parsed_text TEXT,
  document_type TEXT NOT NULL, -- 'resume', 'cover_letter', 'portfolio'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create ai_prompts table
CREATE TABLE public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'resume_review', 'mock_interview', etc.
  title TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ai_prompts ENABLE ROW LEVEL SECURITY;

-- Create results table
CREATE TABLE public.results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.consulting_requests(id) ON DELETE CASCADE,
  ai_draft TEXT,
  final_content TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS Policies
-- ============================================================

-- 1. users Policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Consultants can view all users" ON public.users FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
);

-- 2. consulting_requests Policies
CREATE POLICY "Students can manage own requests" ON public.consulting_requests
  FOR ALL USING (auth.uid() = student_id);

CREATE POLICY "Consultants can insert requests" ON public.consulting_requests
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );

CREATE POLICY "Consultants can view all requests" ON public.consulting_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );

CREATE POLICY "Consultants can update all requests" ON public.consulting_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );

CREATE POLICY "Consultants can delete requests" ON public.consulting_requests
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );

-- 3. documents Policies
CREATE POLICY "Students can view own documents" ON public.documents
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.consulting_requests
      WHERE id = request_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Consultants can manage all documents" ON public.documents
  FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );

-- 4. ai_prompts Policies
CREATE POLICY "Consultants can manage all ai_prompts" ON public.ai_prompts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );

-- 5. results Policies
CREATE POLICY "Students can view own results" ON public.results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.consulting_requests
      WHERE id = request_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Consultants can manage all results" ON public.results
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );

-- ============================================================
-- Helper Function: get_my_role()
-- 현재 로그인된 사용자의 역할을 반환 (consultant.ts, generate/route.ts 등에서 사용)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- Auth Trigger: 신규 가입 시 public.users에 자동 삽입
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- Storage: documents 버킷 정책
-- Supabase Dashboard > Storage에서 "documents" 버킷을 먼저 생성한 후
-- 아래 정책을 실행하세요.
-- ============================================================
-- INSERT (업로드): 로그인된 사용자 모두 가능
CREATE POLICY "Authenticated users can upload documents"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- SELECT (다운로드): 공개 접근 (public URL 사용)
CREATE POLICY "Public read access for documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'documents');

-- DELETE: 컨설턴트만 가능
CREATE POLICY "Consultants can delete documents"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'documents' AND
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );
