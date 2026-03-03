-- ============================================================
-- AI Job Navigator - RLS Infinite Recursion 패치 스크립트
-- ============================================================
-- 이 스크립트를 복사하여 Supabase Dashboard의 SQL Editor에 붙여넣고 "Run"을 클릭하세요.
-- 이 패치는 users 테이블 조회 시 발생하는 "infinite recursion" 오류를 해결합니다.

-- 1. 기존에 무한 루프를 유발하던 정책을 삭제합니다.
DROP POLICY IF EXISTS "Consultants can view all users" ON public.users;

-- 2. RLS 정책을 우회하여(SECURITY DEFINER) 사용자의 역할만 확인하는 안전한 함수를 생성합니다.
CREATE OR REPLACE FUNCTION public.check_is_consultant()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  -- 현재 로그인한 사용자의 auth.uid()를 기준으로 역할을 조회
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  RETURN user_role = 'consultant';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. 새로 만든 안전한 함수를 사용하여 정책을 다시 생성합니다.
CREATE POLICY "Consultants can view all users" ON public.users
  FOR SELECT USING (public.check_is_consultant());

-- ============================================================
-- (선택) 다른 테이블들의 정책도 향후 무한 루프 위험을 줄이기 위해 이 함수를 사용하도록 수정합니다
-- ============================================================

-- consulting_requests 테이블 정책 수정
DROP POLICY IF EXISTS "Consultants can insert requests" ON public.consulting_requests;
CREATE POLICY "Consultants can insert requests" ON public.consulting_requests FOR INSERT WITH CHECK (public.check_is_consultant());

DROP POLICY IF EXISTS "Consultants can view all requests" ON public.consulting_requests;
CREATE POLICY "Consultants can view all requests" ON public.consulting_requests FOR SELECT USING (public.check_is_consultant());

DROP POLICY IF EXISTS "Consultants can update all requests" ON public.consulting_requests;
CREATE POLICY "Consultants can update all requests" ON public.consulting_requests FOR UPDATE USING (public.check_is_consultant());

DROP POLICY IF EXISTS "Consultants can delete requests" ON public.consulting_requests;
CREATE POLICY "Consultants can delete requests" ON public.consulting_requests FOR DELETE USING (public.check_is_consultant());

-- documents 테이블 정책 수정
DROP POLICY IF EXISTS "Consultants can manage all documents" ON public.documents;
CREATE POLICY "Consultants can manage all documents" ON public.documents FOR ALL USING (public.check_is_consultant()) WITH CHECK (public.check_is_consultant());

-- ai_prompts 테이블 정책 수정
DROP POLICY IF EXISTS "Consultants can manage all ai_prompts" ON public.ai_prompts;
CREATE POLICY "Consultants can manage all ai_prompts" ON public.ai_prompts FOR ALL USING (public.check_is_consultant());

-- results 테이블 정책 수정
DROP POLICY IF EXISTS "Consultants can manage all results" ON public.results;
CREATE POLICY "Consultants can manage all results" ON public.results FOR ALL USING (public.check_is_consultant());
