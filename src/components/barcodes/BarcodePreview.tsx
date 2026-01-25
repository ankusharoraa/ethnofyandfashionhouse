import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

interface BarcodePreviewProps {
  value: string;
  className?: string;
  height?: number;
}

export function BarcodePreview({ value, className, height = 60 }: BarcodePreviewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    JsBarcode(svgRef.current, value, {
      format: "CODE128",
      displayValue: true,
      lineColor: "hsl(var(--foreground))",
      background: "transparent",
      height,
      margin: 0,
    });
  }, [value, height]);

  return <svg ref={svgRef} className={className} aria-label={`Barcode ${value}`} />;
}
