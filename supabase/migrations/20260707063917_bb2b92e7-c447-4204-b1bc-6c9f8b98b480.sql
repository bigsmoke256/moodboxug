
-- 1. Tighten newsletter INSERT policy: still public, but must be a valid email format.
DROP POLICY IF EXISTS "Anyone can subscribe" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe with valid email"
  ON public.newsletter_subscribers FOR INSERT
  WITH CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' AND length(email) <= 255);

-- 2. Harden has_role: only allow lookups on self (or when running as service_role with no auth.uid()).
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (_user_id = auth.uid() OR auth.uid() IS NULL)
  );
$$;

-- 3. Staff invite flow: admins create invites; sign-up accepts them and assigns the role.
CREATE TABLE IF NOT EXISTS public.staff_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_invites TO authenticated;
GRANT ALL ON public.staff_invites TO service_role;

ALTER TABLE public.staff_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage staff invites"
  ON public.staff_invites FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Seed default settings values if missing on the primary restaurant.
UPDATE public.restaurants
SET settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'address', coalesce(settings->>'address', ''),
  'phone', coalesce(settings->>'phone', ''),
  'delivery_fee', coalesce((settings->>'delivery_fee')::numeric, 5000),
  'tax_rate', coalesce((settings->>'tax_rate')::numeric, 0),
  'opening_hours', coalesce(settings->'opening_hours', '{
    "mon": {"open":"09:00","close":"22:00","closed":false},
    "tue": {"open":"09:00","close":"22:00","closed":false},
    "wed": {"open":"09:00","close":"22:00","closed":false},
    "thu": {"open":"09:00","close":"22:00","closed":false},
    "fri": {"open":"09:00","close":"23:00","closed":false},
    "sat": {"open":"10:00","close":"23:00","closed":false},
    "sun": {"open":"10:00","close":"21:00","closed":false}
  }'::jsonb)
)
WHERE id = '61548a61-12cb-4a04-ad26-d57264e9e436';
