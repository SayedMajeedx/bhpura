-- Revoke anon privileges on customers and orders so Realtime cannot broadcast
-- rows (including guest checkout orders) to unauthenticated subscribers.
-- All legitimate reads go through authenticated policies (customer self read,
-- order self read, brand staff access) or SECURITY DEFINER RPCs.
REVOKE ALL ON public.customers FROM anon;
REVOKE ALL ON public.orders FROM anon;