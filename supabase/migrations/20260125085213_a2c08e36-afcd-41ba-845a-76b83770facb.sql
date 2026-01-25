-- Prevent duplicate customers: enforce uniqueness on phone (when provided)
-- This also allows multiple customers with phone=null (no contact).

CREATE UNIQUE INDEX customers_phone_unique
  ON public.customers(phone)
  WHERE phone IS NOT NULL AND phone <> '' AND NOT is_deleted;

COMMENT ON INDEX customers_phone_unique IS 'Enforces uniqueness on phone across active customers (if phone is provided).';