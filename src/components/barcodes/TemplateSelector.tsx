import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
 import type { BarcodeTemplate, BarcodeCustomization } from '@/pages/BarcodePrinting';
 import { TemplateCustomization } from './TemplateCustomization';

interface TemplateSelectorProps {
  selectedTemplate: BarcodeTemplate;
  onTemplateChange: (template: BarcodeTemplate) => void;
   customization: BarcodeCustomization;
   onCustomizationChange: (customization: BarcodeCustomization) => void;
}

const templates = [
  {
    key: 'B-1' as BarcodeTemplate,
    name: 'Standard - 3×8',
    description: 'A4 size with 24 labels (3 columns × 8 rows)',
    labelSize: '63mm × 30mm',
    gridSize: '3 × 8',
    labelsPerPage: 24,
  },
  {
    key: 'B-2' as BarcodeTemplate,
    name: 'Compact - 4×10',
    description: 'A4 size with 40 labels (4 columns × 10 rows)',
    labelSize: '48mm × 24mm',
    gridSize: '4 × 10',
    labelsPerPage: 40,
  },
   {
     key: 'B-3' as BarcodeTemplate,
     name: 'Large - 2×7',
     description: 'A4 size with 14 large labels',
     labelSize: '90mm × 35mm',
     gridSize: '2 × 7',
     labelsPerPage: 14,
   },
   {
     key: 'B-4' as BarcodeTemplate,
     name: 'Mini - 5×13',
     description: 'A4 size with 65 mini labels',
     labelSize: '38mm × 18mm',
     gridSize: '5 × 13',
     labelsPerPage: 65,
   },
   {
     key: 'B-5' as BarcodeTemplate,
     name: 'Wide - 2×10',
     description: 'A4 size with 20 wide labels',
     labelSize: '90mm × 25mm',
     gridSize: '2 × 10',
     labelsPerPage: 20,
   },
   {
     key: 'B-6' as BarcodeTemplate,
     name: 'Square - 4×7',
     description: 'A4 size with 28 square labels',
     labelSize: '48mm × 35mm',
     gridSize: '4 × 7',
     labelsPerPage: 28,
   },
];

 const getGridClass = (template: BarcodeTemplate) => {
   const gridMap: Record<BarcodeTemplate, string> = {
     'B-1': 'grid-cols-3 grid-rows-8',
     'B-2': 'grid-cols-4 grid-rows-10',
     'B-3': 'grid-cols-2 grid-rows-7',
     'B-4': 'grid-cols-5 grid-rows-13',
     'B-5': 'grid-cols-2 grid-rows-10',
     'B-6': 'grid-cols-4 grid-rows-7',
   };
   return gridMap[template];
 };
 
 export function TemplateSelector({ 
   selectedTemplate, 
   onTemplateChange,
   customization,
   onCustomizationChange 
 }: TemplateSelectorProps) {
   const selectedTemplateData = templates.find(t => t.key === selectedTemplate);
 
  return (
     <div className="space-y-4">
       <Card className="sticky top-6">
         <CardHeader>
           <CardTitle>Template Selection</CardTitle>
           <CardDescription>Choose a barcode label format</CardDescription>
         </CardHeader>
         <CardContent>
           <RadioGroup value={selectedTemplate} onValueChange={(value) => onTemplateChange(value as BarcodeTemplate)}>
             <div className="space-y-3">
               {templates.map((template) => (
                 <div
                   key={template.key}
                   className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-all cursor-pointer ${
                     selectedTemplate === template.key
                       ? 'border-primary bg-primary/5'
                       : 'border-border hover:border-primary/50'
                   }`}
                   onClick={() => onTemplateChange(template.key)}
                 >
                   <RadioGroupItem value={template.key} id={template.key} className="mt-1" />
                   <div className="flex-1 space-y-1">
                     <Label htmlFor={template.key} className="text-sm font-semibold cursor-pointer">
                       {template.name}
                     </Label>
                     <p className="text-xs text-muted-foreground">{template.description}</p>
                     <div className="flex flex-wrap gap-1.5 pt-1">
                       <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-secondary text-secondary-foreground rounded">
                         {template.gridSize}
                       </span>
                       <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-accent text-accent-foreground rounded">
                         {template.labelsPerPage} labels
                       </span>
                     </div>
                  </div>
                </div>
               ))}
             </div>
           </RadioGroup>
         </CardContent>
       </Card>

       <Card>
         <CardHeader>
           <CardTitle className="text-base">Template Preview</CardTitle>
           <CardDescription className="text-xs">
             {selectedTemplateData?.labelsPerPage} labels • {selectedTemplateData?.labelSize}
           </CardDescription>
         </CardHeader>
         <CardContent>
           <div className="bg-muted/30 border rounded-lg p-3 aspect-[1/1.414] flex items-center justify-center">
             <div className={`grid gap-0.5 w-full h-full p-2 ${getGridClass(selectedTemplate)}`}>
               {[...Array(selectedTemplateData?.labelsPerPage || 24)].map((_, i) => (
                 <div key={i} className="border border-dashed border-muted-foreground/30 rounded-sm bg-background/50" />
               ))}
             </div>
           </div>
         </CardContent>
       </Card>
 
       <TemplateCustomization 
         customization={customization}
         onCustomizationChange={onCustomizationChange}
       />
     </div>
  );
}