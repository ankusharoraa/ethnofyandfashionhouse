import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Ruler, Save, X, QrCode } from 'lucide-react';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { SKU, Category, Subcategory } from '@/hooks/useSKUs';

const skuSchema = z.object({
  sku_code: z.string().min(1, 'SKU code is required').max(50),
  barcode: z.string().max(100).optional().nullable(),
  base_name: z.string().min(1, 'Design name is required').max(200),
  color: z.string().min(1, 'Color is required').max(60),
  name_hindi: z.string().max(200).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  category_id: z.string().optional().nullable(),
  subcategory_id: z.string().optional().nullable(),
  price_type: z.enum(['per_metre', 'fixed']),
  rate: z.number().min(0).optional().nullable(),
  fixed_price: z.number().min(0).optional().nullable(),
  quantity: z.number().int().min(0).default(0),
  length_metres: z.number().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(5),
});

type SKUFormData = z.infer<typeof skuSchema>;

interface SKUFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<SKU>) => Promise<SKU | null | void>;
  sku?: SKU | null;
  categories: Category[];
  subcategories: Subcategory[];
  scannedBarcode?: string;
  allowStockEdit?: boolean;
}

export function SKUForm({
  open,
  onClose,
  onSubmit,
  sku,
  categories,
  subcategories,
  scannedBarcode,
  allowStockEdit = false,
}: SKUFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filteredSubcategories, setFilteredSubcategories] = useState<Subcategory[]>([]);

  const form = useForm<SKUFormData>({
    resolver: zodResolver(skuSchema),
    defaultValues: {
      sku_code: '',
      barcode: '',
      base_name: '',
      color: '',
      name_hindi: '',
      description: '',
      category_id: null,
      subcategory_id: null,
      price_type: 'fixed',
      rate: null,
      fixed_price: null,
      quantity: 0,
      length_metres: 0,
      low_stock_threshold: 5,
    },
  });

  const priceType = form.watch('price_type');
  const categoryId = form.watch('category_id');

  useEffect(() => {
    if (categoryId) {
      setFilteredSubcategories(
        subcategories.filter((s) => s.category_id === categoryId)
      );
    } else {
      setFilteredSubcategories([]);
    }
  }, [categoryId, subcategories]);

  useEffect(() => {
    if (sku) {
      const baseName = sku.base_name || sku.name.replace(/\s*\([^)]+\)\s*$/, '');
      const color = sku.color || (sku.name.match(/\(([^)]+)\)\s*$/)?.[1] ?? '');
      form.reset({
        sku_code: sku.sku_code,
        barcode: sku.barcode,
        base_name: baseName,
        color,
        name_hindi: sku.name_hindi,
        description: sku.description,
        category_id: sku.category_id,
        subcategory_id: sku.subcategory_id,
        price_type: sku.price_type,
        rate: sku.rate,
        fixed_price: sku.fixed_price,
        quantity: sku.quantity,
        length_metres: sku.length_metres,
        low_stock_threshold: sku.low_stock_threshold,
      });
    } else {
      form.reset({
        sku_code: '',
        barcode: scannedBarcode || '',
        base_name: '',
        color: '',
        name_hindi: '',
        description: '',
        category_id: null,
        subcategory_id: null,
        price_type: 'fixed',
        rate: null,
        fixed_price: null,
        quantity: 0,
        length_metres: 0,
        low_stock_threshold: 5,
      });
    }
  }, [sku, scannedBarcode, form]);

  const handleSubmit = async (data: SKUFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...data,
        name: data.base_name, // DB trigger will format variant as "Name (Color)" when parent_sku_id is set
        category_id: data.category_id || null,
        subcategory_id: data.subcategory_id || null,
        barcode: data.barcode || null,
        name_hindi: data.name_hindi || null,
        description: data.description || null,
        rate: data.price_type === 'per_metre' ? data.rate : null,
        fixed_price: data.price_type === 'fixed' ? data.fixed_price : null,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateSKUCode = () => {
    const prefix = categories.find((c) => c.id === categoryId)?.name?.slice(0, 2).toUpperCase() || 'SK';
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    form.setValue('sku_code', `${prefix}-${random}`);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            {sku ? 'Edit SKU' : 'Add New SKU'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sku_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SKU Code *</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input placeholder="SKU-001" {...field} />
                        </FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={generateSKUCode}
                        >
                          <QrCode className="w-4 h-4" />
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Barcode</FormLabel>
                      <FormControl>
                        <Input placeholder="Scan or enter" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="base_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Design Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Cotton Suit" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Maroon" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name_hindi"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <span>Name </span>
                      <span className="hindi">(हिंदी)</span>
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="उत्पाद का नाम" className="hindi" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Product description..." {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Category Selection */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="category_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="subcategory_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subcategory</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || undefined}
                      disabled={!categoryId}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select subcategory" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredSubcategories.map((sub) => (
                          <SelectItem key={sub.id} value={sub.id}>
                            {sub.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="price_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pricing Type</FormLabel>
                    <Tabs value={field.value} onValueChange={field.onChange} className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="fixed" className="gap-2">
                          <Package className="w-4 h-4" />
                          Fixed Price
                        </TabsTrigger>
                        <TabsTrigger value="per_metre" className="gap-2">
                          <Ruler className="w-4 h-4" />
                          Per Metre
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AnimatePresence mode="wait">
                {priceType === 'fixed' ? (
                  <motion.div
                    key="fixed"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    <FormField
                      control={form.control}
                      name="fixed_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Price (₹)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0.00"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="quantity"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Quantity</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                              disabled={sku && !allowStockEdit}
                            />
                          </FormControl>
                          {sku && !allowStockEdit && (
                            <p className="text-xs text-muted-foreground">Stock managed via Purchases/Sales</p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="per_metre"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-2 gap-4"
                  >
                    <FormField
                      control={form.control}
                      name="rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Rate (₹/m)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0.00"
                              {...field}
                              value={field.value || ''}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || null)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="length_metres"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Length (metres)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="0.0"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                              disabled={sku && !allowStockEdit}
                            />
                          </FormControl>
                          {sku && !allowStockEdit && (
                            <p className="text-xs text-muted-foreground">Stock managed via Purchases/Sales</p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <FormField
                control={form.control}
                name="low_stock_threshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Low Stock Alert Threshold</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="5"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                <Save className="w-4 h-4 mr-2" />
                {isSubmitting ? 'Saving...' : 'Save SKU'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
