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
import { AssignmentDailyReportPrint } from '@/components/reports/AssignmentDailyReportPrint';
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

            <div className="rounded-lg border border-[#D4AF37]/40 overflow-hidden shadow-sm">
              <AssignmentDailyReportPrint
                report={report}
                displaySettlement={displaySettlement}
              />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
