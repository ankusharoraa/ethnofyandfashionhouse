import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Barcode as BarcodeIcon, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { SKU } from '@/hooks/useSKUs';

interface BarcodeGeneratorProps {
  skus: SKU[];
  onComplete: () => void;
}

export function BarcodeGenerator({ skus, onComplete }: BarcodeGeneratorProps) {
  const [open, setOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(0);
  const { toast } = useToast();

  const skusWithoutBarcode = skus.filter(sku => !sku.barcode);

  // Generate EAN-13 compatible barcode (13 digits)
  const generateEAN13 = (index: number): string => {
    // Use timestamp and index to create unique number
    const timestamp = Date.now().toString().slice(-6);
    const indexPart = index.toString().padStart(6, '0');
    const baseNumber = timestamp + indexPart;
    
    // Calculate EAN-13 check digit
    let sum = 0;
    for (let i = 0; i < 12; i++) {
      const digit = parseInt(baseNumber[i] || '0');
      sum += i % 2 === 0 ? digit : digit * 3;
    }
    const checkDigit = (10 - (sum % 10)) % 10;
    
    return baseNumber + checkDigit;
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGenerated(0);

    try {
      const updates = skusWithoutBarcode.map((sku, index) => ({
        id: sku.id,
        barcode: generateEAN13(index),
      }));

      // Update in batches of 10
      for (let i = 0; i < updates.length; i += 10) {
        const batch = updates.slice(i, i + 10);
        
        for (const update of batch) {
          const { error } = await supabase
            .from('skus')
            .update({ barcode: update.barcode })
            .eq('id', update.id);

          if (error) throw error;
          setGenerated(prev => prev + 1);
        }
      }

      toast({
        title: 'Success',
        description: `Generated barcodes for ${updates.length} products`,
      });

      onComplete();
      setOpen(false);
    } catch (error: any) {
      console.error('Error generating barcodes:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to generate barcodes',
        variant: 'destructive',
      });
    } finally {
      setIsGenerating(false);
      setGenerated(0);
    }
  };

  if (skusWithoutBarcode.length === 0) {
    return (
      <Button variant="outline" disabled>
        <CheckCircle className="w-4 h-4 mr-2" />
        All Products Have Barcodes
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <BarcodeIcon className="w-4 h-4 mr-2" />
        Generate Barcodes ({skusWithoutBarcode.length})
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Barcodes</DialogTitle>
            <DialogDescription>
              Automatically generate unique EAN-13 barcodes for products that don't have them yet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Products without barcodes</p>
                <p className="text-sm text-muted-foreground">
                  {skusWithoutBarcode.length} product{skusWithoutBarcode.length !== 1 ? 's' : ''} will receive unique barcodes
                </p>
              </div>
              <Badge variant="secondary" className="text-lg">
                {skusWithoutBarcode.length}
              </Badge>
            </div>

            {isGenerating && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Generating...</span>
                  <span>{generated} / {skusWithoutBarcode.length}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(generated / skusWithoutBarcode.length) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground p-3 bg-muted/50 rounded">
              <p className="font-medium mb-1">About EAN-13 Barcodes:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>13-digit unique numbers</li>
                <li>Compatible with standard barcode scanners</li>
                <li>Can be printed on product labels</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isGenerating}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={isGenerating}>
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <BarcodeIcon className="w-4 h-4 mr-2" />
                  Generate Barcodes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}