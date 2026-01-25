import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { jsPDF } from "jspdf";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SKU } from "@/hooks/useSKUs";
import { BarcodePreview } from "@/components/barcodes/BarcodePreview";
import { generateBarcodePngDataUrl } from "@/lib/barcode";

interface BarcodeActionsDialogProps {
  open: boolean;
  onClose: () => void;
  sku: SKU;
}

function buildA4GridHtml(labels: { img: string; name: string; skuCode: string }[]) {
  const cells = labels
    .map(
      (l) => `
      <div class="cell">
        <div class="name">${escapeHtml(l.name)}</div>
        <div class="code">${escapeHtml(l.skuCode)}</div>
        <img src="${l.img}" alt="barcode" />
      </div>`
    )
    .join("\n");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>Print Barcodes</title>
      <style>
        @page { size: A4; margin: 10mm; }
        body { margin: 0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; }
        .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6mm;
        }
        .cell {
          border: 1px solid rgba(0,0,0,0.15);
          border-radius: 4mm;
          padding: 4mm;
          display: flex;
          flex-direction: column;
          gap: 2mm;
          align-items: center;
          justify-content: center;
          height: 32mm;
          overflow: hidden;
        }
        .name { font-size: 10pt; font-weight: 600; text-align: center; line-height: 1.1; }
        .code { font-size: 8pt; opacity: 0.8; }
        img { width: 100%; height: auto; }
      </style>
    </head>
    <body>
      <div class="grid">${cells}</div>
    </body>
  </html>`;
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function BarcodeActionsDialog({ open, onClose, sku }: BarcodeActionsDialogProps) {
  const [isWorking, setIsWorking] = useState(false);

  const barcodeValue = sku.barcode || "";

  const labelPng = useMemo(() => {
    if (!barcodeValue) return null;
    return generateBarcodePngDataUrl(barcodeValue, {
      width: 2,
      height: 60,
      margin: 0,
      displayValue: false,
    });
  }, [barcodeValue]);

  const handleDownloadPdf = async () => {
    if (!barcodeValue || !labelPng) return;
    setIsWorking(true);
    try {
      const doc = new jsPDF({ unit: "mm", format: "a4" });

      // A4 (portrait): 210 x 297mm. Use a simple 3 x 8 grid.
      const marginX = 10;
      const marginY = 10;
      const gapX = 6;
      const gapY = 6;
      const cols = 3;
      const rows = 8;
      const pageW = 210;
      const pageH = 297;

      const cellW = (pageW - marginX * 2 - gapX * (cols - 1)) / cols;
      const cellH = (pageH - marginY * 2 - gapY * (rows - 1)) / rows;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = marginX + c * (cellW + gapX);
          const y = marginY + r * (cellH + gapY);

          // Border
          doc.setDrawColor(0);
          doc.setLineWidth(0.1);
          doc.roundedRect(x, y, cellW, cellH, 2, 2);

          // Text
          const name = sku.name.length > 20 ? sku.name.slice(0, 20) + "…" : sku.name;
          doc.text(name, x + cellW / 2, y + 6, { align: "center" });
          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.text(sku.sku_code, x + cellW / 2, y + 11, { align: "center" });
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9);

          // Barcode image
          const imgX = x + 3;
          const imgY = y + 13;
          const imgW = cellW - 6;
          const imgH = cellH - 16;
          doc.addImage(labelPng, "PNG", imgX, imgY, imgW, imgH);
        }
      }

      doc.save(`${sku.sku_code}-barcodes.pdf`);
    } finally {
      setIsWorking(false);
    }
  };

  const handlePrint = async () => {
    if (!barcodeValue || !labelPng) return;
    setIsWorking(true);
    try {
      const cols = 3;
      const rows = 8;
      const total = cols * rows;
      const html = buildA4GridHtml(
        Array.from({ length: total }, () => ({
          img: labelPng,
          name: sku.name,
          skuCode: sku.sku_code,
        }))
      );

      const w = window.open("", "_blank", "noopener,noreferrer");
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();

      // Give browser a beat to load images
      setTimeout(() => {
        w.focus();
        w.print();
      }, 200);
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Barcode</DialogTitle>
        </DialogHeader>

        {!sku.barcode ? (
          <div className="text-sm text-muted-foreground">No barcode set for this SKU.</div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-lg border p-3">
              <div className="text-sm font-medium">{sku.name}</div>
              <div className="text-xs text-muted-foreground">{sku.sku_code}</div>
              <div className="mt-3 flex justify-center">
                <BarcodePreview value={sku.barcode} className="w-full" />
              </div>
            </div>

            <div className="text-xs text-muted-foreground">Value: {sku.barcode}</div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isWorking}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={isWorking || !sku.barcode}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print (A4)
          </Button>
          <Button onClick={handleDownloadPdf} disabled={isWorking || !sku.barcode}>
            <Download className="h-4 w-4 mr-2" />
            Download (PDF)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
