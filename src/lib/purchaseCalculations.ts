 import type { PurchaseTableItem, BillTotals, DiscountType } from '@/types/purchase';
 
 /**
  * Calculate line item discount based on discount type and value
  */
 export function calculateLineDiscount(
   purchasePrice: number,
   quantity: number,
   discountType: DiscountType | null,
   discountValue: number
 ): number {
   if (!discountType || discountValue === 0) return 0;
   
   switch (discountType) {
     case 'percent_per_unit':
       return purchasePrice * quantity * (discountValue / 100);
     
     case 'amount_per_unit':
       return discountValue * quantity;
     
     case 'total_amount':
       return discountValue;
     
     default:
       return 0;
   }
 }
 
 /**
  * Calculate line item total after discount
  */
 export function calculateLineTotal(
   purchasePrice: number,
   quantity: number,
   discountType: DiscountType | null,
   discountValue: number
 ): number {
   const subtotal = purchasePrice * quantity;
   const discount = calculateLineDiscount(purchasePrice, quantity, discountType, discountValue);
   return Math.max(0, subtotal - discount);
 }
 
 /**
  * Calculate MRP from purchase price and margin percentage
  */
 export function calculateMRP(
   purchasePrice: number,
   marginPercent: number
 ): number {
   if (marginPercent === 0) return purchasePrice;
   return purchasePrice * (1 + marginPercent / 100);
 }
 
 /**
  * Apply margin calculation if enabled, otherwise use manual MRP
  */
 export function applyMarginIfEnabled(
   purchasePrice: number,
   marginEnabled: boolean,
   marginPercent: number,
   manualMRP?: number
 ): number {
   if (marginEnabled && marginPercent > 0) {
     return calculateMRP(purchasePrice, marginPercent);
   }
   return manualMRP || purchasePrice;
 }
 
 /**
  * Calculate complete bill totals including discounts, tax, and round-off
  */
 export function calculateBillTotals(
   lineItems: PurchaseTableItem[],
   billDiscount: number,
   roundOffAmount: number,
   taxPercent: number = 0
 ): BillTotals {
   // Sum all line totals (already includes line discounts)
   const subtotal = lineItems.reduce((sum, item) => sum + item.total_amount, 0);
   
   // Apply bill-level discount
   const afterBillDiscount = Math.max(0, subtotal - billDiscount);
   
   // Calculate tax if applicable
   const taxAmount = afterBillDiscount * (taxPercent / 100);
   
   // Before round off
   const beforeRoundOff = afterBillDiscount + taxAmount;
   
   // Apply round off
   const finalAmount = beforeRoundOff + roundOffAmount;
   
   return {
     subtotal,
     billDiscount,
     afterBillDiscount,
     taxAmount,
     beforeRoundOff,
     roundOffAmount,
     finalAmount,
   };
 }
 
 /**
  * Suggest round-off amount to nearest whole number
  */
 export function suggestRoundOff(amount: number): number {
   const rounded = Math.round(amount);
   return rounded - amount;
 }
 
 /**
  * Format currency for display
  */
 export function formatCurrency(amount: number): string {
   return `₹${amount.toFixed(2)}`;
 }