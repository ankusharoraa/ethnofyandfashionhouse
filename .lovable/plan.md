
Goal
- Add proper “same design, multiple colours” support using the approved approach: Parent (Base Product) + Variants (Color), with shared pricing and barcode per color, and color visible in both Inventory and Billing.
- Additionally, ensure the workflow aligns with “barcode should have all details” (i.e., scanning uniquely identifies the exact color variant so staff doesn’t need to manually pick color during billing).

What we already know (approved)
- Tracking method: Parent + variants
- Pricing: Shared price across colors (parent holds price; variants inherit)
- Barcode: One barcode per color (variant)
- UX: Color selection available in both Inventory and Billing
- Display: “Name (Color)” everywhere
- Existing SKUs: Migrate existing SKUs

Key design decision (to satisfy “no manual by staff”)
- In day-to-day selling: staff will scan barcode → exact variant is selected automatically.
- Search-based selection will still show “Name (Color)” so it’s unambiguous, but scanning should be the primary/fast path.

Proposed data model (database)
We’ll keep the current skus table but extend it to represent both product (parent) and variant (child) rows, minimizing disruption:

New columns on public.skus
- parent_sku_id uuid null references public.skus(id)
  - null => this row is a “base product”
  - non-null => this row is a “color variant”
- color text null
  - set only for variants (e.g., “Maroon”)
- base_name text null (optional but recommended)
  - base product: base_name = name (or can be null)
  - variant: base_name = parent.name snapshot or null (we can compute from join; snapshot is optional)
- shared pricing fields live on base products:
  - base product uses existing fields price_type, fixed_price, rate
  - variants keep their own price fields but are treated as “read-only mirrors” (updated automatically whenever parent price changes)

Constraints / integrity (implemented via backend function + triggers, not check constraints)
- Variant must have parent_sku_id and color.
- Variant barcode must be unique (already) and generally should be non-null for usable variants.
- When parent price changes, cascade update to all variants’ price fields to keep existing billing code simple (or update frontend to always read parent price; we can do both for safety).

RLS / permissions (align with your existing model)
- Keep current rules: owners (and allowed staff roles) can create variants during purchase; stock changes still happen via purchase/sale/return functions.
- Ensure staff cannot “change color” or “re-parent” a variant unless explicitly allowed (owner-only).
- Ensure variants/base products can be viewed by authenticated users as today.

Migration strategy (existing SKUs → base + “Standard” variant)
For each existing sku row:
1) Create a new base product row:
   - name = existing sku.name without color suffix if we can detect it, otherwise keep same name
   - price_type/rate/fixed_price copied from existing sku
   - category/subcategory/description/image copied
   - sku_code: generate a new unique code (since existing sku_code must remain on the variant to avoid breaking invoices/history)
   - barcode: null
   - quantity/length_metres: 0
2) Convert the existing row into a variant:
   - parent_sku_id = new base product id
   - color = 'Standard'
   - name becomes “{baseName} (Standard)” (because display chosen is Name (Color) everywhere)
   - keep existing barcode/sku_code/stock so nothing breaks operationally
3) Optional: If an existing sku name already matches “X (Color)”, we can attempt to parse color and use that instead of “Standard”. (We’ll do this conservatively and only if it’s a clear pattern.)

Frontend behavior changes
A) Fetching SKUs (useSKUs hook)
- Update fetchSKUs select to also fetch parent product fields when sku is a variant:
  - parent: name, price_type, rate, fixed_price, category_id/subcategory_id, etc.
- Add derived helpers in the hook (computed on client):
  - displayName: if variant => `${parent.name} (${color})` (or use sku.name if already stored that way)
  - effectivePriceType/effectiveRate/effectiveFixedPrice: from parent if present else from sku
- Add hook helpers:
  - getBaseProducts() and getVariantsForProduct(productId)
  - findByBarcode already returns single SKU; ensure it returns variant rows and includes parent join.

B) Inventory page
- List should primarily show variants (because stock and barcode are per variant).
- Add grouping / filters:
  - Search: match against base name + color + sku_code + barcode.
  - Category filter: inherited from parent (so variants still filter correctly).
- Editing:
  - Editing variant should allow changing only variant-specific fields (color, barcode, image maybe), but price fields should be shown read-only (since shared).
  - Editing base product should allow changing shared fields (name, category, price), and it updates all variants automatically.
- Add “Add Product” flow:
  - Step 1: create base product (name, category, price_type, price)
  - Step 2: create first variant (color required, barcode auto-generated)
  - This avoids staff manually typing colors during billing; creation is an owner/admin activity.

C) Billing (SKUSearchDialog + sales/purchase pages)
- Search results show variants only (because billing needs a sellable/buyable stock unit and barcode).
- Display as “Name (Color)” everywhere:
  - Always show variant.displayName.
- Price shown should be the shared price (parent) and should match exactly across variants.
- Barcode scanning:
  - Sales/Purchase scan should find the variant directly by barcode and add it (no color prompt).
- Purchase inline SKU creation (SKUCreateInline / PurchaseBilling)
  - Replace “Create SKU” with “Create Product Variant”
  - Required inputs for creation:
    - Base name (design)
    - Color (owner/admin enters at creation time)
    - Price type + shared price
  - On create:
    - If base product with same name exists, create only a new variant with that parent.
    - Otherwise create base + variant.
  - Barcode auto-generated for the new variant.

D) Invoices / printing
- Invoice item name should store and display variant name in “Name (Color)” format (so historical invoices remain clear even if base product name changes later).
- Ensure invoice item sku_name always uses variant displayName at time of sale/purchase.

Backend logic impact (stock/invoice RPCs)
- The existing complete_invoice / complete_purchase_invoice functions operate on invoice_items.sku_id pointing to skus rows.
- With variants, sku_id will always be the variant id, so stock deductions/additions remain correct without rewriting these functions.
- Only ensure that purchase completion updates the shared price:
  - Today purchase completion updates fixed_price/rate on the sku itself.
  - We’ll adjust logic so that when purchasing a variant, it updates the parent’s shared price and then cascades to all variants.
  - This keeps “shared price” truly shared across colors.

How we’ll address “barcode should have all details”
- The barcode itself remains an opaque unique code (best for scanning).
- The printed barcode label will include human-readable:
  - Base name + color (Name (Color))
  - SKU code (variant sku_code)
  - Price (optional)
This achieves “barcode has all details” in practice: scanning identifies exact variant; label visually shows the details.

Validation / QA checklist (what we will verify after implementation)
- Creating a base product updates all variants’ price when edited.
- Scanning a barcode adds the correct color variant to cart (sales and purchase).
- Searching shows variants with “Name (Color)” and correct shared pricing.
- Inventory stock shown per variant and cannot be manually edited unless permitted (and still logs if allowed).
- Existing SKUs are migrated and remain usable (barcode lookup, invoices, stock).
- Purchase completion with Cash/UPI/Card does not accidentally record as credit (separate issue you raised earlier; we will retest end-to-end after changes).

Scope sequencing (recommended order)
1) Database migration: add columns + FK + helper functions/triggers for price sync and migration.
2) Update useSKUs to understand parent/variant and provide “effective” pricing + displayName.
3) Update Inventory list + SKUCard + SKUForm to support variants/base editing.
4) Update Billing search + barcode scan flows to select variants and show “Name (Color)”.
5) Update Purchase inline creation to create base+variant or variant under existing base.
6) Run migration of existing SKUs and verify data.
7) Full regression test: sales, purchase, returns, cancel invoice, barcode printing.

What I need from you (already resolved)
- All key product-variant decisions are already finalized. No further blocking questions.

Technical notes (implementation constraints)
- We will not edit auto-generated backend client/types files manually.
- Database changes will be done via migrations.
- We will keep invoice/stock RPCs mostly intact by ensuring invoice_items always reference variant SKU rows.
