import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Mail, Download, FileText, Receipt } from 'lucide-react';
import { InvoicePreview } from './InvoicePreview';
import { ReceiptPreview } from './ReceiptPreview';
import { ReceiptData, receiptTemplates } from '@/data/receiptData';
import { SaleOrder } from '@/hooks/useOrders';
import { Customer } from '@/hooks/useCustomers';
import { cn } from '@/lib/utils';
import { DigitalReceiptDialog } from './DigitalReceiptDialog';

type ViewMode = 'invoice' | 'receipt';

interface InvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SaleOrder;
  customer?: Customer | null;
  receiptData?: ReceiptData;
  defaultView?: ViewMode;
}

export function InvoiceDialog({
  open,
  onOpenChange,
  order,
  customer,
  receiptData,
  defaultView = 'invoice',
}: InvoiceDialogProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(defaultView);
  const [isDigitalDialogOpen, setIsDigitalDialogOpen] = useState(false);
  const [digitalType, setDigitalType] = useState<'email' | 'sms'>('email');

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const contentSelector =
      viewMode === 'invoice' ? '.invoice-content' : '.receipt-content';
    const contentElement = document.querySelector(contentSelector);
    if (!contentElement) return;

    const isInvoice = viewMode === 'invoice';
    const title = isInvoice
      ? `Invoice - ${order.invoice_number || order.order_number}`
      : `Receipt - ${order.order_number}`;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body {
              font-family: ${isInvoice ? "'Inter', 'Segoe UI', Arial, sans-serif" : "'Courier New', monospace"};
              ${isInvoice ? 'padding: 0; max-width: 210mm; margin: 0 auto;' : 'padding: 20px; max-width: 300px; margin: 0 auto;'}
              color: #000;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            table { border-collapse: collapse; width: 100%; }
            th, td { text-align: left; }
            @media print {
              body { margin: 0; }
              @page {
                ${isInvoice ? 'size: A4; margin: 15mm;' : 'size: auto; margin: 0;'}
              }
            }
          </style>
        </head>
        <body>
          ${contentElement.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };

  const handleEmail = () => {
    setDigitalType('email');
    setIsDigitalDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewMode === 'invoice' ? (
                <>
                  <FileText className="w-5 h-5" />
                  Invoice
                </>
              ) : (
                <>
                  <Receipt className="w-5 h-5" />
                  Receipt
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {order.sale_type === 'credit' ? 'Credit Sale' : 'Cash Sale'} — Order
              #{order.order_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">View:</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setViewMode('invoice')}
                  className={cn(
                    'px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5',
                    viewMode === 'invoice'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  <FileText className="w-3.5 h-3.5" />
                  Invoice
                </button>
                <button
                  onClick={() => setViewMode('receipt')}
                  className={cn(
                    'px-4 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5',
                    viewMode === 'receipt'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Receipt
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="border rounded-lg overflow-hidden">
              {viewMode === 'invoice' ? (
                <InvoicePreview order={order} customer={customer} />
              ) : receiptData ? (
                <div className="p-4 bg-background">
                  <ReceiptPreview
                    receiptData={receiptData}
                    template={receiptTemplates[0]}
                    showActions={false}
                  />
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  Receipt data not available. Use invoice view.
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handlePrint} className="flex-1 gap-2">
                <Printer className="w-4 h-4" />
                Print {viewMode === 'invoice' ? 'Invoice' : 'Receipt'}
              </Button>
              <Button variant="outline" onClick={handleEmail} className="flex-1 gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Button>
              <Button
                variant="outline"
                onClick={handlePrint}
                className="flex-1 gap-2"
              >
                <Download className="w-4 h-4" />
                Save PDF
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {receiptData && (
        <DigitalReceiptDialog
          open={isDigitalDialogOpen}
          onOpenChange={setIsDigitalDialogOpen}
          receiptData={receiptData}
          type={digitalType}
        />
      )}
    </>
  );
}
