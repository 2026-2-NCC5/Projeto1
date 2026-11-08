-- Migration to allow client read access for student related analytical tables
-- This allows the mobile application (using the anon key) to read student risk scores,
-- academic history, financials, contacts and relationships for authorized dashboard views.

ALTER TABLE IF EXISTS public.student_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_academic_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.student_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read student_risk_scores" ON public.student_risk_scores;
CREATE POLICY "Allow read student_risk_scores"
    ON public.student_risk_scores FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow read student_financials" ON public.student_financials;
CREATE POLICY "Allow read student_financials"
    ON public.student_financials FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow read student_academic_history" ON public.student_academic_history;
CREATE POLICY "Allow read student_academic_history"
    ON public.student_academic_history FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow read student_contacts" ON public.student_contacts;
CREATE POLICY "Allow read student_contacts"
    ON public.student_contacts FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Allow read student_relationships" ON public.student_relationships;
CREATE POLICY "Allow read student_relationships"
    ON public.student_relationships FOR SELECT
    USING (true);
