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
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const receiptElement = document.querySelector('.receipt-content');
    if (!receiptElement) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${receiptData.orderNumber}</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              padding: 20px;
              max-width: 300px;
              margin: 0 auto;
            }
            @media print {
              body { margin: 0; padding: 10px; }
              @page { size: auto; margin: 0; }
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
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
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

