import { forwardRef } from 'react';
import { format } from 'date-fns';
import type { Invoice, InvoiceItem } from '@/hooks/useBilling';
import type { ShopSettings } from '@/hooks/useShopSettings';

interface InvoicePrintProps {
  invoice: Invoice;
  shopSettings: ShopSettings | null;
  invoiceType?: 'sale' | 'purchase';
  supplierName?: string;
}

export const InvoicePrint = forwardRef<HTMLDivElement, InvoicePrintProps>(
  ({ invoice, shopSettings, invoiceType = 'sale', supplierName }, ref) => {
    const items = invoice.invoice_items || [];
    const cgst = Number((invoice as any).cgst_amount ?? 0);
    const sgst = Number((invoice as any).sgst_amount ?? 0);
    const igst = Number((invoice as any).igst_amount ?? 0);
    const placeOfSupply = (invoice as any).place_of_supply_state as string | null | undefined;
    const customerGstin = (invoice as any).customer_gstin as string | null | undefined;
    const supplierGstin = (invoice as any).supplier_gstin as string | null | undefined;

    return (
      <div ref={ref} className="bg-white text-black p-8 max-w-[800px] mx-auto print:p-4">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-4">
          <h1 className="text-2xl font-bold uppercase">
            {shopSettings?.shop_name || 'My Shop'}
          </h1>
          {shopSettings?.shop_name_hindi && (
            <p className="text-lg">{shopSettings.shop_name_hindi}</p>
          )}
          {shopSettings?.tagline && (
            <p className="text-sm italic">{shopSettings.tagline}</p>
          )}
          <div className="text-sm mt-2 space-y-1">
            {shopSettings?.address && <p>{shopSettings.address}</p>}
            {(shopSettings?.city || shopSettings?.state || shopSettings?.pincode) && (
              <p>
                {[shopSettings.city, shopSettings.state, shopSettings.pincode]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            {shopSettings?.phone && <p>Phone: {shopSettings.phone}</p>}
            {shopSettings?.email && <p>Email: {shopSettings.email}</p>}
            {shopSettings?.gstin && (
              <p className="font-semibold">GSTIN: {shopSettings.gstin}</p>
            )}
          </div>
        </div>

        {/* Invoice Title */}
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold border-2 border-black inline-block px-6 py-1">
            {invoiceType === 'purchase' ? 'PURCHASE BILL' : 'TAX INVOICE'}
          </h2>
        </div>

        {/* Invoice Details */}
        <div className="flex justify-between mb-4 text-sm">
          <div>
            <p><strong>Invoice No:</strong> {invoice.invoice_number}</p>
            <p><strong>Date:</strong> {format(new Date(invoice.created_at), 'dd/MM/yyyy')}</p>
            <p><strong>Time:</strong> {format(new Date(invoice.created_at), 'hh:mm a')}</p>
            {placeOfSupply && <p><strong>Place of Supply:</strong> {placeOfSupply}</p>}
          </div>
          <div className="text-right">
            {invoiceType === 'purchase' ? (
              <>
                <p><strong>Supplier:</strong> {supplierName || 'N/A'}</p>
                {supplierGstin && <p><strong>GSTIN:</strong> {supplierGstin}</p>}
              </>
            ) : (
              <>
                <p><strong>Customer:</strong> {invoice.customer_name || 'Walk-in Customer'}</p>
                {invoice.customer_phone && (
                  <p><strong>Phone:</strong> {invoice.customer_phone}</p>
                )}
                {customerGstin && <p><strong>GSTIN:</strong> {customerGstin}</p>}
              </>
            )}
            <p><strong>Payment:</strong> {invoice.payment_method.toUpperCase()}</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full border-collapse mb-4 text-sm">
          <thead>
            <tr className="bg-gray-200">
              <th className="border border-black p-2 text-left">#</th>
              <th className="border border-black p-2 text-left">Item</th>
              <th className="border border-black p-2 text-left">SKU</th>
              <th className="border border-black p-2 text-left">HSN</th>
              <th className="border border-black p-2 text-center">Qty/Mtrs</th>
              <th className="border border-black p-2 text-right">Rate</th>
              <th className="border border-black p-2 text-right">Taxable</th>
              <th className="border border-black p-2 text-right">GST%</th>
              <th className="border border-black p-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              (() => {
                const taxable = Number((item as any).taxable_value ?? 0);
                const gstRate = Number((item as any).gst_rate ?? 0);
                const hsn = ((item as any).hsn_code ?? '') as string;
                return (
              <tr key={item.id || index}>
                <td className="border border-black p-2">{index + 1}</td>
                <td className="border border-black p-2">{item.sku_name}</td>
                <td className="border border-black p-2 font-mono text-xs">{item.sku_code}</td>
                <td className="border border-black p-2 font-mono text-xs">{hsn || '-'}</td>
                <td className="border border-black p-2 text-center">
                  {item.price_type === 'per_metre'
                    ? `${item.length_metres} m`
                    : `${item.quantity} pcs`}
                </td>
                <td className="border border-black p-2 text-right">
                  ₹{item.unit_price.toFixed(2)}
                  {item.price_type === 'per_metre' && '/m'}
                </td>
                <td className="border border-black p-2 text-right">
                  ₹{taxable.toFixed(2)}
                </td>
                <td className="border border-black p-2 text-right">{gstRate.toFixed(0)}%</td>
                <td className="border border-black p-2 text-right font-semibold">
                  ₹{item.line_total.toFixed(2)}
                </td>
              </tr>
                );
              })()
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-4">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1 border-b">
              <span>Subtotal:</span>
              <span>₹{invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.discount_amount > 0 && (
              <div className="flex justify-between py-1 border-b text-green-700">
                <span>Discount:</span>
                <span>-₹{invoice.discount_amount.toFixed(2)}</span>
              </div>
            )}
            {invoice.tax_amount > 0 && (
              <>
                {cgst > 0 && (
                  <div className="flex justify-between py-1 border-b">
                    <span>CGST:</span>
                    <span>₹{cgst.toFixed(2)}</span>
                  </div>
                )}
                {sgst > 0 && (
                  <div className="flex justify-between py-1 border-b">
                    <span>SGST:</span>
                    <span>₹{sgst.toFixed(2)}</span>
                  </div>
                )}
                {igst > 0 && (
                  <div className="flex justify-between py-1 border-b">
                    <span>IGST:</span>
                    <span>₹{igst.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between py-1 border-b">
                  <span>Total GST:</span>
                  <span>₹{invoice.tax_amount.toFixed(2)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between py-2 text-lg font-bold border-2 border-black mt-2 px-2">
              <span>TOTAL:</span>
              <span>₹{invoice.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Amount in Words */}
        <div className="border-t border-black pt-2 mb-4 text-sm">
          <p><strong>Amount in Words:</strong> {numberToWords(invoice.total_amount)} Rupees Only</p>
        </div>

        {/* Terms */}
        {shopSettings?.terms_and_conditions && (
          <div className="text-xs border-t pt-2 mb-4">
            <p className="font-semibold">Terms & Conditions:</p>
            <p className="whitespace-pre-line">{shopSettings.terms_and_conditions}</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-between items-end mt-8 pt-4 border-t">
          <div className="text-sm">
            <p>Thank you for your business!</p>
          </div>
          <div className="text-center">
            <div className="h-16"></div>
            <p className="border-t border-black pt-1 text-sm">Authorized Signature</p>
          </div>
        </div>

        {/* Print styles */}
        <style>{`
          @media print {
            body * { visibility: hidden; }
            #invoice-print, #invoice-print * { visibility: visible; }
            #invoice-print { position: absolute; left: 0; top: 0; width: 100%; }
          }
        `}</style>
      </div>
    );
  }
);

InvoicePrint.displayName = 'InvoicePrint';

// Helper function to convert number to words
function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numToWords = (n: number): string => {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + numToWords(n % 100) : '');
    if (n < 100000) return numToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numToWords(n % 1000) : '');
    if (n < 10000000) return numToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numToWords(n % 100000) : '');
    return numToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numToWords(n % 10000000) : '');
  };

  const intPart = Math.floor(num);
  return intPart === 0 ? 'Zero' : numToWords(intPart);
}
