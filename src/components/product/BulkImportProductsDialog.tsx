import { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Trash2, Upload, ClipboardPaste } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ProductType } from '@/hooks/useProducts';
import { toast } from 'sonner';

export interface BulkImportCategory {
  id: string;
  name: string;
  icon?: string | null;
}

interface BulkImportProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productType: ProductType;
  categories: BulkImportCategory[];
  onImport: (products: Record<string, unknown>[]) => Promise<void>;
}

interface BulkRow {
  key: string;
  name: string;
  sku: string;
  price: string;
  cost: string;
  stock: string;
  unit: string;
  barcode: string;
}

function newRow(unit = 'pcs'): BulkRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: '',
    sku: '',
    price: '',
    cost: '',
    stock: '',
    unit,
    barcode: '',
  };
}

function parsePastedText(text: string): Partial<BulkRow>[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const parsed = lines.map((line) =>
    line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, '')),
  );

  const header = parsed[0].map((h) => h.toLowerCase());
  const looksLikeHeader =
    header.includes('name') ||
    header.includes('product') ||
    header.includes('price') ||
    header.includes('sku');

  const dataRows = looksLikeHeader ? parsed.slice(1) : parsed;
  const col = (keys: string[]) => {
    for (const key of keys) {
      const idx = header.indexOf(key);
      if (idx >= 0) return idx;
    }
    return -1;
  };

  const nameIdx = looksLikeHeader ? col(['name', 'product', 'product name', 'item']) : 0;
  const priceIdx = looksLikeHeader ? col(['price', 'selling price', 'sell price']) : 1;
  const costIdx = looksLikeHeader ? col(['cost', 'cost price', 'buy price', 'wholesale']) : 2;
  const stockIdx = looksLikeHeader ? col(['stock', 'qty', 'quantity', 'opening stock']) : 3;
  const skuIdx = looksLikeHeader ? col(['sku', 'code', 'item code']) : 4;
  const unitIdx = looksLikeHeader ? col(['unit', 'uom']) : 5;
  const barcodeIdx = looksLikeHeader ? col(['barcode', 'ean', 'upc']) : 6;

  return dataRows.map((cells) => ({
    name: nameIdx >= 0 ? cells[nameIdx] || '' : '',
    price: priceIdx >= 0 ? cells[priceIdx] || '' : '',
    cost: costIdx >= 0 ? cells[costIdx] || '' : '',
    stock: stockIdx >= 0 ? cells[stockIdx] || '' : '',
    sku: skuIdx >= 0 ? cells[skuIdx] || '' : '',
    unit: unitIdx >= 0 ? cells[unitIdx] || '' : '',
    barcode: barcodeIdx >= 0 ? cells[barcodeIdx] || '' : '',
  }));
}

export default function BulkImportProductsDialog({
  open,
  onOpenChange,
  productType,
  categories,
  onImport,
}: BulkImportProductsDialogProps) {
  const defaultUnit = productType === 'raw' ? 'kg' : 'pcs';
  const [rows, setRows] = useState<BulkRow[]>(() =>
    Array.from({ length: 5 }, () => newRow(defaultUnit)),
  );
  const [sharedCategoryId, setSharedCategoryId] = useState('');
  const [sharedUnit, setSharedUnit] = useState(defaultUnit);
  const [isImporting, setIsImporting] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [showPaste, setShowPaste] = useState(false);

  useEffect(() => {
    if (!open) return;
    setRows(Array.from({ length: 5 }, () => newRow(defaultUnit)));
    setSharedCategoryId('');
    setSharedUnit(defaultUnit);
    setPasteText('');
    setShowPaste(false);
  }, [open, defaultUnit]);

  const filledCount = useMemo(
    () => rows.filter((r) => r.name.trim() && r.price !== '' && parseFloat(r.price) >= 0).length,
    [rows],
  );

  const reset = () => {
    setRows(Array.from({ length: 5 }, () => newRow(defaultUnit)));
    setSharedCategoryId('');
    setSharedUnit(defaultUnit);
    setPasteText('');
    setShowPaste(false);
  };

  const updateRow = (key: string, field: keyof BulkRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const addEmptyRows = (count = 5) => {
    setRows((prev) => [...prev, ...Array.from({ length: count }, () => newRow(sharedUnit || defaultUnit))]);
  };

  const removeRow = (key: string) => {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  };

  const applyPaste = () => {
    const parsed = parsePastedText(pasteText);
    if (parsed.length === 0) {
      toast.error('No rows found to paste');
      return;
    }
    const mapped = parsed.map((p) => ({
      ...newRow(p.unit || sharedUnit || defaultUnit),
      name: p.name || '',
      sku: p.sku || '',
      price: p.price || '',
      cost: p.cost || '',
      stock: p.stock || '',
      unit: p.unit || sharedUnit || defaultUnit,
      barcode: p.barcode || '',
    }));
    setRows(mapped);
    setShowPaste(false);
    setPasteText('');
    toast.success(`Loaded ${mapped.length} row${mapped.length === 1 ? '' : 's'} from paste`);
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => r.name.trim());
    if (validRows.length === 0) {
      toast.error('Enter at least one product name');
      return;
    }

    const invalidPrice = validRows.find(
      (r) => r.price === '' || Number.isNaN(parseFloat(r.price)) || parseFloat(r.price) < 0,
    );
    if (invalidPrice) {
      toast.error(`Valid price required for "${invalidPrice.name.trim()}"`);
      return;
    }

    const payload = validRows.map((r) => ({
      name: r.name.trim(),
      sku: r.sku.trim() || null,
      barcode: r.barcode.trim() || null,
      price: parseFloat(r.price),
      cost: r.cost ? parseFloat(r.cost) : 0,
      stock: r.stock ? parseFloat(r.stock) : 0,
      low_stock_threshold: 5,
      unit: (r.unit.trim() || sharedUnit || defaultUnit).trim(),
      brand: null,
      category_id: sharedCategoryId || null,
      image_url: null,
      is_active: true,
      product_type: productType,
    }));

    const badNumber = payload.find(
      (p) => Number.isNaN(p.price) || Number.isNaN(p.cost) || Number.isNaN(p.stock),
    );
    if (badNumber) {
      toast.error(`Invalid number on "${badNumber.name}"`);
      return;
    }

    setIsImporting(true);
    try {
      await onImport(payload);
      toast.success(
        `Imported ${payload.length} ${productType === 'raw' ? 'raw material' : 'product'}${
          payload.length === 1 ? '' : 's'
        }`,
      );
      reset();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to import products');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (isImporting) return;
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>
            Bulk import {productType === 'raw' ? 'raw materials' : 'products'}
          </DialogTitle>
          <DialogDescription>
            Enter many items at once, or paste from Excel / Google Sheets (columns: Name, Price,
            Cost, Stock, SKU, Unit, Barcode).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
            <div className="space-y-1">
              <Label>Default category (all rows)</Label>
              <Select
                value={sharedCategoryId || undefined}
                onValueChange={setSharedCategoryId}
                disabled={isImporting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.icon ? `${cat.icon} ` : ''}
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Default unit</Label>
              <Input
                value={sharedUnit}
                onChange={(e) => setSharedUnit(e.target.value)}
                placeholder="pcs"
                disabled={isImporting}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isImporting}
                onClick={() => setShowPaste((v) => !v)}
              >
                <ClipboardPaste className="w-4 h-4 mr-1.5" />
                Paste
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={isImporting}
                onClick={() => addEmptyRows(5)}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add rows
              </Button>
            </div>
          </div>

          {showPaste && (
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-2 shrink-0">
              <Label>Paste spreadsheet rows</Label>
              <textarea
                className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                placeholder={'Name\tPrice\tCost\tStock\tSKU\tUnit\nSugar 1kg\t150\t120\t40\tSUG-1\tkg'}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                disabled={isImporting}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowPaste(false);
                    setPasteText('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={applyPaste} disabled={isImporting}>
                  Load into table
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-auto rounded-md border border-border min-h-[240px]">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="sticky top-0 bg-muted z-10">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="p-2 font-medium w-8">#</th>
                  <th className="p-2 font-medium">Name *</th>
                  <th className="p-2 font-medium w-28">Price *</th>
                  <th className="p-2 font-medium w-28">Cost</th>
                  <th className="p-2 font-medium w-24">Stock</th>
                  <th className="p-2 font-medium w-28">SKU</th>
                  <th className="p-2 font-medium w-20">Unit</th>
                  <th className="p-2 font-medium w-28">Barcode</th>
                  <th className="p-2 w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.key} className="border-t border-border/70">
                    <td className="p-1.5 text-xs text-muted-foreground tabular-nums">{index + 1}</td>
                    <td className="p-1">
                      <Input
                        value={row.name}
                        onChange={(e) => updateRow(row.key, 'name', e.target.value)}
                        disabled={isImporting}
                        placeholder="Product name"
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.price}
                        onChange={(e) => updateRow(row.key, 'price', e.target.value)}
                        disabled={isImporting}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={row.cost}
                        onChange={(e) => updateRow(row.key, 'cost', e.target.value)}
                        disabled={isImporting}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={row.stock}
                        onChange={(e) => updateRow(row.key, 'stock', e.target.value)}
                        disabled={isImporting}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        value={row.sku}
                        onChange={(e) => updateRow(row.key, 'sku', e.target.value)}
                        disabled={isImporting}
                        className="h-8 font-mono"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        value={row.unit}
                        onChange={(e) => updateRow(row.key, 'unit', e.target.value)}
                        disabled={isImporting}
                        className="h-8"
                      />
                    </td>
                    <td className="p-1">
                      <Input
                        value={row.barcode}
                        onChange={(e) => updateRow(row.key, 'barcode', e.target.value)}
                        disabled={isImporting}
                        className="h-8 font-mono"
                      />
                    </td>
                    <td className="p-1">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        disabled={isImporting || rows.length <= 1}
                        onClick={() => removeRow(row.key)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground shrink-0">
            {filledCount} ready to import · empty name rows are skipped
          </p>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            className="w-full sm:w-auto"
            disabled={isImporting}
            onClick={() => {
              onOpenChange(false);
              reset();
            }}
          >
            Cancel
          </Button>
          <Button
            className="w-full sm:w-auto"
            disabled={isImporting || filledCount === 0}
            onClick={() => void handleImport()}
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Importing…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import {filledCount || ''} product{filledCount === 1 ? '' : 's'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
