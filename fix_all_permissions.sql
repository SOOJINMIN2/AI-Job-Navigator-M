-- ============================================================
-- AI Job Navigator - 권한 오류 최종 통합 수정 스크립트
-- "permission denied for table users" 오류 해결
-- ============================================================
-- Supabase Dashboard > SQL Editor에서 전체 복사 후 Run 클릭
-- ============================================================

-- ① SECURITY DEFINER 함수 생성 (RLS 정책에서 users 테이블 우회)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  RETURN user_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.check_is_consultant()
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
BEGIN
  SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
  RETURN user_role = 'consultant';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 함수 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO anon;
GRANT EXECUTE ON FUNCTION public.check_is_consultant() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_consultant() TO anon;

-- ② users 테이블 RLS 정책 재설정
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Consultants can view all users" ON public.users;

CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "Consultants can view all users" ON public.users
  FOR SELECT USING (public.check_is_consultant());

-- ③ consulting_requests 테이블 RLS 정책 재설정
DROP POLICY IF EXISTS "Consultants can insert requests" ON public.consulting_requests;
DROP POLICY IF EXISTS "Consultants can view all requests" ON public.consulting_requests;
DROP POLICY IF EXISTS "Consultants can update all requests" ON public.consulting_requests;
DROP POLICY IF EXISTS "Consultants can delete requests" ON public.consulting_requests;

CREATE POLICY "Consultants can insert requests" ON public.consulting_requests
  FOR INSERT WITH CHECK (public.check_is_consultant());

CREATE POLICY "Consultants can view all requests" ON public.consulting_requests
  FOR SELECT USING (public.check_is_consultant());

CREATE POLICY "Consultants can update all requests" ON public.consulting_requests
  FOR UPDATE USING (public.check_is_consultant());

CREATE POLICY "Consultants can delete requests" ON public.consulting_requests
  FOR DELETE USING (public.check_is_consultant());

-- ④ documents 테이블 RLS 정책 재설정
DROP POLICY IF EXISTS "Consultants can manage all documents" ON public.documents;
DROP POLICY IF EXISTS "Students can view own documents" ON public.documents;
DROP POLICY IF EXISTS "Students can manage own documents" ON public.documents;

CREATE POLICY "Students can view own documents" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.consulting_requests
      WHERE id = request_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Consultants can manage all documents" ON public.documents
  FOR ALL
  USING (public.check_is_consultant())
  WITH CHECK (public.check_is_consultant());

-- ⑤ results 테이블 RLS 정책 재설정
DROP POLICY IF EXISTS "Consultants can manage all results" ON public.results;
DROP POLICY IF EXISTS "Students can view own results" ON public.results;

CREATE POLICY "Students can view own results" ON public.results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.consulting_requests
      WHERE id = request_id AND student_id = auth.uid()
    )
  );

CREATE POLICY "Consultants can manage all results" ON public.results
  FOR ALL USING (public.check_is_consultant());

-- ⑥ ai_prompts 테이블 RLS 정책 재설정
DROP POLICY IF EXISTS "Consultants can manage all ai_prompts" ON public.ai_prompts;
DROP POLICY IF EXISTS "Authenticated users can view ai_prompts" ON public.ai_prompts;

CREATE POLICY "Authenticated users can view ai_prompts" ON public.ai_prompts
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Consultants can manage all ai_prompts" ON public.ai_prompts
  FOR ALL USING (public.check_is_consultant());

-- ============================================================
-- 적용 확인 (실행 후 아래 결과를 확인하세요)
-- ============================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
