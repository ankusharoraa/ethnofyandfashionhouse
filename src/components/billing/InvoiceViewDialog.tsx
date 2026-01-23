import { useRef, useState } from 'react';
import { Printer, Download, Share2, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { InvoicePrint } from './InvoicePrint';
import { useShopSettings } from '@/hooks/useShopSettings';
import { useToast } from '@/hooks/use-toast';
import type { Invoice } from '@/hooks/useBilling';

interface InvoiceViewDialogProps {
  open: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export function InvoiceViewDialog({ open, onClose, invoice }: InvoiceViewDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const { settings } = useShopSettings();
  const { toast } = useToast();
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!invoice) return null;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Error',
        description: 'Please allow popups to print',
        variant: 'destructive',
      });
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoice_number}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            table { border-collapse: collapse; }
            th, td { padding: 8px; }
            @media print {
              body { padding: 0; }
            }
          </style>
        </head>
        <body>${printContent.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleDownloadPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      // For now, we'll use the print dialog to save as PDF
      // In a production app, you'd use a library like jsPDF or html2pdf
      toast({
        title: 'Tip',
        description: 'Use "Save as PDF" option in the print dialog to download PDF',
      });
      handlePrint();
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShare = async () => {
    const text = `Invoice ${invoice.invoice_number}\n` +
      `Amount: ₹${invoice.total_amount.toFixed(2)}\n` +
      `Date: ${new Date(invoice.created_at).toLocaleDateString()}\n` +
      `From: ${settings?.shop_name || 'My Shop'}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Invoice ${invoice.invoice_number}`,
          text,
        });
      } catch (err) {
        // User cancelled or share failed
        console.log('Share cancelled');
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: 'Invoice details copied to clipboard',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0">
        <DialogHeader className="p-4 border-b flex-row items-center justify-between space-y-0">
          <DialogTitle>Invoice {invoice.invoice_number}</DialogTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-1" />
              Share
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
              <Download className="w-4 h-4 mr-1" />
              PDF
            </Button>
            <Button size="sm" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-1" />
              Print
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-80px)]">
          <div className="p-4">
            <div className="border rounded-lg overflow-hidden">
              <InvoicePrint 
                ref={printRef} 
                invoice={invoice} 
                shopSettings={settings}
              />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
