
Goal
- Make Sales billing (customer sales) and Purchase entry (supplier stock-in) feel like two different screens so staff don’t mix them up.
- Reduce purchase confusion by removing sales-only UI from the purchase screen and using purchase-specific wording, flow, and filtering.

What I found in your code (current behavior)
- There is only one route: `/billing` in `src/App.tsx`, and it shows both flows using a toggle (`billType` = 'sale' | 'purchase') inside `src/pages/Billing.tsx`.
- Desktop sidebar + mobile bottom nav both have a single “Billing” entry (`src/components/layout/Sidebar.tsx`, `src/components/layout/MobileNav.tsx`).
- Because both flows share the same page structure, the purchase flow still looks like “customer billing”, even though it’s logically stock-in.
- Also, `handleSelectSupplier` in `Billing.tsx` currently always opens the purchase payment dialog immediately after selecting supplier, which contributes to the “why is it asking money now?” confusion.

Decision (based on your answers)
- Create separate pages: Sales and Purchases.
- Also keep them separate on mobile navigation.

High-level UX outcome
1) Sales screen (customer billing)
- Route: `/sales` (or keep `/billing` for sales, but rename in UI)
- Only customer-related actions: customer selection, sales payment dialog, sales/returns history.

2) Purchases screen (stock-in entry)
- Route: `/purchases`
- Clearly framed as: “Record what you purchased → inventory increases after confirming”
- Supplier-first (optional to select early, but required at checkout)
- Purchase-only dialogs and history

Implementation approach (frontend only)
A) Add new routes + pages
1. Create two pages:
   - `src/pages/SalesBilling.tsx` (extracted from current Billing but sales-only)
   - `src/pages/PurchaseBilling.tsx` (purchase-only UI: supplier + purchase items + purchase history)
2. Update routing in `src/App.tsx`:
   - Add `/sales` and `/purchases`
   - Keep `/billing` as a redirect to `/sales` for backward compatibility (so old links still work)
3. Remove the sale/purchase toggle UI entirely (because separation is now done by navigation + route)

B) Update navigation (desktop + mobile)
1. Desktop sidebar (`src/components/layout/Sidebar.tsx`)
   - Replace current “Billing” item with two items:
     - “Sales” → `/sales`
     - “Purchases” → `/purchases`
2. Mobile bottom navigation (`src/components/layout/MobileNav.tsx`)
   - Add “Sales” and “Purchases” as separate icons.
   - Since bottom bar currently shows 5 items, we’ll adjust it to handle 6 items cleanly:
     - Option: make the nav container horizontally scrollable (best: keeps all items without hiding)
     - Keep icons and labels compact so it doesn’t feel crowded.

C) Make Purchase UI clearly “Stock In”, not “Customer Bill”
Inside `src/pages/PurchaseBilling.tsx`:
1. Header + wording
   - Change page title from “Billing” to “Purchases / Stock In”
   - Use labels like:
     - “Purchased Items” instead of “Cart”
     - “Record Purchase” instead of “Proceed to Payment”
2. Supplier section is always prominent
   - Top card: Supplier selected / Select Supplier
   - Optional: show supplier phone/GSTIN and a small “This purchase will increase stock” helper text.
3. Checkout flow (no premature payment prompts)
   - Only open purchase payment dialog when the user clicks “Record Purchase”
   - If supplier missing at that moment:
     - open supplier picker
     - after selecting supplier, auto-open payment dialog (your preferred flow)
   - Implementation detail:
     - add `pendingPurchaseCheckout` flag (intent state) so selecting supplier normally does not trigger payment unless checkout was initiated

D) Purchase SKU picking behavior (supplier-focused + allow out-of-stock)
Update `src/components/billing/SKUSearchDialog.tsx` and how it’s used by `PurchaseBilling.tsx`:
1. Purchase mode must allow selecting SKUs even if current stock is 0 (restock scenario).
2. Supplier-focused list:
   - Add a toggle on the purchase page: “Show items previously purchased from this supplier”
   - Default ON
   - When ON and supplier selected, the SKU dialog receives a filtered list (only SKUs that appear in previous purchase invoices for that supplier)
   - Scanning always bypasses the filter (scan is explicit intent)
3. Purchase-mode copy improvements in the dialog:
   - Title: “Add Purchased Item”
   - Stock label: “Current stock: …” (informational)

E) Purchase history lives on the Purchases screen
- Purchases screen includes:
  - “New Purchase” section (stock-in entry)
  - “Purchase History” section (existing purchase invoices)
- Sales screen includes:
  - “New Sale”
  - “Sales History”
  - “Returns”

F) Keep backend logic unchanged
- No database changes required for separating UI/routes.
- We continue using the same billing hook (`useBilling`) and completion functions; we’re only separating the screen and when dialogs open.

Files that will be changed/added (when you approve and I switch to implementation mode)
- Routing:
  - `src/App.tsx` (add routes + redirect)
- New pages:
  - `src/pages/SalesBilling.tsx` (new)
  - `src/pages/PurchaseBilling.tsx` (new)
- Navigation:
  - `src/components/layout/Sidebar.tsx` (add Sales + Purchases nav items)
  - `src/components/layout/MobileNav.tsx` (separate Sales + Purchases in bottom bar; adjust layout for 6 items)
- Purchase item picker UX:
  - `src/components/billing/SKUSearchDialog.tsx` (purchase-mode selection rules + copy)
- Optional micro-clarity:
  - `src/components/billing/BillItemRow.tsx` (purchase label “Current stock”)

Testing checklist (what I’ll verify after implementation)
1. Navigation:
   - Desktop: clicking Sales/Purchases opens distinct screens
   - Mobile: bottom bar shows Sales and Purchases separately and remains usable
2. Purchases flow:
   - Selecting supplier alone does not ask for payment
   - Add items → click Record Purchase → if supplier missing, pick supplier → payment dialog opens
   - Out-of-stock SKUs can be added in purchase mode
   - Supplier filter toggle works and scanning still adds items even if filtered out
3. Sales flow:
   - Customer billing behaves as before (no purchase UI visible)
4. Deep link behavior:
   - If you open `/billing?invoiceId=...` (old links), redirect still lands you in Sales and opens the invoice dialog appropriately.

Notes / trade-offs
- Keeping separate pages is the cleanest way to avoid operator mistakes. It also reduces training time for staff.
- The mobile bottom bar change is the main UI constraint; making it horizontally scrollable is the safest way to show 6 items without removing anything.

Rollback safety
- Because we’ll keep `/billing` as a redirect to `/sales`, nothing breaks if someone still uses the old link/bookmark.
