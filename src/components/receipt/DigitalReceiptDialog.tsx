import { useState } from 'react';
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
import { ReceiptData } from '@/data/receiptData';
import { Mail, MessageSquare, Send } from 'lucide-react';
import { toast } from 'sonner';

interface DigitalReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receiptData: ReceiptData;
  type: 'email' | 'sms';
}

export function DigitalReceiptDialog({
  open,
  onOpenChange,
  receiptData,
  type,
}: DigitalReceiptDialogProps) {
  const [email, setEmail] = useState(receiptData.customerName ? '' : '');
  const [phone, setPhone] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (type === 'email' && !email) {
      toast.error('Please enter an email address');
      return;
    }
    if (type === 'sms' && !phone) {
      toast.error('Please enter a phone number');
      return;
    }

    setIsSending(true);

    // Simulate API call
    setTimeout(() => {
      setIsSending(false);
      toast.success(
        type === 'email'
          ? `Receipt sent to ${email}`
          : `Receipt sent to ${phone}`
      );
      onOpenChange(false);
      if (type === 'email') {
        setEmail('');
      } else {
        setPhone('');
      }
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'email' ? (
              <>
                <Mail className="w-5 h-5" />
                Send Receipt via Email
              </>
            ) : (
              <>
                <MessageSquare className="w-5 h-5" />
                Send Receipt via SMS
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {type === 'email'
              ? 'Enter the email address to send the receipt to'
              : 'Enter the phone number to send the receipt to'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {type === 'email' ? (
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="customer@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSend();
                  }
                }}
                className="mt-2"
              />
            </div>
          ) : (
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSend();
                  }
                }}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Include country code for international numbers
              </p>
            </div>
          )}

          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Receipt for Order #{receiptData.orderNumber}
            </p>
            <p className="text-sm font-medium mt-1">
              Total: ${receiptData.total.toFixed(2)}
            </p>
          </div>

          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending || (type === 'email' ? !email : !phone)}
              className="flex-1 gap-2"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


