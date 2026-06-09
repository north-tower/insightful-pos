import { useEffect, useMemo, useState } from 'react';
import { Loader2, Download, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAssignmentReport, type AssignmentDailyReportData } from '@/hooks/useAssignmentReport';
import { useRouteSettlement } from '@/hooks/useRouteSettlement';
import { generateInvoicePdf } from '@/lib/generateInvoicePdf';
import { fc } from '@/lib/currency';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface AssignmentDailyReportDialogProps {
  assignmentId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function exportReportCsv(data: AssignmentDailyReportData) {
  const rows: string[][] = [
    ['Daily Sales Report', data.routeName, data.assignmentDateLabel],
    [],
    ['Product', 'Pack', 'Quantity', 'Sales Work Out', 'Returns', 'Sold', 'Money Received'],
    ...data.products.map((p) => [
      p.productName,
      p.packSize,
      String(p.quantity),
      p.salesWorkOut.toFixed(2),
      String(p.returns),
      String(p.soldOut),
      p.moneyReceived.toFixed(2),
    ]),
    [],
    [
      'Total',
      '',
      String(data.totals.quantity),
      data.totals.salesWorkOut.toFixed(2),
      String(data.totals.returns),
      String(data.totals.soldOut),
      data.totals.moneyReceived.toFixed(2),
    ],
    [],
    ['Grand Sales + Credit', data.grandSalesPlusCredit.toFixed(2)],
    ['Total Expenses', data.totalExpenses.toFixed(2)],
    ['Discount Out', data.discountOut.toFixed(2)],
    ['Net after expenses', data.netAfterExpensesAndDiscount.toFixed(2)],
  ];

  if (data.settlement) {
    rows.push(
      [],
      ['Settlement'],
      ['Expected remittance', data.settlement.expected_remittance.toFixed(2)],
      ['Cash submitted', data.settlement.cash_submitted.toFixed(2)],
      ['M-Pesa submitted', data.settlement.mpesa_submitted.toFixed(2)],
      ['Bank submitted', data.settlement.bank_submitted.toFixed(2)],
      ['Variance', data.settlement.variance.toFixed(2)],
    );
  }

  const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `route-report-${data.routeName.replace(/\s+/g, '-')}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AssignmentDailyReportDialog({
  assignmentId,
  open,
  onOpenChange,
}: AssignmentDailyReportDialogProps) {
  const { fetchReport, loading, error } = useAssignmentReport();
  const { saveSettlement, saving } = useRouteSettlement();
  const [report, setReport] = useState<AssignmentDailyReportData | null>(null);
  const [cashSubmitted, setCashSubmitted] = useState('');
  const [mpesaSubmitted, setMpesaSubmitted] = useState('');
  const [bankSubmitted, setBankSubmitted] = useState('');
  const [settlementNotes, setSettlementNotes] = useState('');

  const loadReport = async (id: string) => {
    const data = await fetchReport(id);
    setReport(data);
    if (data) {
      const s = data.settlement;
      setCashSubmitted(s ? String(s.cash_submitted) : '');
      setMpesaSubmitted(
        s ? String(s.mpesa_submitted) : String(data.salesBreakdown.mpesa),
      );
      setBankSubmitted(
        s ? String(s.bank_submitted) : String(data.salesBreakdown.directBank),
      );
      setSettlementNotes(s?.notes || '');
    }
  };

  useEffect(() => {
    if (!open || !assignmentId) {
      setReport(null);
      return;
    }
    void loadReport(assignmentId);
  }, [open, assignmentId]);

  const expectedRemittance = report?.netAfterExpensesAndDiscount ?? 0;
  const parsedCash = parseFloat(cashSubmitted) || 0;
  const parsedMpesa = parseFloat(mpesaSubmitted) || 0;
  const parsedBank = parseFloat(bankSubmitted) || 0;
  const liveVariance = parsedCash - expectedRemittance;
  const isFinalized = report?.settlement?.is_finalized ?? false;

  const varianceLabel = useMemo(() => {
    if (liveVariance === 0) return 'Balanced';
    return liveVariance > 0 ? 'Surplus' : 'Shortage';
  }, [liveVariance]);

  const handleSaveSettlement = async (finalize: boolean) => {
    if (!report || !assignmentId) return;
    if (parsedCash < 0) {
      toast.error('Enter a valid cash amount');
      return;
    }
    try {
      await saveSettlement({
        assignment_id: assignmentId,
        expected_remittance: expectedRemittance,
        cash_submitted: parsedCash,
        mpesa_submitted: parsedMpesa,
        bank_submitted: parsedBank,
        notes: settlementNotes,
        finalize,
      });
      toast.success(finalize ? 'Route settlement finalized' : 'Settlement draft saved');
      await loadReport(assignmentId);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settlement');
    }
  };

  const handlePdf = async () => {
    const pdf = await generateInvoicePdf('#assignment-daily-report');
    if (pdf) {
      pdf.save(`route-report-${report?.routeName || 'assignment'}.pdf`);
    } else {
      toast.error('Could not generate PDF');
    }
  };

  const displaySettlement = report?.settlement ?? {
    expected_remittance: expectedRemittance,
    cash_submitted: parsedCash,
    mpesa_submitted: parsedMpesa,
    bank_submitted: parsedBank,
    variance: liveVariance,
    notes: settlementNotes || null,
    is_finalized: false,
    finalized_by_name: null,
    finalized_at: null,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle>Daily Sales Report</DialogTitle>
            {isFinalized && (
              <Badge className="bg-success/15 text-success border-success/30 gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Finalized
              </Badge>
            )}
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {error && !loading && (
          <p className="text-sm text-destructive text-center py-8">{error}</p>
        )}

        {report && !loading && (
          <>
            <div className="flex gap-2 justify-end print:hidden">
              <Button size="sm" variant="outline" onClick={() => exportReportCsv(report)}>
                <Download className="w-4 h-4 mr-1.5" />
                CSV
              </Button>
              <Button size="sm" onClick={() => void handlePdf()}>
                <FileText className="w-4 h-4 mr-1.5" />
                PDF
              </Button>
            </div>

            {/* Settlement form — screen only */}
            <div className="print:hidden rounded-lg border border-border bg-muted/20 p-4 space-y-3">
              <p className="text-sm font-semibold">Route Settlement</p>
              <p className="text-xs text-muted-foreground">
                Record cash remitted at end of route. Expected remittance = net sales after
                expenses and discounts (excl. outstanding credit).
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Expected remittance</Label>
                  <p className="text-lg font-bold tabular-nums mt-1">{fc(expectedRemittance)}</p>
                </div>
                <div>
                  <Label htmlFor="cash-submitted">Cash submitted *</Label>
                  <Input
                    id="cash-submitted"
                    type="number"
                    min="0"
                    step="0.01"
                    value={cashSubmitted}
                    onChange={(e) => setCashSubmitted(e.target.value)}
                    disabled={isFinalized || saving}
                    className="mt-1"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label htmlFor="mpesa-submitted">M-Pesa confirmed</Label>
                  <Input
                    id="mpesa-submitted"
                    type="number"
                    min="0"
                    step="0.01"
                    value={mpesaSubmitted}
                    onChange={(e) => setMpesaSubmitted(e.target.value)}
                    disabled={isFinalized || saving}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bank-submitted">Bank confirmed</Label>
                  <Input
                    id="bank-submitted"
                    type="number"
                    min="0"
                    step="0.01"
                    value={bankSubmitted}
                    onChange={(e) => setBankSubmitted(e.target.value)}
                    disabled={isFinalized || saving}
                    className="mt-1"
                  />
                </div>
              </div>

              <div
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium',
                  liveVariance === 0 && 'bg-muted text-muted-foreground',
                  liveVariance > 0 && 'bg-success/10 text-success',
                  liveVariance < 0 && 'bg-destructive/10 text-destructive',
                )}
              >
                {liveVariance < 0 ? (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                )}
                <span>
                  {varianceLabel}: {liveVariance >= 0 ? '+' : ''}
                  {fc(liveVariance)}
                  {liveVariance !== 0 && (
                    <span className="font-normal text-xs ml-1">
                      ({parsedCash > 0 ? `${fc(parsedCash)} submitted vs ${fc(expectedRemittance)} expected` : 'enter cash submitted'})
                    </span>
                  )}
                </span>
              </div>

              <div>
                <Label htmlFor="settlement-notes">Notes</Label>
                <Textarea
                  id="settlement-notes"
                  rows={2}
                  value={settlementNotes}
                  onChange={(e) => setSettlementNotes(e.target.value)}
                  disabled={isFinalized || saving}
                  placeholder="e.g. Shortage explained, partial bank deposit..."
                  className="mt-1"
                />
              </div>

              {!isFinalized && (
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saving || !cashSubmitted}
                    onClick={() => void handleSaveSettlement(false)}
                  >
                    Save draft
                  </Button>
                  <Button
                    size="sm"
                    disabled={saving || !cashSubmitted}
                    onClick={() => void handleSaveSettlement(true)}
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    )}
                    Finalize settlement
                  </Button>
                </div>
              )}

              {isFinalized && report.settlement?.finalized_by_name && (
                <p className="text-xs text-muted-foreground text-right">
                  Finalized by {report.settlement.finalized_by_name}
                  {report.settlement.finalized_at &&
                    ` · ${format(new Date(report.settlement.finalized_at), 'dd MMM yyyy HH:mm')}`}
                </p>
              )}
            </div>

            <div
              id="assignment-daily-report"
              className="bg-white text-black p-6 space-y-4 text-sm"
            >
              <div className="text-center space-y-1 border-b pb-4">
                <p className="text-xs uppercase tracking-widest text-red-600 font-bold">
                  Daily Sales Report Invoice
                </p>
                <p className="text-lg font-bold uppercase">{report.routeName} Route</p>
                <p className="text-sm font-semibold">{report.assignmentDateLabel}</p>
                <p className="text-xs text-gray-600">Staff: {report.cashierName}</p>
              </div>

              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border p-1.5 text-left">Product</th>
                    <th className="border p-1.5 text-center">Pack</th>
                    <th className="border p-1.5 text-center">Qty</th>
                    <th className="border p-1.5 text-right">Sales Work Out</th>
                    <th className="border p-1.5 text-center">Returns</th>
                    <th className="border p-1.5 text-center">Sold</th>
                    <th className="border p-1.5 text-right">Money Received</th>
                  </tr>
                </thead>
                <tbody>
                  {report.products.map((p) => (
                    <tr key={p.productId}>
                      <td className="border p-1.5">{p.productName}</td>
                      <td className="border p-1.5 text-center">{p.packSize}</td>
                      <td className="border p-1.5 text-center">{p.quantity}</td>
                      <td className="border p-1.5 text-right">{fc(p.salesWorkOut)}</td>
                      <td className="border p-1.5 text-center">{p.returns}</td>
                      <td className="border p-1.5 text-center">{p.soldOut}</td>
                      <td className="border p-1.5 text-right font-semibold">
                        {fc(p.moneyReceived)}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold bg-gray-50">
                    <td className="border p-1.5" colSpan={2}>
                      Total
                    </td>
                    <td className="border p-1.5 text-center">{report.totals.quantity}</td>
                    <td className="border p-1.5 text-right">{fc(report.totals.salesWorkOut)}</td>
                    <td className="border p-1.5 text-center">{report.totals.returns}</td>
                    <td className="border p-1.5 text-center">{report.totals.soldOut}</td>
                    <td className="border p-1.5 text-right">{fc(report.totals.moneyReceived)}</td>
                  </tr>
                </tbody>
              </table>

              {report.mostSoldProduct && report.mostSoldProduct.qty > 0 && (
                <p className="text-xs font-semibold text-center">
                  Most sold: {report.mostSoldProduct.name} ({report.mostSoldProduct.qty} pcs)
                </p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="font-bold border-b pb-1">Daily Sales Report Summary</p>
                  <p className="flex justify-between">
                    <span>Grand Sales + Credit</span>
                    <span className="font-semibold">{fc(report.grandSalesPlusCredit)}</span>
                  </p>

                  <p className="font-bold border-b pb-1 pt-2">Expenses</p>
                  {report.expenses.length === 0 ? (
                    <p className="text-gray-500 text-xs">No route expenses recorded</p>
                  ) : (
                    report.expenses.map((e, i) => (
                      <p key={e.id} className="flex justify-between text-xs">
                        <span>
                          {i + 1}. {e.description}
                        </span>
                        <span>{fc(e.amount)}</span>
                      </p>
                    ))
                  )}
                  <p className="flex justify-between font-semibold border-t pt-1">
                    <span>Total Expenses</span>
                    <span>{fc(report.totalExpenses)}</span>
                  </p>

                  {report.discountOut > 0 && (
                    <p className="flex justify-between">
                      <span>Discount Out</span>
                      <span>{fc(report.discountOut)}</span>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <p className="font-bold border-b pb-1">Sales Breakdown</p>
                  <p className="flex justify-between text-xs">
                    <span>1. Cash Sales</span>
                    <span>{fc(report.salesBreakdown.cash)}</span>
                  </p>
                  <p className="flex justify-between text-xs">
                    <span>2. Total Sales (Cash + M-Pesa + Bank)</span>
                    <span>{fc(report.salesBreakdown.totalSales)}</span>
                  </p>
                  <p className="flex justify-between text-xs">
                    <span>3. M-Pesa / Paybill</span>
                    <span>{fc(report.salesBreakdown.mpesa)}</span>
                  </p>
                  <p className="flex justify-between text-xs">
                    <span>4. Direct Bank</span>
                    <span>{fc(report.salesBreakdown.directBank)}</span>
                  </p>
                  <p className="flex justify-between text-xs">
                    <span>5. Credit</span>
                    <span>{fc(report.salesBreakdown.credit)}</span>
                  </p>

                  <p className="font-bold border-b pb-1 pt-2">Final Balance</p>
                  <p className="text-xs">
                    Collected (excl. credit): {fc(report.totalCollectedExCredit)}
                  </p>
                  <p className="text-xs">
                    Less expenses ({fc(report.totalExpenses)}) &amp; discount (
                    {fc(report.discountOut)}):
                  </p>
                  <p className="text-sm font-bold border-t pt-1">
                    Expected remittance: {fc(report.netAfterExpensesAndDiscount)}
                  </p>
                  {report.outstandingCredit.length > 0 && (
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold">
                        Outstanding Credit: -{fc(report.totalOutstandingCredit)}
                      </p>
                      {report.outstandingCredit.map((c, i) => (
                        <p key={i} className="pl-2 text-gray-600">
                          -{c.customerName}: {fc(c.amount)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Settlement in printable report */}
              <div className="border-t pt-4 space-y-2">
                <p className="font-bold text-center uppercase tracking-wide">
                  Final Settlement
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs max-w-md mx-auto">
                  <span>Expected remittance</span>
                  <span className="text-right font-semibold">
                    {fc(displaySettlement.expected_remittance)}
                  </span>
                  <span>Cash submitted</span>
                  <span className="text-right font-semibold">
                    {fc(displaySettlement.cash_submitted)}
                  </span>
                  <span>M-Pesa confirmed</span>
                  <span className="text-right">{fc(displaySettlement.mpesa_submitted)}</span>
                  <span>Bank confirmed</span>
                  <span className="text-right">{fc(displaySettlement.bank_submitted)}</span>
                  <span className="font-bold">Variance</span>
                  <span
                    className={cn(
                      'text-right font-bold',
                      displaySettlement.variance < 0 && 'text-red-600',
                      displaySettlement.variance > 0 && 'text-green-700',
                    )}
                  >
                    {displaySettlement.variance >= 0 ? '+' : ''}
                    {fc(displaySettlement.variance)}
                  </span>
                </div>
                {displaySettlement.notes && (
                  <p className="text-xs text-center text-gray-600 italic">
                    Note: {displaySettlement.notes}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
