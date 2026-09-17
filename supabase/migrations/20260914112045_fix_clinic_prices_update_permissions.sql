-- Allow existing prices to be edited by active management roles.
-- Superadministrators manage all clinics; administrators manage their own clinic.
-- Keep historical financial records and configured prices unchanged.
CREATE POLICY clinic_prices_update_management
ON public.clinic_prices
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.user_id = (SELECT auth.uid())
      AND cm.is_active = true
      AND (cm.role = 'super_admin'
        OR (cm.role = 'admin' AND cm.clinic_id = clinic_prices.clinic_id))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clinic_members cm
    WHERE cm.user_id = (SELECT auth.uid())
      AND cm.is_active = true
      AND (cm.role = 'super_admin'
        OR (cm.role = 'admin' AND cm.clinic_id = clinic_prices.clinic_id))
  )
);
