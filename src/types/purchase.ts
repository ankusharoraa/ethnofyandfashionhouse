 export type DiscountType = 'percent_per_unit' | 'amount_per_unit' | 'total_amount';
 export type PurchaseType = 'cash' | 'credit' | 'partial';
 
 export interface PurchaseTableItem {
   id: string; // temp ID for table row
   sku_id: string;
   sku_code: string;
   product_name: string;
   purchase_qty: number;
   purchase_price: number;
  hsn_code?: string | null;
  gst_rate?: number;
   discount_type: DiscountType | null;
   discount_value: number;
   calculated_discount: number;
   total_amount: number;
   alt_unit: string;
   mrp: number;
   taxable_amount: number;
 }
 
 export interface PurchaseItemDraft {
   sku: any | null; // SKU type from hooks
   purchase_qty: number;
   unit: string;
   purchase_price: number;
   discount_type: DiscountType | null;
   discount_value: number;
   mrp: number;
   stock_current: number;
   taxable_amount: number;
 }
 
 export interface BillTotals {
   subtotal: number;
   billDiscount: number;
   afterBillDiscount: number;
   taxAmount: number;
   beforeRoundOff: number;
   roundOffAmount: number;
   finalAmount: number;
 }