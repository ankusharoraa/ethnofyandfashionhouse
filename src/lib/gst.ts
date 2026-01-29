export type GstSplit = {
  cgst: number;
  sgst: number;
  igst: number;
};

export type InclusiveLineInput = {
  grossAmount: number; // amount INCLUDING GST (after any discounts)
  gstRate: number; // 0..28
};

export type InclusiveLineOutput = {
  grossAmount: number;
  taxableValue: number;
  gstAmount: number;
};

export function normalizeState(input: string | null | undefined): string | null {
  const v = (input ?? '').trim();
  if (!v) return null;
  return v.toUpperCase();
}

export function clampGstRate(rate: number): number {
  if (!Number.isFinite(rate)) return 0;
  return Math.max(0, Math.min(28, rate));
}

export function calcInclusiveLine({ grossAmount, gstRate }: InclusiveLineInput): InclusiveLineOutput {
  const gross = Number.isFinite(grossAmount) ? Math.max(0, grossAmount) : 0;
  const rate = clampGstRate(gstRate);
  if (rate <= 0) {
    return { grossAmount: gross, taxableValue: gross, gstAmount: 0 };
  }
  const divisor = 1 + rate / 100;
  const taxable = gross / divisor;
  const gst = gross - taxable;
  return { grossAmount: gross, taxableValue: taxable, gstAmount: gst };
}

export function splitGst(isInterState: boolean, gstAmount: number): GstSplit {
  const amt = Number.isFinite(gstAmount) ? gstAmount : 0;
  if (amt <= 0) return { cgst: 0, sgst: 0, igst: 0 };
  if (isInterState) return { cgst: 0, sgst: 0, igst: amt };
  return { cgst: amt / 2, sgst: amt / 2, igst: 0 };
}

export function allocateProportionalDiscount(lineGross: number[], billDiscount: number): number[] {
  const discount = Number.isFinite(billDiscount) ? Math.max(0, billDiscount) : 0;
  const total = lineGross.reduce((s, v) => s + Math.max(0, v), 0);
  if (discount <= 0 || total <= 0) return lineGross.map(() => 0);

  const allocations = lineGross.map((g) => (Math.max(0, g) / total) * discount);

  // Fix floating drift: force allocations sum == discount by adjusting last non-zero line.
  const sumAlloc = allocations.reduce((s, v) => s + v, 0);
  const diff = discount - sumAlloc;
  if (Math.abs(diff) > 1e-9) {
    let idx = -1;
    for (let i = allocations.length - 1; i >= 0; i--) {
      if (allocations[i] > 0) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) allocations[idx] += diff;
  }
  return allocations;
}
