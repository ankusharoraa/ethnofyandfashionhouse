import { useState, useMemo, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useSKUs } from '@/hooks/useSKUs';
import { BulkBarcodeTable } from '@/components/barcodes/BulkBarcodeTable';
import { TemplateSelector } from '@/components/barcodes/TemplateSelector';
import { BarcodePrintPreview } from '@/components/barcodes/BarcodePrintPreview';
 import { Search, Printer, RotateCcw, Filter, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useLocation } from 'react-router-dom';
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
 import { Alert, AlertDescription } from '@/components/ui/alert';

 export type BarcodeTemplate = 'B-1' | 'B-2' | 'B-3' | 'B-4' | 'B-5' | 'B-6';
 
 export interface BarcodeCustomization {
   showProductName: boolean;
   showSKUCode: boolean;
   showMRP: boolean;
   fontSize: 'small' | 'medium' | 'large';
   barcodeHeight: 'compact' | 'standard' | 'tall';
 }

export interface SelectedProduct {
  skuId: string;
  copies: number;
}

 const BarcodePrinting = () => {
   const { skus, isLoading, fetchSKUs } = useSKUs();
   const location = useLocation();
  
  // Selection state: Map<skuId, copyCount>
  const [selectedProducts, setSelectedProducts] = useState<Map<string, number>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
   const [searchType, setSearchType] = useState<'all' | 'code' | 'name' | 'category'>('all');
   const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [bulkCopyCount, setBulkCopyCount] = useState<number>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<BarcodeTemplate>('B-1');
 const [customization, setCustomization] = useState<BarcodeCustomization>({
   showProductName: true,
   showSKUCode: true,
   showMRP: true,
   fontSize: 'medium',
   barcodeHeight: 'standard',
 });
  const [showPreview, setShowPreview] = useState(false);
 
   // Load saved preferences
   useEffect(() => {
     const savedTemplate = localStorage.getItem('barcodeTemplate') as BarcodeTemplate | null;
     const savedCustomization = localStorage.getItem('barcodeCustomization');
     
     if (savedTemplate && ['B-1', 'B-2', 'B-3', 'B-4', 'B-5', 'B-6'].includes(savedTemplate)) {
       setSelectedTemplate(savedTemplate);
     }
     if (savedCustomization) {
       try {
         setCustomization(JSON.parse(savedCustomization));
       } catch (e) {
         console.error('Failed to parse saved customization');
       }
     }
   }, []);
   
   // Save preferences when changed
   useEffect(() => {
     localStorage.setItem('barcodeTemplate', selectedTemplate);
   }, [selectedTemplate]);
   
   useEffect(() => {
     localStorage.setItem('barcodeCustomization', JSON.stringify(customization));
   }, [customization]);
 
   // Get unique categories for filter
   const categories = useMemo(() => {
     const cats = new Set(skus.map(s => s.category_id).filter(Boolean));
     return Array.from(cats).sort();
   }, [skus]);

   // Filter SKUs based on search and filters
  const filteredSKUs = useMemo(() => {
     let filtered = skus;
     
     // Apply category filter
     if (categoryFilter !== 'all') {
       filtered = filtered.filter(sku => sku.category_id === categoryFilter);
     }
     
     // Apply search
     if (searchQuery.trim()) {
       const query = searchQuery.toLowerCase();
       filtered = filtered.filter(sku => {
         switch (searchType) {
           case 'code':
             return sku.sku_code.toLowerCase().includes(query);
           case 'name':
             return sku.name.toLowerCase().includes(query);
           case 'category':
             return sku.category_id?.toLowerCase().includes(query);
           default:
             return (
               sku.name.toLowerCase().includes(query) ||
               sku.sku_code.toLowerCase().includes(query) ||
               sku.barcode?.toLowerCase().includes(query) ||
               sku.category_id?.toLowerCase().includes(query)
             );
         }
       });
     }
    
     return filtered;
   }, [skus, searchQuery, searchType, categoryFilter]);

  // Select/deselect individual product
  const toggleProduct = (skuId: string) => {
    setSelectedProducts(prev => {
      const newMap = new Map(prev);
      if (newMap.has(skuId)) {
        newMap.delete(skuId);
      } else {
        newMap.set(skuId, 1);
      }
      return newMap;
    });
  };

  // Update copy count for individual product
  const updateCopyCount = (skuId: string, copies: number) => {
    if (copies < 0) return;
    setSelectedProducts(prev => {
      const newMap = new Map(prev);
      if (copies === 0) {
        newMap.delete(skuId);
      } else {
        newMap.set(skuId, copies);
      }
      return newMap;
    });
  };

  // Select all filtered products
  const selectAll = () => {
    const newMap = new Map<string, number>();
    filteredSKUs.forEach(sku => {
      newMap.set(sku.id, selectedProducts.get(sku.id) || 1);
    });
    setSelectedProducts(newMap);
    toast.success(`Selected ${filteredSKUs.length} products`);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedProducts(new Map());
  };

  // Apply bulk copy count to all selected
  const applyBulkCopyCount = () => {
    if (selectedProducts.size === 0) {
      toast.error('Please select products first');
      return;
    }
    if (bulkCopyCount < 1) {
      toast.error('Copy count must be at least 1');
      return;
    }
    
    setSelectedProducts(prev => {
      const newMap = new Map(prev);
      newMap.forEach((_, skuId) => {
        newMap.set(skuId, bulkCopyCount);
      });
      return newMap;
    });
    
    const totalLabels = selectedProducts.size * bulkCopyCount;
    toast.success(`Applied ${bulkCopyCount} copies to ${selectedProducts.size} products (${totalLabels} labels)`);
  };

  // Reset all selections
  const reset = () => {
    setSelectedProducts(new Map());
    setSearchQuery('');
     setSearchType('all');
     setCategoryFilter('all');
    setBulkCopyCount(1);
    toast.info('Reset complete');
  };

  // Open print preview
  const openPrintPreview = () => {
    if (selectedProducts.size === 0) {
      toast.error('Please select at least one product');
      return;
    }
    
    // Check if any selected products don't have barcodes
    const selectedSKUs = Array.from(selectedProducts.keys())
      .map(id => skus.find(s => s.id === id))
      .filter(Boolean);
    
    const withoutBarcode = selectedSKUs.filter(sku => !sku?.barcode);
    if (withoutBarcode.length > 0) {
      toast.warning(`${withoutBarcode.length} product(s) don't have barcodes assigned`);
    }
    
    setShowPreview(true);
  };

  const totalLabels = Array.from(selectedProducts.values()).reduce((sum, count) => sum + count, 0);
  const allSelected = filteredSKUs.length > 0 && filteredSKUs.every(sku => selectedProducts.has(sku.id));
   
   const selectedSKUsForPreview = Array.from(selectedProducts.keys())
     .map(id => skus.find(s => s.id === id))
     .filter((sku): sku is NonNullable<typeof sku> => sku !== undefined);
   
   const withoutBarcode = selectedSKUsForPreview.filter(sku => !sku.barcode);

   // Pre-select SKUs when coming from Purchase screen
   useEffect(() => {
     const searchParams = new URLSearchParams(location.search);
     const skuIdsParam = searchParams.get('skuIds');
     if (!skuIdsParam || skus.length === 0) return;

     const ids = skuIdsParam.split(',').filter(Boolean);
     setSelectedProducts(prev => {
       const newMap = new Map(prev);
       ids.forEach(id => {
         if (skus.some(s => s.id === id) && !newMap.has(id)) {
           newMap.set(id, 1);
         }
       });
       return newMap;
     });
   }, [location.search, skus]);

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Barcode Label Printing</h1>
            <p className="text-muted-foreground mt-1">
              Select products and generate barcode labels in bulk
            </p>
          </div>
           <div className="flex items-center gap-2">
             <Button variant="outline" onClick={reset}>
               <RotateCcw className="w-4 h-4 mr-2" />
               Reset
             </Button>
             <Button variant="outline" onClick={() => fetchSKUs()} disabled={isLoading}>
               <RotateCcw className="w-4 h-4 mr-2" />
               Refresh Products
             </Button>
             <Button onClick={openPrintPreview} disabled={selectedProducts.size === 0}>
              <Printer className="w-4 h-4 mr-2" />
              Print Preview ({totalLabels} labels)
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Product Selection */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search and Bulk Actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Product Selection</CardTitle>
                <CardDescription>
                  Search and select products to print labels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Search */}
               <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                 <Select value={searchType} onValueChange={(value: any) => setSearchType(value)}>
                   <SelectTrigger className="w-full sm:w-40">
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Fields</SelectItem>
                     <SelectItem value="code">Product Code</SelectItem>
                     <SelectItem value="name">Product Name</SelectItem>
                     <SelectItem value="category">Category</SelectItem>
                   </SelectContent>
                 </Select>
                 
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by product name, code, or barcode..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                 
                 <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                   <SelectTrigger className="w-full sm:w-48">
                     <Filter className="w-4 h-4 mr-2" />
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     <SelectItem value="all">All Categories</SelectItem>
                     {categories.map(cat => (
                       <SelectItem key={cat} value={cat || 'uncategorized'}>
                         {cat || 'Uncategorized'}
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
                </div>
               
               {/* Validation Warning */}
               {withoutBarcode.length > 0 && selectedProducts.size > 0 && (
                 <Alert variant="destructive">
                   <AlertTriangle className="h-4 w-4" />
                   <AlertDescription>
                     {withoutBarcode.length} selected product(s) don't have barcodes assigned. 
                     They will be skipped during printing.
                   </AlertDescription>
                 </Alert>
               )}

                {/* Select All & Bulk Copy */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all"
                      checked={allSelected}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          selectAll();
                        } else {
                          deselectAll();
                        }
                      }}
                    />
                    <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                     Select All ({selectedProducts.size} of {filteredSKUs.length} selected)
                    </label>
                  </div>
                  
                  <div className="flex items-center gap-2 ml-auto">
                    <label htmlFor="bulk-copy" className="text-sm font-medium whitespace-nowrap">
                      Copies for All:
                    </label>
                    <Input
                      id="bulk-copy"
                      type="number"
                      min="1"
                      max="999"
                      value={bulkCopyCount}
                      onChange={(e) => setBulkCopyCount(parseInt(e.target.value) || 1)}
                      className="w-20"
                    />
                    <Button 
                      size="sm" 
                      onClick={applyBulkCopyCount}
                      disabled={selectedProducts.size === 0}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Product Table */}
            <div className="max-h-[600px] overflow-y-auto">
              <BulkBarcodeTable
                skus={filteredSKUs as any}
                selectedProducts={selectedProducts}
                onToggleProduct={toggleProduct}
                onUpdateCopyCount={updateCopyCount}
                isLoading={isLoading}
              />
            </div>
          </div>

          {/* Right Panel - Template Selection */}
          <div className="lg:col-span-1">
            <TemplateSelector
              selectedTemplate={selectedTemplate}
              onTemplateChange={setSelectedTemplate}
           customization={customization}
           onCustomizationChange={setCustomization}
            />
          </div>
        </div>
      </div>

      {/* Print Preview Dialog */}
      {showPreview && (
        <BarcodePrintPreview
          open={showPreview}
          onOpenChange={setShowPreview}
          skus={skus.filter(sku => selectedProducts.has(sku.id)) as any}
          selectedProducts={selectedProducts}
          template={selectedTemplate}
         customization={customization}
        />
      )}
    </AppLayout>
  );
};

export default BarcodePrinting;