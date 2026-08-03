CREATE POLICY "Drivers read assigned customers" ON public.profiles
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'driver') AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.customer_id = profiles.id AND o.driver_id = auth.uid()
  )
);

CREATE POLICY "Kitchen reads active order menu items" ON public.order_status_history
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'kitchen'));