import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, Mail, Download, FileText, Receipt, Loader2 } from 'lucide-react';
import { InvoicePreview } from './InvoicePreview';
import { ReceiptPreview } from './ReceiptPreview';
import { SendInvoiceEmailDialog } from './SendInvoiceEmailDialog';
import { ReceiptData, receiptTemplates } from '@/data/receiptData';
import { SaleOrder } from '@/hooks/useOrders';
import { Customer } from '@/hooks/useCustomers';
import { cn } from '@/lib/utils';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { generateInvoicePdf } from '@/lib/generateInvoicePdf';

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
  const [isSavingPdf, setIsSavingPdf] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const { settings: companySettings } = useCompanySettings();

  const contentSelector =
    viewMode === 'invoice' ? '.invoice-content' : '.receipt-content';

  const handlePrint = () => {
    const contentElement = document.querySelector(contentSelector);
    if (!contentElement) return;

    const isInvoice = viewMode === 'invoice';
    const title = isInvoice
      ? `Invoice - ${order.invoice_number || order.order_number}`
      : `Receipt - ${order.order_number}`;

    // Gather all stylesheets from the current page so Tailwind classes work
    const styleSheets = Array.from(document.styleSheets);
    let cssText = '';
    styleSheets.forEach((sheet) => {
      try {
        Array.from(sheet.cssRules).forEach((rule) => {
          cssText += rule.cssText + '\n';
        });
      } catch {
        // Cross-origin sheets will throw — skip them
      }
    });

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title}</title>
          <style>
            ${cssText}
            body {
              font-family: ${isInvoice ? "'Inter', 'Segoe UI', Arial, sans-serif" : "'Courier New', monospace"};
              ${isInvoice ? 'padding: 0; max-width: 210mm; margin: 0 auto;' : 'padding: 20px; max-width: 300px; margin: 0 auto;'}
              color: #000;
              background: #fff;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            ${!isInvoice ? `
              body {
                width: 58mm;
                max-width: 58mm;
                padding: 2mm;
                margin: 0 auto;
                font-size: 12px;
                line-height: 1.35;
              }
              body, body * {
                box-sizing: border-box;
                color: #000 !important;
                border-color: #000 !important;
                text-shadow: none !important;
              }
              body {
                width: 54mm;
                max-width: 54mm;
                margin: 0 auto;
                font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif !important;
                font-size: 12px;
                line-height: 1.35;
              }
              body img {
                max-width: 100%;
                height: auto;
              }
              body .text-muted-foreground,
              body .text-gray-400,
              body .text-gray-500,
              body .text-gray-600 {
                color: #000 !important;
              }
              body .text-lg,
              body .text-xl {
                font-size: 16px !important;
                font-weight: 800 !important;
              }
              body .font-bold,
              body .font-semibold {
                font-weight: 700 !important;
              }
              body .break-words {
                word-break: break-word;
                overflow-wrap: anywhere;
              }
            ` : ''}
            /* Force desktop layout for print */
            .hidden.sm\\:block { display: block !important; }
            .sm\\:hidden { display: none !important; }
            .sm\\:flex-row { flex-direction: row !important; }
            .sm\\:justify-between { justify-content: space-between !important; }
            .sm\\:items-start { align-items: flex-start !important; }
            .sm\\:text-right { text-align: right !important; }
            .sm\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
            .sm\\:w-72 { width: 18rem !important; }
            .sm\\:p-8 { padding: 2rem !important; }
            .sm\\:text-2xl { font-size: 1.5rem !important; line-height: 2rem !important; }
            .sm\\:text-3xl { font-size: 1.875rem !important; line-height: 2.25rem !important; }
            .sm\\:text-sm { font-size: 0.875rem !important; line-height: 1.25rem !important; }
            .sm\\:text-base { font-size: 1rem !important; line-height: 1.5rem !important; }
            .sm\\:gap-6 { gap: 1.5rem !important; }
            .sm\\:gap-8 { gap: 2rem !important; }
            .sm\\:gap-4 { gap: 1rem !important; }
            .sm\\:mb-6 { margin-bottom: 1.5rem !important; }
            .sm\\:mb-8 { margin-bottom: 2rem !important; }
            .sm\\:w-24 { width: 6rem !important; }
            .sm\\:mt-3 { margin-top: 0.75rem !important; }
            .sm\\:justify-end { justify-content: flex-end !important; }
            .sm\\:p-4 { padding: 1rem !important; }
            .sm\\:pt-4 { padding-top: 1rem !important; }
            .sm\\:mt-8 { margin-top: 2rem !important; }
            .sm\\:mt-6 { margin-top: 1.5rem !important; }
            .sm\\:text-xs { font-size: 0.75rem !important; line-height: 1rem !important; }
            table { border-collapse: collapse; width: 100%; }
            th, td { text-align: left; }
            @media print {
              body { margin: 0; }
              @page {
                ${isInvoice ? 'size: A4; margin: 15mm;' : 'size: 58mm auto; margin: 0;'}
              }
            }
          </style>
        </head>
        <body>
          ${contentElement.innerHTML}
        </body>
      </html>
    `;

    const isAndroidChrome =
      /Android/i.test(navigator.userAgent) &&
      /Chrome/i.test(navigator.userAgent) &&
      !/Edg|OPR|SamsungBrowser/i.test(navigator.userAgent);

    // Android Chrome (especially installed app/PWA) can ignore direct print calls.
    // Use a dedicated printable tab and avoid auto-close.
    if (isAndroidChrome) {
      const androidHtml = html.replace(
        '</body>',
        `<script>
          window.addEventListener('load', function () {
            setTimeout(function () { try { window.print(); } catch (e) {} }, 700);
          });
        </script></body>`,
      );
      const blob = new Blob([androidHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) {
        window.location.href = url;
        return;
      }
      return;
    }

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 300);
      return;
    }

    // Mobile fallback when popup/new tab is blocked.
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(html);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 800);
    }, 350);
  };

  const handleSavePdf = useCallback(async () => {
    setIsSavingPdf(true);
    try {
      const pdf = await generateInvoicePdf(contentSelector);
      if (!pdf) return;

      const fileName =
        viewMode === 'invoice'
          ? `Invoice-${order.invoice_number || order.order_number}.pdf`
          : `Receipt-${order.order_number}.pdf`;

      pdf.save(fileName);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsSavingPdf(false);
    }
  }, [viewMode, order, contentSelector]);

  const handleEmail = () => {
    setIsEmailDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-3 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              {viewMode === 'invoice' ? (
                <>
                  <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                  Invoice
                </>
              ) : (
                <>
                  <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />
                  Receipt
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              {order.sale_type === 'credit' ? 'Credit Sale' : 'Cash Sale'} — Order
              #{order.order_number}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 sm:space-y-4">
            {/* View Toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">View:</span>
              <div className="flex rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setViewMode('invoice')}
                  className={cn(
                    'px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5',
                    viewMode === 'invoice'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  <FileText className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  Invoice
                </button>
                <button
                  onClick={() => setViewMode('receipt')}
                  className={cn(
                    'px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5',
                    viewMode === 'receipt'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Receipt className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  Receipt
                </button>
              </div>
            </div>

            {/* Preview */}
            <div ref={previewRef} className="border rounded-lg overflow-hidden">
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
            <div className="flex flex-col sm:flex-row gap-2 pt-3 sm:pt-4 border-t">
              <Button variant="outline" onClick={handlePrint} className="flex-1 gap-2 text-xs sm:text-sm">
                <Printer className="w-4 h-4 shrink-0" />
                <span className="truncate">Print {viewMode === 'invoice' ? 'Invoice' : 'Receipt'}</span>
              </Button>
              <Button variant="outline" onClick={handleEmail} className="flex-1 gap-2 text-xs sm:text-sm">
                <Mail className="w-4 h-4 shrink-0" />
                Email
              </Button>
              <Button
                variant="outline"
                onClick={handleSavePdf}
                disabled={isSavingPdf}
                className="flex-1 gap-2 text-xs sm:text-sm"
              >
                {isSavingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                ) : (
                  <Download className="w-4 h-4 shrink-0" />
                )}
                <span className="truncate">{isSavingPdf ? 'Generating...' : 'Save PDF'}</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <SendInvoiceEmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        order={order}
        contentSelector={contentSelector}
        customerEmail={customer?.email || undefined}
        companyName={companySettings.fullName}
      />
    </>
  );
}
