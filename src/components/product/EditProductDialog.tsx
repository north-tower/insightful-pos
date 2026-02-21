import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Product } from '@/data/productData';
import { toast } from 'sonner';

interface RawCategory {
  id: string;
  name: string;
  icon: string | null;
  business_mode: string;
  sort_order: number;
  is_active: boolean;
}

interface EditProductDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rawCategories: RawCategory[];
  slugToCategoryId: Map<string, string>;
  onUpdate: (id: string, updates: Record<string, unknown>) => Promise<void>;
}

export default function EditProductDialog({
  product,
  open,
  onOpenChange,
  rawCategories,
  slugToCategoryId,
  onUpdate,
}: EditProductDialogProps) {
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [stock, setStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [unit, setUnit] = useState('');
  const [brand, setBrand] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [discount, setDiscount] = useState('');

  // Reset form when product changes
  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setBarcode(product.barcode || '');
      setPrice(product.price.toString());
      setCost(product.cost.toString());
      setStock(product.stock.toString());
      setLowStockThreshold(product.lowStockThreshold.toString());
      setUnit(product.unit);
      setBrand(product.brand || '');
      setIsActive(product.isActive);
      setDiscount(product.discount?.toString() || '');
      // Resolve slug → category UUID
      const catId = slugToCategoryId.get(product.category) || '';
      setCategoryId(catId);
    }
  }, [product, slugToCategoryId]);

  const handleSave = async () => {
    if (!product) return;
    if (!name.trim()) {
      toast.error('Product name is required');
      return;
    }
    if (!price || parseFloat(price) < 0) {
      toast.error('Valid price is required');
      return;
    }

    setIsSaving(true);
    try {
      await onUpdate(product.id, {
        name: name.trim(),
        sku: sku.trim() || null,
        barcode: barcode.trim() || null,
        price: parseFloat(price),
        cost: cost ? parseFloat(cost) : 0,
        stock: stock ? parseInt(stock, 10) : 0,
        low_stock_threshold: lowStockThreshold ? parseInt(lowStockThreshold, 10) : 10,
        unit: unit.trim() || 'pcs',
        brand: brand.trim() || null,
        category_id: categoryId || null,
        is_active: isActive,
        discount: discount ? parseFloat(discount) : null,
      });
      toast.success(`"${name.trim()}" updated successfully`);
      onOpenChange(false);
    } catch (err: any) {
      console.error('Failed to update product:', err);
      toast.error(err.message || 'Failed to update product');
    } finally {
      setIsSaving(false);
    }
  };

  const margin =
    price && cost && parseFloat(price) > 0
      ? Math.round(((parseFloat(price) - parseFloat(cost)) / parseFloat(price)) * 100)
      : null;

  return (
    <Dialog open={open} onOpenChange={(v) => !isSaving && onOpenChange(v)}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Edit Product</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Update the product details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="edit-name">Product Name *</Label>
            <Input
              id="edit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Wireless Earbuds Pro"
              className="mt-1"
              disabled={isSaving}
            />
          </div>

          {/* SKU + Barcode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-sku">SKU</Label>
              <Input
                id="edit-sku"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. ELC-005"
                className="mt-1 font-mono"
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="edit-barcode">Barcode</Label>
              <Input
                id="edit-barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                placeholder="Scan or enter"
                className="mt-1 font-mono"
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Price + Cost */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-price">Selling Price *</Label>
              <Input
                id="edit-price"
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="mt-1"
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="edit-cost">Cost Price</Label>
              <Input
                id="edit-cost"
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                className="mt-1"
                disabled={isSaving}
              />
              {margin !== null && (
                <p className="text-xs text-success mt-1">{margin}% margin</p>
              )}
            </div>
          </div>

          {/* Stock + Low Stock Threshold */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-stock">Stock Quantity</Label>
              <Input
                id="edit-stock"
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="0"
                className="mt-1"
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="edit-low-stock">Low Stock Alert</Label>
              <Input
                id="edit-low-stock"
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                placeholder="10"
                className="mt-1"
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Unit + Brand */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="edit-unit">Unit</Label>
              <Input
                id="edit-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="pcs, kg, ltr..."
                className="mt-1"
                disabled={isSaving}
              />
            </div>
            <div>
              <Label htmlFor="edit-brand">Brand</Label>
              <Input
                id="edit-brand"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Brand name"
                className="mt-1"
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId} disabled={isSaving}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {rawCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon ? `${cat.icon} ` : ''}{cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Discount */}
          <div>
            <Label htmlFor="edit-discount">Discount (%)</Label>
            <Input
              id="edit-discount"
              type="number"
              step="1"
              min="0"
              max="100"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0"
              className="mt-1"
              disabled={isSaving}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <Label htmlFor="edit-active" className="text-sm font-medium">Active</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inactive products won't appear in POS or catalog
              </p>
            </div>
            <Switch
              id="edit-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={isSaving}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            className="w-full sm:w-auto"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
