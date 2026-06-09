import { useEffect, useState } from 'react';
import { Loader2, Download, FileText } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAssignmentReport, type AssignmentDailyReportData } from '@/hooks/useAssignmentReport';
import { generateInvoicePdf } from '@/lib/generateInvoicePdf';
import { fc } from '@/lib/currency';
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
    ['Total', '', String(data.totals.quantity), data.totals.salesWorkOut.toFixed(2), String(data.totals.returns), String(data.totals.soldOut), data.totals.moneyReceived.toFixed(2)],
  ];
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
  const [report, setReport] = useState<AssignmentDailyReportData | null>(null);

  useEffect(() => {
    if (!open || !assignmentId) {
      setReport(null);
      return;
    }
    void fetchReport(assignmentId).then(setReport);
  }, [open, assignmentId, fetchReport]);

  const handlePdf = async () => {
    const pdf = await generateInvoicePdf('#assignment-daily-report');
    if (pdf) {
      pdf.save(`route-report-${report?.routeName || 'assignment'}.pdf`);
    } else {
      toast.error('Could not generate PDF');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Daily Sales Report</DialogTitle>
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
                      <td className="border p-1.5 text-right font-semibold">{fc(p.moneyReceived)}</td>
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
                    Net after expenses &amp; discount:{' '}
                    <span className="font-bold">{fc(report.netAfterExpensesAndDiscount)}</span>
                  </p>
                  {report.outstandingCredit.length > 0 && (
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold">Outstanding Credit: -{fc(report.totalOutstandingCredit)}</p>
                      {report.outstandingCredit.map((c, i) => (
                        <p key={i} className="pl-2 text-gray-600">
                          -{c.customerName}: {fc(c.amount)}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
