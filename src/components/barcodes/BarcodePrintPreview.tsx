import { useRef } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
 import { Printer, Download, ArrowLeft, FileDown } from 'lucide-react';
import { BarcodeLabelRenderer } from './BarcodeLabelRenderer';
 import type { BarcodeTemplate, BarcodeCustomization } from '@/pages/BarcodePrinting';
import { toast } from 'sonner';

import type { SKU } from '@/hooks/useSKUs';

interface BarcodePrintPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  skus: SKU[];
  selectedProducts: Map<string, number>;
  template: BarcodeTemplate;
   customization: BarcodeCustomization;
}

const labelsPerPage = {
  'B-1': 24,
  'B-2': 40,
   'B-3': 14,
   'B-4': 65,
   'B-5': 20,
   'B-6': 28,
};

const gridConfig = {
  'B-1': 'grid-cols-3',
  'B-2': 'grid-cols-4',
   'B-3': 'grid-cols-2',
   'B-4': 'grid-cols-5',
   'B-5': 'grid-cols-2',
   'B-6': 'grid-cols-4',
};

const gapConfig = {
  'B-1': 'gap-[6mm]',
  'B-2': 'gap-[4mm]',
   'B-3': 'gap-[8mm]',
   'B-4': 'gap-[3mm]',
   'B-5': 'gap-[8mm]',
   'B-6': 'gap-[5mm]',
};

export function BarcodePrintPreview({
  open,
  onOpenChange,
  skus,
  selectedProducts,
  template,
   customization,
}: BarcodePrintPreviewProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Generate flat array of labels (SKU repeated by copy count)
  const allLabels = skus.flatMap((sku) => {
    const copies = selectedProducts.get(sku.id) || 0;
    return Array(copies).fill(sku);
  });

  const perPage = labelsPerPage[template];
  const totalPages = Math.ceil(allLabels.length / perPage);

  // Split labels into pages
  const pages: SKU[][] = [];
  for (let i = 0; i < allLabels.length; i += perPage) {
    pages.push(allLabels.slice(i, i + perPage));
  }

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast.error('Please allow popups to print');
        return;
      }

      const printContent = printRef.current.innerHTML;
      printWindow.document.write(`
        <html>
          <head>
            <title>Barcode Labels</title>
            <style>
              @page { size: A4; margin: 10mm; }
              @media print {
                body { margin: 0; padding: 0; }
                .page-break { page-break-after: always; }
                .no-print { display: none !important; }
              }
              body { font-family: system-ui, -apple-system, sans-serif; }
              .grid { display: grid; gap: ${template === 'B-1' ? '6mm' : '4mm'}; }
              .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
              .grid-cols-4 { grid-template-columns: repeat(4, 1fr); }
              .label {
                border: 1px solid #e5e7eb;
                border-radius: 4px;
                padding: ${template === 'B-1' ? '8px' : '6px'};
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background: white;
                height: ${template === 'B-1' ? '30mm' : '24mm'};
              }
              .name { font-weight: 600; font-size: ${template === 'B-1' ? '9pt' : '8pt'}; text-align: center; }
              .code { font-size: ${template === 'B-1' ? '8pt' : '7pt'}; color: #6b7280; text-align: center; }
              .barcode-img { width: 100%; height: auto; margin: 2px 0; }
              .mrp { font-size: ${template === 'B-1' ? '8pt' : '7pt'}; font-weight: 600; align-self: flex-end; width: 100%; text-align: right; }
            </style>
          </head>
          <body>
            ${printContent}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  };
 
   const handleDownloadPDF = async () => {
     try {
       const { default: jsPDF } = await import('jspdf');
       const pdf = new jsPDF({
         orientation: 'portrait',
         unit: 'mm',
         format: 'a4',
       });
       
       const pageWidth = 210; // A4 width in mm
       const pageHeight = 297; // A4 height in mm
       const margin = 10;
       const contentWidth = pageWidth - (2 * margin);
       
       // For each page of labels
       for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
         if (pageIndex > 0) {
           pdf.addPage();
         }
         
         const pageLabels = pages[pageIndex];
         const gridCols = parseInt(gridConfig[template].split('-')[2]);
        const labelsOnPage = labelsPerPage[template];
        const gridRows = Math.ceil(labelsOnPage / gridCols);
         
         const cellWidth = contentWidth / gridCols;
         const cellHeight = (pageHeight - 2 * margin) / gridRows;
         
         // Draw each label as an image
         for (let i = 0; i < pageLabels.length; i++) {
           const row = Math.floor(i / gridCols);
           const col = i % gridCols;
           
           const x = margin + (col * cellWidth);
           const y = margin + (row * cellHeight);
           
           // We'll use simple text rendering for PDF
           const sku = pageLabels[i];
           pdf.setFontSize(8);
           pdf.text(sku.name, x + 2, y + 5, { maxWidth: cellWidth - 4 });
           pdf.setFontSize(6);
           pdf.text(sku.sku_code, x + 2, y + 10);
           
           if (sku.fixed_price && customization.showMRP) {
             pdf.text(`MRP: ₹${sku.fixed_price}`, x + cellWidth - 15, y + cellHeight - 3);
           }
           
           // Draw border
           pdf.rect(x, y, cellWidth, cellHeight);
         }
       }
       
       pdf.save(`barcode-labels-${Date.now()}.pdf`);
       toast.success('PDF downloaded successfully');
     } catch (error) {
       console.error('PDF generation error:', error);
       toast.error('Failed to generate PDF');
     }
   };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto">
        <DialogHeader>
          <DialogTitle>Print Preview</DialogTitle>
          <DialogDescription>
            {allLabels.length} labels across {totalPages} page{totalPages !== 1 ? 's' : ''} • Template: {template}
          </DialogDescription>
        </DialogHeader>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 no-print border-b pb-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Edit
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
         <Button variant="outline" onClick={handleDownloadPDF}>
           <FileDown className="w-4 h-4 mr-2" />
           Download PDF
         </Button>
        </div>

        {/* Print Content */}
        <div ref={printRef} className="space-y-8">
          {pages.map((pageLabels, pageIndex) => (
            <div key={pageIndex} className={pageIndex < pages.length - 1 ? 'page-break' : ''}>
              {/* Page Header (hidden in print) */}
              <div className="no-print mb-4 text-sm text-muted-foreground">
                Page {pageIndex + 1} of {totalPages}
              </div>
              
              {/* Labels Grid */}
              <div className={`grid ${gridConfig[template]} ${gapConfig[template]}`}>
                {pageLabels.map((sku, labelIndex) => (
                  <BarcodeLabelRenderer
                    key={`${pageIndex}-${labelIndex}`}
                    sku={sku}
                    template={template}
                   customization={customization}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}