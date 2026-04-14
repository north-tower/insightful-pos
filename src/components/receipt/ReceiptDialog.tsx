import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReceiptPreview } from './ReceiptPreview';
import { ReceiptData, ReceiptTemplate, receiptTemplates } from '@/data/receiptData';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Printer, Mail, MessageSquare } from 'lucide-react';
import { DigitalReceiptDialog } from './DigitalReceiptDialog';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptData: ReceiptData;
  defaultTemplate?: ReceiptTemplate;
}

export function ReceiptDialog({ open, onOpenChange, receiptData, defaultTemplate }: ReceiptDialogProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<ReceiptTemplate>(
    defaultTemplate || receiptTemplates[0]
  );
  const [isDigitalDialogOpen, setIsDigitalDialogOpen] = useState(false);
  const [digitalType, setDigitalType] = useState<'email' | 'sms'>('email');

  const handlePrint = () => {
    const receiptElement = document.querySelector('.receipt-content');
    if (!receiptElement) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${receiptData.orderNumber}</title>
          <style>
            body {
              font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;
              padding: 2mm;
              width: 58mm;
              max-width: 58mm;
              margin: 0 auto;
              font-size: 12px;
              line-height: 1.35;
              color: #000;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            body, body * {
              color: #000 !important;
              border-color: #000 !important;
              text-shadow: none !important;
            }
            @media print {
              body { margin: 0; padding: 2mm; }
              @page { size: 58mm auto; margin: 0; }
            }
            ${receiptElement.innerHTML.includes('KITCHEN TICKET') ? `
              body { font-family: monospace; }
              .border-foreground { border-color: #000 !important; }
            ` : ''}
          </style>
        </head>
        <body>
          ${receiptElement.innerHTML}
        </body>
      </html>
    `;

    const isAndroidChrome =
      /Android/i.test(navigator.userAgent) &&
      /Chrome/i.test(navigator.userAgent) &&
      !/Edg|OPR|SamsungBrowser/i.test(navigator.userAgent);

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
      }, 250);
      return;
    }

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
    }, 300);
  };

  const handleEmail = () => {
    setDigitalType('email');
    setIsDigitalDialogOpen(true);
  };

  const handleSMS = () => {
    setDigitalType('sms');
    setIsDigitalDialogOpen(true);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Receipt Preview</DialogTitle>
            <DialogDescription>
              Order #{receiptData.orderNumber}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Template Selection */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Template:</label>
              <Select
                value={selectedTemplate.id}
                onValueChange={(value) => {
                  const template = receiptTemplates.find((t) => t.id === value);
                  if (template) setSelectedTemplate(template);
                }}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {receiptTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Receipt Preview */}
            <div className="border rounded-lg p-4 bg-background">
              <ReceiptPreview
                receiptData={receiptData}
                template={selectedTemplate}
                showActions={false}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handlePrint} className="flex-1 gap-2">
                <Printer className="w-4 h-4" />
                Print
              </Button>
              <Button variant="outline" onClick={handleEmail} className="flex-1 gap-2">
                <Mail className="w-4 h-4" />
                Email
              </Button>
              <Button variant="outline" onClick={handleSMS} className="flex-1 gap-2">
                <MessageSquare className="w-4 h-4" />
                SMS
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <DigitalReceiptDialog
        open={isDigitalDialogOpen}
        onOpenChange={setIsDigitalDialogOpen}
        receiptData={receiptData}
        type={digitalType}
      />
    </>
  );
}

