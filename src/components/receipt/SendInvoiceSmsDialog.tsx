import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { SaleOrder } from '@/hooks/useOrders';
import { Customer } from '@/hooks/useCustomers';
import { Money } from '@/components/ui/Money';
import {
  estimateInvoiceSmsBalances,
  sendInvoiceNotificationSms,
} from '@/lib/sendSms';
import { buildInvoiceCreatedCustomerMessage } from '@/lib/smsMessages';

interface SendInvoiceSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SaleOrder;
  customer?: Customer | null;
  companyName?: string;
}

export function SendInvoiceSmsDialog({
  open,
  onOpenChange,
  order,
  customer,
  companyName,
}: SendInvoiceSmsDialogProps) {
  const [mobile, setMobile] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const invoiceNumber = order.invoice_number || order.order_number;
  const shopName = companyName?.trim() || 'Main store';

  const messagePreview = useMemo(() => {
    const { previousBalance, overallBalance } = estimateInvoiceSmsBalances(
      order,
      customer?.credit_balance,
    );
    return buildInvoiceCreatedCustomerMessage(
      order,
      shopName,
      previousBalance,
      overallBalance,
      order.consignment_info,
    );
  }, [order, customer?.credit_balance, shopName]);

  useEffect(() => {
    if (open) {
      setMobile(order.customer_phone || customer?.phone || '');
      setStatus('idle');
      setStatusMessage('');
    }
  }, [open, order.customer_phone, customer?.phone]);

  const handleSend = async () => {
    setIsSending(true);
    setStatus('idle');
    setStatusMessage('');

    const result = await sendInvoiceNotificationSms(
      mobile,
      order,
      shopName,
      customer?.credit_balance,
    );

    setIsSending(false);

    if (result.ok) {
      setStatus('success');
      toast.success(`Invoice SMS sent to ${mobile.trim()}`);
      setTimeout(() => onOpenChange(false), 1500);
      return;
    }

    setStatus('error');
    setStatusMessage(result.error || 'Failed to send SMS');
    toast.error(result.error || 'Failed to send SMS');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Send invoice SMS
          </DialogTitle>
          <DialogDescription>
            Send the credit-invoice text for #{invoiceNumber}. Change the number to test on your
            own phone — the customer is not notified unless you use their number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="invoice-sms-mobile">Mobile number</Label>
            <Input
              id="invoice-sms-mobile"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="07XXXXXXXX or 2547XXXXXXXX"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSend();
              }}
              className="mt-1.5"
              disabled={isSending || status === 'success'}
            />
          </div>

          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <p className="text-sm text-muted-foreground">Invoice #{invoiceNumber}</p>
            {order.customer_name && (
              <p className="text-sm text-muted-foreground">Customer on invoice: {order.customer_name}</p>
            )}
            <p className="text-sm font-medium">
              Total: <Money value={order.total} />
            </p>
          </div>

          <div>
            <Label htmlFor="invoice-sms-preview">Message preview</Label>
            <textarea
              id="invoice-sms-preview"
              readOnly
              value={messagePreview}
              className="mt-1.5 flex min-h-[120px] w-full rounded-md border border-input bg-muted/30 px-3 py-2 text-xs font-mono text-foreground"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Account balances use today&apos;s customer balance when available; figures may differ
              from the original send.
            </p>
          </div>

          {status === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              SMS sent successfully.
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {statusMessage}
            </div>
          )}

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isSending}
            >
              {status === 'success' ? 'Close' : 'Cancel'}
            </Button>
            <Button
              onClick={() => void handleSend()}
              disabled={isSending || !mobile.trim() || status === 'success'}
              className="flex-1 gap-2"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isSending ? 'Sending…' : 'Send SMS'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
