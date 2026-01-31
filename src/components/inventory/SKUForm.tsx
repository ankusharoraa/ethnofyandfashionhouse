import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Ruler, Save, X, QrCode } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Label } from '@/components/ui/label';
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
import { computeMargin, sellingFromMargin } from '@/lib/pricing';

const emptyStringToUndefinedNumber = (value: unknown) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const skuSchema = z
  .object({
  sku_code: z.string().min(1, 'SKU code is required').max(50),
  barcode: z.string().max(100).optional().nullable(),
  name: z.string().min(1, 'Product name is required').max(200),
  description: z.string().max(1000).optional().nullable(),
  category_id: z.string().optional().nullable(),
  subcategory_id: z.string().optional().nullable(),
  hsn_code: z
    .string()
    .trim()
    .max(20)
    .optional()
    .nullable(),
  gst_rate: z.number().min(0).max(28).default(0),
  price_type: z.enum(['per_metre', 'fixed']),
  purchase_rate: z.preprocess(emptyStringToUndefinedNumber, z.number().min(0).optional()),
  purchase_fixed_price: z.preprocess(emptyStringToUndefinedNumber, z.number().min(0).optional()),
  rate: z.preprocess(emptyStringToUndefinedNumber, z.number().min(0).optional()),
  fixed_price: z.preprocess(emptyStringToUndefinedNumber, z.number().min(0).optional()),
  quantity: z.number().int().min(0).default(0),
  length_metres: z.number().min(0).default(0),
  low_stock_threshold: z.number().int().min(0).default(5),
  })
  .superRefine((val, ctx) => {
    if (val.price_type === 'fixed') {
      if (!val.purchase_fixed_price || val.purchase_fixed_price <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['purchase_fixed_price'],
          message: 'Cost price is required',
        });
      }
      if (!val.fixed_price || val.fixed_price <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixed_price'],
          message: 'Selling price is required',
        });
      }

      if (
        typeof val.purchase_fixed_price === 'number' &&
        typeof val.fixed_price === 'number' &&
        val.fixed_price < val.purchase_fixed_price
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fixed_price'],
          message: 'Selling price must be ≥ cost price',
        });
      }
    }

    if (val.price_type === 'per_metre') {
      if (!val.purchase_rate || val.purchase_rate <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['purchase_rate'],
          message: 'Cost price is required',
        });
      }
      if (!val.rate || val.rate <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rate'],
          message: 'Selling price is required',
        });
      }

      if (
        typeof val.purchase_rate === 'number' &&
        typeof val.rate === 'number' &&
        val.rate < val.purchase_rate
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['rate'],
          message: 'Selling price must be ≥ cost price',
        });
      }
    }
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
  const [marginInput, setMarginInput] = useState('');
  const [isEditingMargin, setIsEditingMargin] = useState(false);

  const form = useForm<SKUFormData>({
    resolver: zodResolver(skuSchema),
    defaultValues: {
      sku_code: '',
      barcode: '',
      name: '',
      description: '',
      category_id: null,
      subcategory_id: null,
      hsn_code: '',
      gst_rate: 0,
      price_type: 'fixed',
      purchase_rate: undefined,
      purchase_fixed_price: undefined,
      rate: undefined,
      fixed_price: undefined,
      quantity: 0,
      length_metres: 0,
      low_stock_threshold: 5,
    },
  });

  const priceType = form.watch('price_type');
  const categoryId = form.watch('category_id');

  const watchedCost = form.watch(priceType === 'fixed' ? 'purchase_fixed_price' : 'purchase_rate');
  const watchedSell = form.watch(priceType === 'fixed' ? 'fixed_price' : 'rate');

  // RHF stores input values as strings while typing (we coerce to numbers on submit via zod preprocess).
  // For live margin/profit display we must parse them here.
  const costNumber = useMemo(() => {
    const n = Number(watchedCost);
    return Number.isFinite(n) ? n : null;
  }, [watchedCost]);

  const sellNumber = useMemo(() => {
    const n = Number(watchedSell);
    return Number.isFinite(n) ? n : null;
  }, [watchedSell]);

  const margin = useMemo(() => computeMargin(costNumber, sellNumber), [costNumber, sellNumber]);

  useEffect(() => {
    if (isEditingMargin) return;
    setMarginInput(margin.marginPercent === null ? '' : margin.marginPercent.toFixed(2));
  }, [isEditingMargin, margin.marginPercent]);

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
      form.reset({
        sku_code: sku.sku_code,
        barcode: sku.barcode,
        name: sku.name,
        description: sku.description,
        category_id: sku.category_id,
        subcategory_id: sku.subcategory_id,
        hsn_code: (sku as any).hsn_code || '',
        gst_rate: Number((sku as any).gst_rate ?? 0),
        price_type: sku.price_type,
        purchase_rate: (sku as any).purchase_rate ?? undefined,
        purchase_fixed_price: (sku as any).purchase_fixed_price ?? undefined,
        rate: sku.rate ?? undefined,
        fixed_price: sku.fixed_price ?? undefined,
        quantity: sku.quantity,
        length_metres: sku.length_metres,
        low_stock_threshold: sku.low_stock_threshold,
      });
    } else {
      form.reset({
        sku_code: '',
        barcode: scannedBarcode || '',
        name: '',
        description: '',
        category_id: null,
        subcategory_id: null,
        hsn_code: '',
        gst_rate: 0,
        price_type: 'fixed',
        purchase_rate: undefined,
        purchase_fixed_price: undefined,
        rate: undefined,
        fixed_price: undefined,
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
        category_id: data.category_id || null,
        subcategory_id: data.subcategory_id || null,
        barcode: data.barcode || null,
        description: data.description || null,
        hsn_code: data.hsn_code || null,
        gst_rate: data.gst_rate ?? 0,
        purchase_rate: data.price_type === 'per_metre' ? data.purchase_rate! : null,
        purchase_fixed_price: data.price_type === 'fixed' ? data.purchase_fixed_price! : null,
        rate: data.price_type === 'per_metre' ? data.rate! : null,
        fixed_price: data.price_type === 'fixed' ? data.fixed_price! : null,
        // IMPORTANT: DB columns are NOT NULL; keep unused stock field as 0 (never null)
        quantity: data.price_type === 'fixed' ? data.quantity : 0,
        length_metres: data.price_type === 'per_metre' ? data.length_metres : 0,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarginChange = (nextMargin: number) => {
    const cost = Number(costNumber ?? 0);
    if (!Number.isFinite(cost) || cost <= 0) return;

    const nextSelling = sellingFromMargin(cost, nextMargin);
    if (priceType === 'fixed') {
      form.setValue('fixed_price', Number(nextSelling.toFixed(2)), { shouldDirty: true, shouldValidate: true });
    } else {
      form.setValue('rate', Number(nextSelling.toFixed(2)), { shouldDirty: true, shouldValidate: true });
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
            {/* Short form */}
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
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Cotton Suit - Maroon" {...field} />
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
                        {categories.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No categories yet
                          </SelectItem>
                        ) : null}
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
                        {categoryId && filteredSubcategories.length === 0 ? (
                          <SelectItem value="__none" disabled>
                            No subcategories for this category
                          </SelectItem>
                        ) : null}
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

            {/* GST */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="hsn_code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HSN / SAC</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. 5208" {...field} value={field.value || ''} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="gst_rate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST %</FormLabel>
                    <Select
                      value={String(field.value ?? 0)}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {[0, 5, 12, 18, 28].map((r) => (
                          <SelectItem key={r} value={String(r)}>
                            {r}%
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
                      name="purchase_fixed_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost Price (₹/pc)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value as any)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fixed_price"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Selling Price (₹/pc)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value as any)}
                            />
                          </FormControl>
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
                      name="purchase_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Cost Price (₹/m)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value as any)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Selling Price (₹/m)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="0.00"
                              {...field}
                              value={field.value ?? ''}
                              onChange={(e) => field.onChange(e.target.value as any)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <Label>Margin %</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      placeholder="0"
                      value={marginInput}
                      onFocus={() => setIsEditingMargin(true)}
                      onBlur={() => {
                        setIsEditingMargin(false);
                        const next = Number(marginInput);
                        if (!Number.isFinite(next)) return;
                        handleMarginChange(next);
                      }}
                      onChange={(e) => setMarginInput(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Auto-fills selling from cost</p>
                  </div>

                  <div className="sm:w-[180px]">
                    <Label>Profit</Label>
                    <div className="h-10 flex items-center justify-between rounded-md border border-input bg-muted/30 px-3 text-sm">
                      <span>₹{Number.isFinite(margin.profit) ? margin.profit.toFixed(2) : '0.00'}</span>
                      <span className="text-xs text-muted-foreground">
                        {margin.marginPercent === null ? '—' : `${margin.marginPercent.toFixed(2)}%`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="advanced">
                <AccordionTrigger>Advanced</AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4">
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

                    <div className="grid grid-cols-2 gap-4">
                      {(sku || allowStockEdit) ? (
                        priceType === 'fixed' ? (
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
                        ) : (
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
                        )
                      ) : null}

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
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

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
