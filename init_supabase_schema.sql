-- Create users table (mirroring auth.users)
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'consultant')),
  full_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Create consulting_requests table
CREATE TABLE public.consulting_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_company TEXT NOT NULL,
  job_description_url_or_text TEXT,
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
  document_type TEXT NOT NULL, -- e.g., 'resume', 'cover_letter', 'portfolio'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

-- Create ai_prompts table
CREATE TABLE public.ai_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- e.g., 'resume_review', 'mock_interview'
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
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.results ENABLE ROW LEVEL SECURITY;

-- +++ RLS Policies +++ --

-- 1. users Policies
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Consultants can view all users" ON public.users FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
);

-- 2. consulting_requests Policies
CREATE POLICY "Students can manage own requests" ON public.consulting_requests 
  FOR ALL USING (auth.uid() = student_id);
CREATE POLICY "Consultants can view all requests" ON public.consulting_requests 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );
CREATE POLICY "Consultants can update all requests" ON public.consulting_requests 
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );

-- 3. documents Policies
CREATE POLICY "Students can manage own documents" ON public.documents 
  USING (
    EXISTS (
      SELECT 1 FROM public.consulting_requests WHERE id = request_id AND student_id = auth.uid()
    )
  );
CREATE POLICY "Consultants can view all documents" ON public.documents 
  FOR SELECT USING (
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
      SELECT 1 FROM public.consulting_requests WHERE id = request_id AND student_id = auth.uid()
    )
  );
CREATE POLICY "Consultants can manage all results" ON public.results 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'consultant')
  );

-- +++ Auth Trigger Setup +++ --
-- This ensures when a user signs up on the frontend, their details map directly into public.users.
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
