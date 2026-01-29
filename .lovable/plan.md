
Goal
- Add keyboard shortcuts for the Purchases (Revamped) screen:
  - Up/Down: move selected row
  - Enter: focus the right-side editor
  - Delete/Backspace: remove selected row (with confirmation)
- Add a global “Create Bill” shortcut via a Command Palette (as you chose):
  - Ctrl+K / Cmd+K opens a command palette from anywhere
  - Actions include: “New Sales Bill”, “New Purchase Bill”
  - On Purchases screen, the palette also includes “Add item (SKU search)”
- Show shortcut hints on hover anywhere a shortcut exists (buttons, icons, etc.)

What I found in the codebase
- Purchases screen is `src/pages/PurchaseBillingRevamped.tsx`
  - Uses `selectedRowIndex` state and passes it to `PurchaseProductTable`
  - Deleting rows is currently immediate (`onDeleteRow(index)`), no confirmation
  - SKU search dialog is currently controlled inside `PurchaseEntryForm` (local `showSKUSearch`)
- UI tooltips are available (`src/components/ui/tooltip.tsx`)
- A Command Palette building block already exists: `CommandDialog` in `src/components/ui/command.tsx`
- AlertDialog is available for confirmation (`src/components/ui/alert-dialog.tsx`)

Design decisions (important)
1) One shortcut should not conflict with another:
   - Because you selected “Ctrl+K command palette” globally, we’ll standardize on:
     - Ctrl/Cmd+K = Command Palette (global)
     - In Purchases, “Search SKU” becomes the top/first action in the palette, so Ctrl+K → Enter feels like “open search”
     - Additionally, we can add an optional direct shortcut for SKU search on Purchases (Ctrl+/ or Ctrl+F) if you want later, but we’ll keep the first iteration consistent with your choice.

2) We must not fire shortcuts while the user is typing:
   - Shortcuts will be ignored when focus is inside inputs/textareas/contenteditable, or when any dialog is open.

Implementation plan

A) Global Command Palette (Create Bill shortcuts)
1) Add a new “App Command Palette” component mounted inside `AppLayout`:
   - File: `src/components/layout/AppLayout.tsx`
   - State: `open`, `query` (optional), and `context` (current route)
   - Keyboard listener:
     - Ctrl+K / Cmd+K → open palette
     - Escape → close palette
2) Build the palette UI using existing shadcn cmdk wrappers:
   - Use: `CommandDialog`, `CommandInput`, `CommandList`, `CommandGroup`, `CommandItem`, `CommandShortcut`
3) Actions inside the palette:
   - Global:
     - “New Sales Bill” → navigate to `/sales`
     - “New Purchase Bill” → navigate to `/purchases`
   - Contextual (only when route is `/purchases`):
     - “Add item (Search SKU)” → triggers opening SKU search on the Purchases page (see section B2)
4) Show shortcut hint in the palette list using `CommandShortcut`:
   - Example: “New Sales Bill” shows “Ctrl K, then S” (or we can implement direct palette filtering)
   - Keep it simple: show “Ctrl+K” as the global entry point, and show “Enter” usage inside the palette.

B) Purchases page keyboard shortcuts (power-user)
Target file: `src/pages/PurchaseBillingRevamped.tsx`

1) Row navigation (Up/Down)
- Add a keydown handler (active only when:
  - route is `/purchases`
  - no modal is open
  - focus is not inside an input)
- Behavior:
  - ArrowDown: if nothing selected, select first row; else select next row
  - ArrowUp: if nothing selected, select last row; else select previous row
  - Keep selection in bounds
- After changing selection, ensure the selected row is scrolled into view:
  - Add `data-row-index` attribute to table rows in `PurchaseProductTable`
  - On selection change, call `scrollIntoView({ block: 'nearest' })`

2) Enter: focus the right-side editor
- Add a ref-based focus API from `PurchaseEntryForm`:
  - Convert `PurchaseEntryForm` to `forwardRef`
  - Expose `focusEditor()` via `useImperativeHandle`
  - `focusEditor()` focuses the most useful field:
    - If no SKU selected: focuses “Search / select product” input (opens dialog on click), or a dedicated “Search” button
    - If SKU selected: focuses “Purchase Qty” input
- Purchases key handler: Enter → call `entryFormRef.current?.focusEditor()`

3) Delete/Backspace: delete selected row with confirmation
- Add confirmation modal state in `PurchaseBillingRevamped.tsx`:
  - `confirmDeleteOpen`, `pendingDeleteIndex`
- Replace direct delete calls with `requestDelete(index)`:
  - Clicking trash icon → `requestDelete(index)`
  - Pressing Delete/Backspace → if selectedRowIndex !== null → `requestDelete(selectedRowIndex)`
- Use `AlertDialog` to confirm:
  - Title: “Remove item?”
  - Description: “This will remove the selected item from the purchase list.”
  - Buttons: Cancel / Remove (destructive)
  - On confirm: call existing `handleDeleteRow(index)`

4) Ctrl+K from Purchases (consistent with global palette)
- On Purchases screen, Ctrl+K will open the global command palette.
- The palette will include an “Add item (Search SKU)” action as the first item when on `/purchases`.
- Selecting it will trigger opening the SKU search dialog (next step).

C) Make SKU search openable from outside PurchaseEntryForm
Problem: `showSKUSearch` is local state inside `PurchaseEntryForm`, so the parent can’t open it.

Solution
1) Lift SKU search open state to the parent (`PurchaseBillingRevamped.tsx`):
- Add state: `skuSearchOpen`
- Pass down to `PurchaseEntryForm` as:
  - `skuSearchOpen`
  - `setSkuSearchOpen`
- Update `PurchaseEntryForm`:
  - Remove local `showSKUSearch` state
  - Use props to control `SKUSearchDialog open`
2) Hook it to the global command palette action:
- When user selects “Add item (Search SKU)” from palette and route is `/purchases`:
  - Close palette
  - Set `skuSearchOpen` to true
  - (Optionally) clear current draft selection or keep as-is based on current behavior

D) Shortcut hints on hover (icons shown on hover)
Goal: “small icon on buttons or anywhere where shortcut is applied should be displayed on hover”

Implementation
1) Create a tiny reusable UI helper component (new file):
- Example: `src/components/ui/shortcut-hint.tsx`
- API:
  - `ShortcutHint` wraps children and shows a tooltip on hover/focus
  - Props: `label`, `keys` (e.g. “Ctrl+K”), `icon` (optional)
- Tooltip content format:
  - Line 1: action label
  - Line 2: a “kbd-like” display (Tailwind: rounded border bg-muted px-1.5 font-mono text-xs)
2) Apply to key UI elements:
- Purchases:
  - Trash icon button (tooltip: “Remove item”, keys: “Del”)
  - Search button / barcode button (tooltip: “Search items”, keys: “Ctrl+K” then Enter, or “Ctrl+K”)
  - Add to Cart (tooltip: “Add to cart”, keys: “Enter” if we add it later; for now keep hover text only)
- Global:
  - Optional: add a small tooltip on the main app header area (or a help icon) showing “Command palette: Ctrl+K”

E) Test plan (end-to-end)
1) Go to Purchases:
- Add 3 items
- Click a row, press Up/Down → selection moves and stays visible
- Press Enter → focus moves to the right editor inputs
- Press Delete → confirmation appears; Cancel keeps item; Remove deletes it
2) Global:
- From Dashboard, press Ctrl+K → palette opens
- Choose “New Sales Bill” → navigates to /sales
- Press Ctrl+K again → choose “New Purchase Bill” → navigates to /purchases
- On /purchases, Ctrl+K → first action “Add item (Search SKU)” → opens SKU search dialog
3) Hover hints:
- Hover delete/search related buttons → see tooltip with the shortcut keys

Files expected to change
- Global command palette:
  - `src/components/layout/AppLayout.tsx` (mount palette + key listener)
  - `src/components/ui/shortcut-hint.tsx` (new helper component)
- Purchases keyboard shortcuts + confirmation:
  - `src/pages/PurchaseBillingRevamped.tsx`
  - `src/components/purchase/PurchaseProductTable.tsx` (row attributes + minor support)
  - `src/components/purchase/PurchaseEntryForm.tsx` (lift dialog state + focus ref API)

Notes / safeguards
- We will not trigger shortcuts when typing in inputs.
- We will not allow Delete to remove without confirmation (as you requested).
- We’ll keep the implementation consistent with existing patterns (Radix Dialog/AlertDialog, existing cmdk wrapper).

