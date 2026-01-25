import JsBarcode from "jsbarcode";

export function generateBarcodePngDataUrl(
  value: string,
  opts?: {
    /** Smaller numbers = shorter barcode. */
    width?: number;
    height?: number;
    margin?: number;
    displayValue?: boolean;
  }
): string {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, value, {
    format: "CODE128",
    width: opts?.width ?? 2,
    height: opts?.height ?? 60,
    margin: opts?.margin ?? 0,
    displayValue: opts?.displayValue ?? false,
  });
  return canvas.toDataURL("image/png");
}
