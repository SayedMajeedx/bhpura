
-- Customers can read their own orders (via customers.auth_user_id link)
CREATE POLICY "order self read" ON public.orders
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = orders.customer_id
      AND c.auth_user_id IS NOT NULL
      AND c.auth_user_id = auth.uid()
  )
);

-- Customers can read line items of their own orders
CREATE POLICY "order items self read" ON public.order_items
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
    WHERE o.id = order_items.order_id
      AND c.auth_user_id IS NOT NULL
      AND c.auth_user_id = auth.uid()
  )
);

-- Customers can add addresses to their own customer record
CREATE POLICY "customer address self insert" ON public.customer_addresses
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_addresses.customer_id
      AND c.auth_user_id IS NOT NULL
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY "customer address self update" ON public.customer_addresses
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_addresses.customer_id
      AND c.auth_user_id IS NOT NULL
      AND c.auth_user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_addresses.customer_id
      AND c.auth_user_id IS NOT NULL
      AND c.auth_user_id = auth.uid()
  )
);

CREATE POLICY "customer address self delete" ON public.customer_addresses
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = customer_addresses.customer_id
      AND c.auth_user_id IS NOT NULL
      AND c.auth_user_id = auth.uid()
  )
);
