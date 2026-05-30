import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Factory,
  Loader2,
  Plus,
  Trash2,
  Save,
  Play,
  ChevronDown,
  RefreshCw,
  Package,
  FlaskConical,
} from 'lucide-react';
import { format, isValid, parseISO } from 'date-fns';
import { PageLayout } from '@/components/pos/PageLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProducts } from '@/hooks/useProducts';
import {
  computeRequirements,
  useProduction,
  type RecipeLineInput,
} from '@/hooks/useProduction';
import { fc } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface RetailProductionProps {
  onNavigate: (tab: string) => void;
}

interface DraftRecipeLine {
  id: string;
  ingredient_product_id: string;
  quantity_per_unit: string;
}

function newDraftLine(): DraftRecipeLine {
  return { id: crypto.randomUUID(), ingredient_product_id: '', quantity_per_unit: '' };
}

function formatQty(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function formatBatchDate(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, 'dd MMM yyyy, HH:mm') : '—';
}

export default function RetailProduction({ onNavigate }: RetailProductionProps) {
  const { finishedProducts, rawMaterialProducts, refetch: refetchProducts } = useProducts();
  const {
    loading,
    fetchRecipe,
    saveRecipe,
    fetchBatches,
    fetchBatchConsumption,
    completeBatch,
    generateBatchNumber,
  } = useProduction();

  const [recipeProductId, setRecipeProductId] = useState('');
  const [draftLines, setDraftLines] = useState<DraftRecipeLine[]>([newDraftLine()]);
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(false);

  const [batchProductId, setBatchProductId] = useState('');
  const [batchQty, setBatchQty] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [batchNotes, setBatchNotes] = useState('');
  const [batchExpires, setBatchExpires] = useState('');
  const [batchRecipeLines, setBatchRecipeLines] = useState<Awaited<ReturnType<typeof fetchRecipe>>>([]);
  const [isRunningBatch, setIsRunningBatch] = useState(false);

  const [batches, setBatches] = useState<Awaited<ReturnType<typeof fetchBatches>>>([]);
  const [batchConsumption, setBatchConsumption] = useState<Record<string, Awaited<ReturnType<typeof fetchBatchConsumption>>>>({});
  const [openBatchId, setOpenBatchId] = useState<string | null>(null);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);

  const loadRecipe = useCallback(
    async (productId: string) => {
      if (!productId) {
        setDraftLines([newDraftLine()]);
        return;
      }
      setIsLoadingRecipe(true);
      try {
        const lines = await fetchRecipe(productId);
        if (lines.length === 0) {
          setDraftLines([newDraftLine()]);
        } else {
          setDraftLines(
            lines.map((l) => ({
              id: l.id,
              ingredient_product_id: l.ingredient_product_id,
              quantity_per_unit: String(l.quantity_per_unit),
            })),
          );
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load recipe');
        setDraftLines([newDraftLine()]);
      } finally {
        setIsLoadingRecipe(false);
      }
    },
    [fetchRecipe],
  );

  const loadBatches = useCallback(async () => {
    setIsLoadingBatches(true);
    try {
      const rows = await fetchBatches(50);
      setBatches(rows);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load batches');
    } finally {
      setIsLoadingBatches(false);
    }
  }, [fetchBatches]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    if (!recipeProductId) return;
    void loadRecipe(recipeProductId);
  }, [recipeProductId, loadRecipe]);

  useEffect(() => {
    if (!batchProductId) {
      setBatchRecipeLines([]);
      return;
    }
    void fetchRecipe(batchProductId)
      .then(setBatchRecipeLines)
      .catch(() => setBatchRecipeLines([]));
  }, [batchProductId, fetchRecipe]);

  const batchQtyNum = parseFloat(batchQty) || 0;
  const requirements = useMemo(
    () => computeRequirements(batchRecipeLines, batchQtyNum),
    [batchRecipeLines, batchQtyNum],
  );

  const estimatedUnitCost = useMemo(() => {
    if (batchQtyNum <= 0) return 0;
    const total = requirements.reduce((s, r) => s + r.line_cost, 0);
    return Math.round((total / batchQtyNum) * 10000) / 10000;
  }, [requirements, batchQtyNum]);

  const canRunBatch =
    batchProductId &&
    batchQtyNum > 0 &&
    batchRecipeLines.length > 0 &&
    requirements.every((r) => r.sufficient);

  const handleSaveRecipe = async () => {
    if (!recipeProductId) {
      toast.error('Select a finished product');
      return;
    }
    const lines: RecipeLineInput[] = [];
    for (const line of draftLines) {
      if (!line.ingredient_product_id) continue;
      const qty = parseFloat(line.quantity_per_unit);
      if (!Number.isFinite(qty) || qty <= 0) {
        toast.error('Each ingredient needs a quantity per unit greater than zero');
        return;
      }
      lines.push({
        ingredient_product_id: line.ingredient_product_id,
        quantity_per_unit: qty,
      });
    }
    if (lines.length === 0) {
      toast.error('Add at least one ingredient');
      return;
    }
    setIsSavingRecipe(true);
    try {
      await saveRecipe(recipeProductId, lines);
      toast.success('Recipe saved');
      if (batchProductId === recipeProductId) {
        setBatchRecipeLines(await fetchRecipe(recipeProductId));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save recipe');
    } finally {
      setIsSavingRecipe(false);
    }
  };

  const handleSuggestBatchNumber = async () => {
    try {
      const num = await generateBatchNumber();
      setBatchNumber(num);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to generate batch number');
    }
  };

  const handleCompleteBatch = async () => {
    if (!canRunBatch) return;
    setIsRunningBatch(true);
    try {
      const batch = await completeBatch({
        finished_product_id: batchProductId,
        actual_qty: batchQtyNum,
        batch_number: batchNumber.trim() || undefined,
        expires_at: batchExpires
          ? new Date(`${batchExpires}T23:59:59`).toISOString()
          : undefined,
        notes: batchNotes.trim() || undefined,
      });
      toast.success(`Batch ${batch.batch_number} completed — unit cost ${fc(batch.unit_cost)}`);
      setBatchQty('');
      setBatchNotes('');
      setBatchExpires('');
      setBatchNumber('');
      await Promise.all([loadBatches(), refetchProducts()]);
      if (batchProductId) {
        setBatchRecipeLines(await fetchRecipe(batchProductId));
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to complete batch');
    } finally {
      setIsRunningBatch(false);
    }
  };

  const toggleBatchDetails = async (batchId: string) => {
    if (openBatchId === batchId) {
      setOpenBatchId(null);
      return;
    }
    setOpenBatchId(batchId);
    if (!batchConsumption[batchId]) {
      try {
        const rows = await fetchBatchConsumption(batchId);
        setBatchConsumption((prev) => ({ ...prev, [batchId]: rows }));
      } catch {
        toast.error('Failed to load batch details');
      }
    }
  };

  const selectedFinished = finishedProducts.find((p) => p.id === batchProductId);

  return (
    <PageLayout activeTab="production" onNavigate={onNavigate}>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Factory className="w-7 h-7 text-primary" />
              Production
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Define recipes, run batches, and roll material costs into finished goods.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadBatches()} disabled={isLoadingBatches}>
            <RefreshCw className={cn('w-4 h-4 mr-1', isLoadingBatches && 'animate-spin')} />
            Refresh
          </Button>
        </div>

        <Tabs defaultValue="recipe" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="recipe">Recipes</TabsTrigger>
            <TabsTrigger value="run">Run batch</TabsTrigger>
            <TabsTrigger value="history">Batch history</TabsTrigger>
          </TabsList>

          <TabsContent value="recipe" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <FlaskConical className="w-4 h-4" />
                  Bill of materials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1">
                  <Label>Finished product</Label>
                  <Select value={recipeProductId} onValueChange={setRecipeProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select product to manufacture" />
                    </SelectTrigger>
                    <SelectContent>
                      {finishedProducts.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.unit})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {!recipeProductId ? (
                  <p className="text-sm text-muted-foreground">
                    Choose a finished product to define its raw material recipe.
                  </p>
                ) : isLoadingRecipe ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading recipe…
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-muted-foreground">
                      Quantities are per <strong>1 unit</strong> of the finished product (e.g. 0.5 kg flour per loaf).
                    </p>
                    <div className="space-y-2">
                      {draftLines.map((line, idx) => (
                        <div key={line.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
                          <div className="sm:col-span-6 space-y-1">
                            {idx === 0 && <Label className="text-xs">Raw material</Label>}
                            <Select
                              value={line.ingredient_product_id}
                              onValueChange={(v) =>
                                setDraftLines((prev) =>
                                  prev.map((l) =>
                                    l.id === line.id ? { ...l, ingredient_product_id: v } : l,
                                  ),
                                )
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Ingredient" />
                              </SelectTrigger>
                              <SelectContent>
                                {rawMaterialProducts.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} — {formatQty(p.stock)} {p.unit} @ {fc(p.cost)}/{p.unit}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="sm:col-span-4 space-y-1">
                            {idx === 0 && <Label className="text-xs">Qty per unit</Label>}
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.5"
                              value={line.quantity_per_unit}
                              onChange={(e) =>
                                setDraftLines((prev) =>
                                  prev.map((l) =>
                                    l.id === line.id ? { ...l, quantity_per_unit: e.target.value } : l,
                                  ),
                                )
                              }
                            />
                          </div>
                          <div className="sm:col-span-2 flex justify-end">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              disabled={draftLines.length <= 1}
                              onClick={() =>
                                setDraftLines((prev) => prev.filter((l) => l.id !== line.id))
                              }
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 justify-between">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setDraftLines((prev) => [...prev, newDraftLine()])}
                      >
                        <Plus className="w-4 h-4 mr-1" />
                        Add ingredient
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => void handleSaveRecipe()}
                        disabled={isSavingRecipe || loading}
                      >
                        {isSavingRecipe ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4 mr-1" />
                        )}
                        Save recipe
                      </Button>
                    </div>
                    {rawMaterialProducts.length === 0 && (
                      <p className="text-sm text-warning">
                        No raw materials yet. Add products with type &quot;Raw material&quot; under Products.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="run" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Complete production batch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Finished product</Label>
                    <Select value={batchProductId} onValueChange={setBatchProductId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {finishedProducts.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>
                      Quantity to produce
                      {selectedFinished ? ` (${selectedFinished.unit})` : ''}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="50"
                      value={batchQty}
                      onChange={(e) => setBatchQty(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>Batch number (optional)</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Auto-generated if empty"
                        value={batchNumber}
                        onChange={(e) => setBatchNumber(e.target.value)}
                      />
                      <Button type="button" variant="outline" onClick={() => void handleSuggestBatchNumber()}>
                        Auto
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label>Expiry date (optional)</Label>
                    <Input
                      type="date"
                      value={batchExpires}
                      onChange={(e) => setBatchExpires(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label>Notes (optional)</Label>
                    <Textarea
                      rows={2}
                      value={batchNotes}
                      onChange={(e) => setBatchNotes(e.target.value)}
                      placeholder="Shift, line, quality notes…"
                    />
                  </div>
                </div>

                {batchProductId && batchRecipeLines.length === 0 && (
                  <p className="text-sm text-destructive">
                    No recipe for this product. Define one under the Recipes tab first.
                  </p>
                )}

                {requirements.length > 0 && batchQtyNum > 0 && (
                  <div className="rounded-md border border-border overflow-hidden">
                    <div className="bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Material requirements
                    </div>
                    <div className="divide-y divide-border">
                      {requirements.map((r) => (
                        <div
                          key={r.ingredient_product_id}
                          className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span>{r.ingredient_name}</span>
                            {!r.sufficient && (
                              <Badge variant="destructive" className="text-[10px]">
                                Insufficient
                              </Badge>
                            )}
                          </div>
                          <div className="text-right tabular-nums">
                            <div>
                              {formatQty(r.quantity_required)} {r.unit} needed
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatQty(r.available_stock)} available · {fc(r.line_cost)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t border-border px-3 py-2 flex justify-between text-sm font-medium bg-muted/20">
                      <span>Estimated unit cost</span>
                      <span className="tabular-nums">{fc(estimatedUnitCost)}</span>
                    </div>
                  </div>
                )}

                <Button
                  className="w-full sm:w-auto"
                  disabled={!canRunBatch || isRunningBatch || loading}
                  onClick={() => void handleCompleteBatch()}
                >
                  {isRunningBatch ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-1" />
                  )}
                  Complete batch
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent batches</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingBatches ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-6">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading…
                  </div>
                ) : batches.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No production batches yet.</p>
                ) : (
                  <div className="space-y-2">
                    {batches.map((batch) => (
                      <Collapsible
                        key={batch.id}
                        open={openBatchId === batch.id}
                        onOpenChange={() => void toggleBatchDetails(batch.id)}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="w-full flex items-center justify-between gap-3 rounded-md border border-border px-3 py-3 text-left hover:bg-muted/30 transition-colors"
                          >
                            <div>
                              <div className="font-medium">{batch.batch_number}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {batch.finished_product_name} · {formatQty(batch.actual_qty)}{' '}
                                {batch.finished_product_unit} · {formatBatchDate(batch.produced_at)}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right text-sm tabular-nums">
                                <div>{fc(batch.material_cost_total)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {fc(batch.unit_cost)}/unit
                                </div>
                              </div>
                              <ChevronDown
                                className={cn(
                                  'w-4 h-4 text-muted-foreground transition-transform',
                                  openBatchId === batch.id && 'rotate-180',
                                )}
                              />
                            </div>
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="px-3 pb-3 pt-1">
                          {batch.notes && (
                            <p className="text-xs text-muted-foreground mb-2">{batch.notes}</p>
                          )}
                          {batchConsumption[batch.id] ? (
                            <div className="rounded border border-border divide-y divide-border text-sm">
                              {batchConsumption[batch.id].map((c) => (
                                <div
                                  key={c.id}
                                  className="flex justify-between gap-2 px-2 py-1.5 tabular-nums"
                                >
                                  <span>{c.ingredient_name}</span>
                                  <span className="text-muted-foreground">
                                    {formatQty(c.quantity_consumed)} {c.unit} · {fc(c.line_cost)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Loading consumption…
                            </div>
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
