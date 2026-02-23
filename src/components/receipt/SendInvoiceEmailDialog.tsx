import { useState, useEffect } from 'react';
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
import { Mail, Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { generateInvoicePdfBase64 } from '@/lib/generateInvoicePdf';
import { fc } from '@/lib/currency';
import { SaleOrder } from '@/hooks/useOrders';

interface SendInvoiceEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: SaleOrder;
  /** CSS selector for the content element to capture as PDF (e.g. '.invoice-content') */
  contentSelector: string;
  customerEmail?: string;
  companyName?: string;
}

export function SendInvoiceEmailDialog({
  open,
  onOpenChange,
  order,
  contentSelector,
  customerEmail,
  companyName,
}: SendInvoiceEmailDialogProps) {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const invoiceNumber = order.invoice_number || order.order_number;

  // Pre-fill email and subject when dialog opens
  useEffect(() => {
    if (open) {
      setEmail(customerEmail || order.customer_email || '');
      setSubject(
        `Invoice ${invoiceNumber} from ${companyName || 'Us'} — ${fc(order.total)}`,
      );
      setStatus('idle');
      setStatusMessage('');
    }
  }, [open, customerEmail, order, invoiceNumber, companyName]);

  const handleSend = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSending(true);
    setStatus('idle');
    setStatusMessage('Generating PDF…');

    try {
      // 1. Generate the PDF from the invoice DOM element
      const pdfBase64 = await generateInvoicePdfBase64(contentSelector);

      if (!pdfBase64) {
        throw new Error('Could not generate PDF. Make sure the invoice is visible.');
      }

      setStatusMessage('Sending email…');

      // 2. Send via the Supabase Edge Function
      const pdfFilename = `Invoice-${invoiceNumber}.pdf`;

      const { data, error } = await supabase.functions.invoke(
        'send-invoice-email',
        {
          body: {
            to: email.trim(),
            subject: subject.trim(),
            html: `
              <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
                <h2 style="margin: 0 0 16px;">Invoice ${invoiceNumber}</h2>
                <p>Hi,</p>
                <p>Please find your invoice attached as a PDF.</p>
                <table style="margin: 16px 0; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 4px 16px 4px 0; color: #666;">Invoice #:</td>
                    <td style="padding: 4px 0; font-weight: 600;">${invoiceNumber}</td>
                  </tr>
                  <tr>
                    <td style="padding: 4px 16px 4px 0; color: #666;">Total:</td>
                    <td style="padding: 4px 0; font-weight: 600;">${fc(order.total)}</td>
                  </tr>
                </table>
                <p>Thank you for your business!</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
                <p style="font-size: 12px; color: #888;">${companyName || ''}</p>
              </div>
            `.trim(),
            pdfBase64,
            pdfFilename,
          },
        },
      );

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      setStatus('success');
      setStatusMessage('');
      toast.success(`Invoice sent to ${email.trim()}`);

      // Close after a short delay so user sees the success state
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (err: any) {
      console.error('Failed to send invoice email:', err);
      setStatus('error');
      setStatusMessage(err.message || 'Failed to send invoice email');
      toast.error(err.message || 'Failed to send invoice email');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Email Invoice
          </DialogTitle>
          <DialogDescription>
            Send invoice #{invoiceNumber} as a PDF attachment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipient */}
          <div>
            <Label htmlFor="invoice-email">Recipient Email</Label>
            <Input
              id="invoice-email"
              type="email"
              placeholder="customer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
              className="mt-1.5"
              disabled={isSending || status === 'success'}
            />
          </div>

          {/* Subject */}
          <div>
            <Label htmlFor="invoice-subject">Subject</Label>
            <Input
              id="invoice-subject"
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1.5"
              disabled={isSending || status === 'success'}
            />
          </div>

          {/* Order summary */}
          <div className="p-3 bg-muted/50 rounded-lg space-y-1">
            <p className="text-sm text-muted-foreground">
              Invoice #{invoiceNumber}
            </p>
            {order.customer_name && (
              <p className="text-sm text-muted-foreground">
                Customer: {order.customer_name}
              </p>
            )}
            <p className="text-sm font-medium">Total: {fc(order.total)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              📎 Invoice PDF will be attached
            </p>
          </div>

          {/* Status messages */}
          {isSending && statusMessage && (
            <div className="flex items-center gap-2 p-3 bg-blue-50 text-blue-700 rounded-lg text-sm">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              {statusMessage}
            </div>
          )}
          {status === 'success' && (
            <div className="flex items-center gap-2 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Invoice sent successfully!
            </div>
          )}
          {status === 'error' && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {statusMessage || 'Failed to send. Check your Resend configuration.'}
            </div>
          )}

          {/* Actions */}
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
              onClick={handleSend}
              disabled={isSending || !email.trim() || status === 'success'}
              className="flex-1 gap-2"
            >
              {isSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {isSending ? 'Sending...' : 'Send Invoice'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
