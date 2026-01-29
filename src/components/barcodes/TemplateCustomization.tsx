 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
 import { Label } from '@/components/ui/label';
 import { Switch } from '@/components/ui/switch';
 import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
 import { Settings2 } from 'lucide-react';
 import type { BarcodeCustomization } from '@/pages/BarcodePrinting';
 
 interface TemplateCustomizationProps {
   customization: BarcodeCustomization;
   onCustomizationChange: (customization: BarcodeCustomization) => void;
 }
 
 export function TemplateCustomization({ customization, onCustomizationChange }: TemplateCustomizationProps) {
   const updateField = <K extends keyof BarcodeCustomization>(
     field: K,
     value: BarcodeCustomization[K]
   ) => {
     onCustomizationChange({ ...customization, [field]: value });
   };
 
   return (
     <Card>
       <CardHeader>
         <CardTitle className="flex items-center gap-2 text-base">
           <Settings2 className="w-4 h-4" />
           Label Customization
         </CardTitle>
         <CardDescription className="text-xs">
           Configure what information appears on labels
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-5">
         {/* Field Visibility */}
         <div className="space-y-3">
           <h4 className="text-sm font-medium">Show Fields</h4>
           <div className="space-y-2.5">
             <div className="flex items-center justify-between">
               <Label htmlFor="show-name" className="text-sm cursor-pointer">
                 Product Name
               </Label>
               <Switch
                 id="show-name"
                 checked={customization.showProductName}
                 onCheckedChange={(checked) => updateField('showProductName', checked)}
               />
             </div>
             <div className="flex items-center justify-between">
               <Label htmlFor="show-sku" className="text-sm cursor-pointer">
                 SKU Code
               </Label>
               <Switch
                 id="show-sku"
                 checked={customization.showSKUCode}
                 onCheckedChange={(checked) => updateField('showSKUCode', checked)}
               />
             </div>
             <div className="flex items-center justify-between">
               <Label htmlFor="show-mrp" className="text-sm cursor-pointer">
                 MRP (Price)
               </Label>
               <Switch
                 id="show-mrp"
                 checked={customization.showMRP}
                 onCheckedChange={(checked) => updateField('showMRP', checked)}
               />
             </div>
           </div>
         </div>
 
         {/* Font Size */}
         <div className="space-y-3">
           <h4 className="text-sm font-medium">Font Size</h4>
           <RadioGroup
             value={customization.fontSize}
             onValueChange={(value) => updateField('fontSize', value as BarcodeCustomization['fontSize'])}
           >
             <div className="space-y-2">
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="small" id="font-small" />
                 <Label htmlFor="font-small" className="text-sm cursor-pointer">
                   Small (Fits more text)
                 </Label>
               </div>
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="medium" id="font-medium" />
                 <Label htmlFor="font-medium" className="text-sm cursor-pointer">
                   Medium (Balanced)
                 </Label>
               </div>
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="large" id="font-large" />
                 <Label htmlFor="font-large" className="text-sm cursor-pointer">
                   Large (More readable)
                 </Label>
               </div>
             </div>
           </RadioGroup>
         </div>
 
         {/* Barcode Height */}
         <div className="space-y-3">
           <h4 className="text-sm font-medium">Barcode Height</h4>
           <RadioGroup
             value={customization.barcodeHeight}
             onValueChange={(value) => updateField('barcodeHeight', value as BarcodeCustomization['barcodeHeight'])}
           >
             <div className="space-y-2">
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="compact" id="height-compact" />
                 <Label htmlFor="height-compact" className="text-sm cursor-pointer">
                   Compact (Saves space)
                 </Label>
               </div>
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="standard" id="height-standard" />
                 <Label htmlFor="height-standard" className="text-sm cursor-pointer">
                   Standard (Balanced)
                 </Label>
               </div>
               <div className="flex items-center space-x-2">
                 <RadioGroupItem value="tall" id="height-tall" />
                 <Label htmlFor="height-tall" className="text-sm cursor-pointer">
                   Tall (Better scanability)
                 </Label>
               </div>
             </div>
           </RadioGroup>
         </div>
       </CardContent>
     </Card>
   );
 }