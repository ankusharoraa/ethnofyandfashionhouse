
Goal
- In Purchase flow, require two separate prices:
  1) Purchase/Cost price (what you paid)
  2) Selling price (what you sell for)
- Show profit/margin instantly while entering these values (percent + optional reverse calculation).
- Use these values to generate daily profit reports.

What’s currently happening (problem)
- The system currently uses `skus.fixed_price / skus.rate` as a single “price”.
- In purchase bills, the “cost” you enter is stored into invoice_items `unit_price`/`rate`, and the backend currently updates `skus.fixed_price / skus.rate` from that, which overwrites the selling price.
- Reports page currently shows inventory value, not daily sales/profit.

High-level design (new pricing model)
- Keep existing `skus.fixed_price` and `skus.rate` as the Selling price (shared on base product, inherited to variants).
- Add new fields for Purchase/Cost price on SKUs:
  - `skus.purchase_fixed_price` (cost per piece)
  - `skus.purchase_rate` (cost per metre)
- In Purchase billing:
  - Cost price is mandatory per line item.
  - Selling price is mandatory if missing for that product (as you approved: “Only if missing”).
  - Show margin/profit % live:  
    margin% = ((selling - cost) / cost) * 100 (when cost > 0)
  - Also allow “enter margin%” to auto-calc selling price (optional, but matches your “shows profit percent directly or vice-versa” request).

Data changes (backend/database)
1) Schema changes (migration)
- Add columns to `public.skus`:
  - `purchase_fixed_price numeric null`
  - `purchase_rate numeric null`
- Add columns to `public.invoice_items`:
  - `cost_price numeric null`  
    (stored on SALES invoice items to snapshot the cost at the time of sale; used for accurate daily profit)
  - `sell_price numeric null`  
    (used mainly on PURCHASE invoice items to carry selling price when required; also useful for audit)
- Update variant triggers so variants inherit BOTH selling price and purchase price from parent base product:
  - In `trg_skus_enforce_variant_fields`: also copy `purchase_fixed_price/purchase_rate` from parent
  - In `trg_skus_sync_variants_from_parent`: also propagate `purchase_fixed_price/purchase_rate` to variants
- Update `complete_purchase_invoice` function:
  - Stock update stays on variant (same as now)
  - Update base product prices as:
    - Purchase cost fields updated from the purchase invoice item:
      - fixed: `purchase_fixed_price = invoice_items.unit_price`
      - per_metre: `purchase_rate = invoice_items.rate` (or fallback `unit_price` if needed)
    - Selling price fields updated only if missing AND a selling price was supplied:
      - fixed: if base.fixed_price is null/0 then set from `invoice_items.sell_price`
      - per_metre: if base.rate is null/0 then set from `invoice_items.sell_price`
  - This prevents purchases from overwriting selling price, while still capturing cost.

2) Migration for existing data
- For existing SKUs:
  - Initialize `purchase_fixed_price` / `purchase_rate` from current selling price only when purchase price is missing (best-effort default), OR leave as null and let future purchases fill it.
  - I recommend: set purchase_* = selling_* only if purchase_* is null, so profit report won’t break immediately.
- For existing invoice_items:
  - Leave new columns null; daily profit report will use fallbacks for older data (see reporting section below).

Frontend changes (app behavior)
1) Update SKU type + SKU forms (Inventory)
- Extend the SKU type in `useSKUs` to include:
  - `purchase_fixed_price`, `purchase_rate`
- Inventory SKU form:
  - For Base product editing: show both Selling price and Purchase price fields (purchase optional).
  - For Variant: keep price fields read-only (inherited), but display both selling + purchase for clarity.

2) Purchase billing UI (mandatory fields + margin display)
A) Bill item row changes (Purchase mode)
- In Purchase bill item row, show 2 price inputs:
  - Cost (mandatory):  
    - fixed: Cost (₹/pc) → stored in `invoice_items.unit_price`
    - per_metre: Cost (₹/m) → stored in `invoice_items.rate` (and optionally sync `unit_price`)
  - Selling (mandatory only if missing in SKU):  
    - stored in `invoice_items.sell_price`
- Show derived margin right next to it:
  - “Profit: ₹X/pc” (or ₹X/m)
  - “Margin: Y%”
- Optional “Reverse” entry:
  - Input for margin% that auto-fills selling price:
    - selling = cost * (1 + margin%/100)

B) Purchase validation (before checkout)
- Extend the existing validation in `PurchaseBilling.tsx`:
  - Already validates cost > 0; keep that.
  - Add: if the SKU’s selling price is missing (0/null), require `item.sell_price > 0`.
  - For per_metre: check the relevant selling field similarly.

C) SKUCreateInline during purchase
- When creating a new product+variant inline, require both:
  - Selling price (mandatory)
  - Purchase cost (mandatory)
- Immediately show margin% preview as user types.

3) Sales billing behavior (snapshot cost for accurate profit)
- When adding an item to cart in Sales:
  - Set `invoice_items.cost_price` from SKU’s current purchase_* price:
    - fixed: cost_price = sku.purchase_fixed_price
    - per_metre: cost_price = sku.purchase_rate
- When creating the sales invoice items, insert `cost_price` into `invoice_items`.
- This gives accurate “profit per day” even if cost changes later.

Reporting changes (daily profit)
- Expand `Reports` page with a “Daily Profit” section:
  - Date picker (default = today)
  - Summary cards:
    - Total Sales (revenue)
    - Total Cost (COGS)
    - Profit
    - Profit %
- Query logic:
  - Fetch completed sale invoices for selected day, join invoice_items.
  - Revenue:
    - Use invoice_items.line_total sum.
  - Cost:
    - For each invoice item:
      - if cost_price is present, use it
      - else fallback to SKU current purchase_* (for old invoices)
    - cost total = cost_price * qty OR cost_price * length_metres depending on price_type.
  - Profit = revenue - cost.
- This will not include returns/cancelled invoices by default. (Returns are negative invoices; we can add a toggle later if needed.)

Security / validation notes
- Client-side validation with zod stays in place.
- The backend function `complete_purchase_invoice` should also defensively validate:
  - cost > 0
  - sell_price > 0 only when selling is missing (optional but recommended for integrity)

Implementation sequence (safe + incremental)
1) Database migration:
   - Add new columns to `skus` and `invoice_items`
   - Update triggers to sync purchase prices
   - Update `complete_purchase_invoice` logic to store cost into purchase_* fields and only set selling price if missing
   - Optional backfill purchase_* for existing SKUs
2) Update `useSKUs` TypeScript type + fetching to include new fields.
3) Update Purchase UI:
   - BillItemRow purchase mode: add Selling price input + margin display + (optional) margin-to-selling calculator
   - PurchaseBilling validation: enforce rules
   - SKUCreateInline: require both cost + selling (and show margin)
4) Update Sales flow:
   - Set `cost_price` snapshot for sales invoice items and insert into DB
5) Update Reports page:
   - Add daily profit section and calculations
   - Add fallback logic for old data
6) QA checklist:
   - Purchase bill cannot complete if cost is missing/0
   - If SKU selling price missing, purchase bill cannot complete without entering selling price
   - Selling price is not overwritten by purchase once already set
   - Sales invoice items store cost_price and profit report matches expectations

Files/areas that will be touched (expected)
- Backend migration SQL (schema + function updates)
- `src/hooks/useSKUs.tsx` (SKU type + fetch)
- `src/hooks/useBilling.tsx` (addToCart + insert invoice items with cost_price/sell_price)
- `src/components/billing/BillItemRow.tsx` (purchase UI: 2 price fields + margin)
- `src/pages/PurchaseBilling.tsx` (validation rules + pass-through sell_price)
- `src/components/billing/SKUCreateInline.tsx` (collect both prices + margin)
- `src/pages/Reports.tsx` (daily profit report UI + query)

Acceptance criteria (what you should see)
- In Purchase:
  - Each item shows Cost and Selling fields
  - Margin% shows instantly
  - You cannot finish purchase without valid cost, and selling is required if product has no selling price yet
- In Sales:
  - Selling price stays as before
  - Profit report shows correct numbers for the day
- In Reports:
  - “Daily Profit” section shows Sales, Cost, Profit, Profit% for selected date
