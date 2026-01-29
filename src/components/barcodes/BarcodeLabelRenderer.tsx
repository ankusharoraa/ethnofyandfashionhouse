import { generateBarcodePngDataUrl } from '@/lib/barcode';
import type { Tables } from '@/integrations/supabase/types';
 import type { BarcodeTemplate, BarcodeCustomization } from '@/pages/BarcodePrinting';

type SKU = Tables<'skus'>;

interface BarcodeLabelRendererProps {
  sku: SKU;
  template: BarcodeTemplate;
   customization: BarcodeCustomization;
}

const templateConfig = {
  'B-1': {
    width: 2,
    height: 60,
    padding: 'p-2',
  },
  'B-2': {
    width: 1.5,
    height: 40,
    padding: 'p-1.5',
  },
   'B-3': {
     width: 2.5,
     height: 70,
     padding: 'p-2.5',
   },
   'B-4': {
     width: 1.2,
     height: 30,
     padding: 'p-1',
   },
   'B-5': {
     width: 2.5,
     height: 50,
     padding: 'p-2',
   },
   'B-6': {
     width: 1.5,
     height: 55,
     padding: 'p-2',
   },
};

 const heightConfig = {
   compact: { small: 30, medium: 35, large: 40 },
   standard: { small: 40, medium: 50, large: 60 },
   tall: { small: 50, medium: 65, large: 80 },
 };
 
 export function BarcodeLabelRenderer({ sku, template, customization }: BarcodeLabelRendererProps) {
  const config = templateConfig[template];
   
   const fontSizes = {
     small: { name: 'text-[7pt]', code: 'text-[6pt]', mrp: 'text-[6pt]' },
     medium: { name: 'text-[9pt]', code: 'text-[7.5pt]', mrp: 'text-[7.5pt]' },
     large: { name: 'text-[11pt]', code: 'text-[9pt]', mrp: 'text-[9pt]' },
   };
   
   const fonts = fontSizes[customization.fontSize];
   
   const getAdjustedHeight = () => {
     const baseHeights: Record<BarcodeTemplate, keyof typeof heightConfig.standard> = {
       'B-1': 'medium',
       'B-2': 'small',
       'B-3': 'large',
       'B-4': 'small',
       'B-5': 'medium',
       'B-6': 'medium',
     };
     const sizeKey = baseHeights[template];
     return heightConfig[customization.barcodeHeight][sizeKey];
   };
  
  if (!sku.barcode) {
    return (
      <div className={`border rounded flex items-center justify-center ${config.padding} bg-muted/20`}>
        <p className="text-[8pt] text-muted-foreground text-center">No Barcode</p>
      </div>
    );
  }

  const barcodeDataUrl = generateBarcodePngDataUrl(sku.barcode, {
    width: config.width,
     height: getAdjustedHeight(),
    displayValue: false,
  });

  return (
    <div className={`border rounded flex flex-col items-center justify-center ${config.padding} bg-white`}>
       {customization.showProductName && (
         <div className={`font-semibold ${fonts.name} text-center line-clamp-1 w-full`}>
           {sku.name}
         </div>
       )}
      
       {customization.showSKUCode && (
         <div className={`${fonts.code} text-muted-foreground text-center`}>
           {sku.sku_code}
         </div>
       )}
      
      <div className="flex-1 flex items-center justify-center w-full my-1">
        <img src={barcodeDataUrl} alt={sku.barcode} className="max-w-full h-auto" />
      </div>
      
       {customization.showMRP && sku.fixed_price && (
         <div className={`${fonts.mrp} font-semibold text-right w-full`}>
          MRP: ₹{sku.fixed_price}
        </div>
      )}
    </div>
  );
}