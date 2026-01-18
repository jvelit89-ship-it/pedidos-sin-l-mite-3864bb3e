-- Fix: Remove the overly permissive public read policy on customers table
-- This policy exposes all customer PII (email, phone, address, GPS coordinates) to the public internet

DROP POLICY IF EXISTS "Allow public read customer phone for tracking" ON public.customers;