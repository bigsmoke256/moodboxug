ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS estimated_delivery_at timestamptz;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_deactivated boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('customer','admin')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_messages_customer_idx ON public.support_messages (customer_id, created_at);

GRANT SELECT, INSERT, UPDATE ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers read own support thread"
  ON public.support_messages FOR SELECT TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers send own support messages"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid() AND sender = 'customer');

CREATE POLICY "Admins reply to support messages"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND sender = 'admin');

CREATE POLICY "Mark support messages read"
  ON public.support_messages FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (customer_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;