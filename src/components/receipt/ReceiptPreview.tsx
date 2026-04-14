import { ReceiptData, ReceiptTemplate } from '@/data/receiptData';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Printer, Mail, MessageSquare, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fc } from '@/lib/currency';
import { useCompanySettings } from '@/context/BusinessSettingsContext';

interface ReceiptPreviewProps {
  receiptData: ReceiptData;
  template: ReceiptTemplate;
  onClose?: () => void;
  onPrint?: () => void;
  onEmail?: () => void;
  onSMS?: () => void;
  showActions?: boolean;
}

export function ReceiptPreview({
  receiptData,
  template,
  onClose,
  onPrint,
  onEmail,
  onSMS,
  showActions = true,
}: ReceiptPreviewProps) {
  const { settings: company } = useCompanySettings();
  const amountOnly = (value: number) =>
    fc(value).replace(/^([A-Za-z]{2,4}|\p{Sc})\s*/u, '');
  const dateTimeOneLine = `${format(receiptData.date, 'dd/MM/yy')}\u00A0${format(receiptData.date, 'HH:mm')}`;

  const renderCompact = () => (
    <div className="space-y-2 text-[10px] leading-tight thermal-58">
      {/* Header */}
      <div className="text-center border-b border-dashed pb-2">
        <h2 className="font-bold text-[13px]">{company.fullName}</h2>
        <p className="text-[10px] text-black">{company.address}</p>
        <p className="text-[10px] text-black">{company.city}</p>
      </div>

      {/* Order Info */}
      <div className="space-y-0.5">
        <div className="flex justify-between">
          <span className="text-black">Order #{receiptData.orderNumber}</span>
          <span className="whitespace-nowrap">{dateTimeOneLine}</span>
        </div>
        {receiptData.tableNumber && (
          <div className="flex justify-between">
            <span className="text-black">Table:</span>
            <span>#{receiptData.tableNumber}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="border-t border-dashed pt-2 font-mono">
        <div className="grid grid-cols-[18px_minmax(0,1fr)_44px_56px] gap-x-0.5 text-[9px] font-bold uppercase tracking-wide border-b border-dashed pb-1 mb-1">
          <span>Qty</span>
          <span>Item</span>
          <span className="text-right">@Price</span>
          <span className="text-right">Amount</span>
        </div>
        <div className="space-y-1">
          {receiptData.items.map((item, index) => (
            <div key={index} className="space-y-0.5">
              <div className="grid grid-cols-[18px_minmax(0,1fr)_44px_56px] gap-x-0.5 text-[10px] items-start">
                <span className="tabular-nums">{item.quantity}</span>
                <span className="font-medium leading-tight uppercase whitespace-normal break-words">{item.name}</span>
                <span className="text-right tabular-nums">{amountOnly(item.price)}</span>
                <span className="text-right font-medium tabular-nums">
                  {amountOnly(item.price * item.quantity)}
                </span>
              </div>
              {item.notes && (
                <p className="text-black italic text-[9px] pl-[18px] break-words">Note: {item.notes}</p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t border-dashed pt-2 space-y-1">
        <div className="flex justify-between">
          <span>Subtotal:</span>
          <span>{fc(receiptData.subtotal)}</span>
        </div>
        {receiptData.discount && (
          <div className="flex justify-between text-success">
            <span>Discount:</span>
            <span>-{fc(receiptData.discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-base border-t border-dashed pt-1">
          <span>Total:</span>
          <span>{fc(receiptData.total)}</span>
        </div>
      </div>

      {/* Payment */}
      <div className="border-t border-dashed pt-2">
        <div className="flex justify-between text-xs">
          <span className="text-black">Payment:</span>
          <span className="capitalize">{receiptData.paymentMethod}</span>
        </div>
      </div>
    </div>
  );

  const renderStandard = () => (
    <div className="space-y-4 text-sm">
      {/* Header */}
      <div className="text-center border-b pb-4">
        <h2 className="font-bold text-xl">{company.fullName}</h2>
        <p className="text-sm text-muted-foreground mt-1">{company.address}</p>
        <p className="text-sm text-muted-foreground">{company.city}</p>
        <p className="text-sm text-muted-foreground mt-1">{company.phone}</p>
        {company.website && (
          <p className="text-xs text-muted-foreground">{company.website}</p>
        )}
      </div>

      {/* Order Info */}
      <div className="space-y-1">
        <div className="flex justify-between items-start gap-2">
          <span className="font-semibold">Order #{receiptData.orderNumber}</span>
          <span className="whitespace-nowrap">{dateTimeOneLine}</span>
        </div>
        {receiptData.tableNumber && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Table</span>
            <span>#{receiptData.tableNumber}</span>
          </div>
        )}
        {receiptData.customerName && (
          <div>
            <p className="text-muted-foreground">Customer</p>
            <p>{receiptData.customerName}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="border-t border-dashed pt-3 font-mono">
        <div className="grid grid-cols-[20px_minmax(0,1fr)_52px_64px] gap-x-1 text-[9px] font-bold uppercase tracking-wide border-b border-dashed pb-1 mb-2">
          <span>Qty</span>
          <span>Item</span>
          <span className="text-right">@Price</span>
          <span className="text-right">Amount</span>
        </div>
        <div className="space-y-2">
          {receiptData.items.map((item, index) => {
            const itemTotal = item.price * item.quantity;
            return (
              <div key={index} className="space-y-1">
                <div className="grid grid-cols-[20px_minmax(0,1fr)_52px_64px] gap-x-1 text-[10px] items-start">
                  <span className="tabular-nums">{item.quantity}</span>
                  <span className="font-semibold leading-tight uppercase whitespace-normal break-words">{item.name}</span>
                  <span className="text-right tabular-nums">{amountOnly(item.price)}</span>
                  <span className="text-right font-medium tabular-nums">{amountOnly(itemTotal)}</span>
                </div>
                {item.modifiers && item.modifiers.length > 0 && (
                  <div className="pl-[20px] space-y-0.5">
                    {item.modifiers.map((mod) => (
                      <p key={mod.id} className="text-[9px] text-black">
                        {mod.type === 'add-on' && '+'} {mod.name}
                        {mod.price && mod.price > 0 && ` (+${amountOnly(mod.price)})`}
                      </p>
                    ))}
                  </div>
                )}
                {item.notes && (
                  <p className="pl-[20px] text-[9px] text-black italic">Note: {item.notes}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Totals */}
      <div className="border-t pt-3 space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{fc(receiptData.subtotal)}</span>
        </div>
        {receiptData.discount && (
          <div className="flex justify-between text-success">
            <span>Discount</span>
            <span>-{fc(receiptData.discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-xl border-t pt-2 mt-2">
          <span>TOTAL</span>
          <span>{fc(receiptData.total)}</span>
        </div>
      </div>

      {/* Payment */}
      <div className="border-t pt-3 space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Payment Method</span>
          <span className="capitalize">{receiptData.paymentMethod}</span>
        </div>
        {receiptData.splitPayments && receiptData.splitPayments.length > 0 && (
          <div className="ml-4 space-y-1">
            {receiptData.splitPayments.map((payment, idx) => (
              <div key={idx} className="flex justify-between text-xs">
                <span className="capitalize">{payment.method}</span>
                <span>{fc(payment.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t pt-3 text-center text-xs text-black">
        <p>Thank you for dining with us!</p>
        {company.tax_id && <p className="mt-1">Tax ID: {company.tax_id}</p>}
      </div>
    </div>
  );

  const renderKitchenTicket = () => (
    <div className="space-y-3 text-sm">
      {/* Header */}
      <div className="text-center border-b-2 border-foreground pb-3">
        <h2 className="font-bold text-xl">{company.fullName}</h2>
        <p className="font-semibold">KITCHEN TICKET</p>
      </div>

      {/* Order Info */}
      <div className="space-y-1 font-semibold">
        <div className="flex justify-between">
          <span>Order:</span>
          <span>#{receiptData.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span>Time:</span>
          <span>{format(receiptData.date, 'HH:mm')}</span>
        </div>
        {receiptData.tableNumber && (
          <div className="flex justify-between">
            <span>Table:</span>
            <span>#{receiptData.tableNumber}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>Type:</span>
          <span className="uppercase">{receiptData.type.replace('-', ' ')}</span>
        </div>
      </div>

      {/* Items */}
      <div className="border-t-2 border-foreground pt-3 space-y-3">
        {receiptData.items.map((item, index) => (
          <div key={index} className="space-y-1">
            <div className="flex items-center gap-2 font-bold text-base">
              <span className="bg-foreground text-background px-2 py-0.5 rounded">
                {item.quantity}x
              </span>
              <span>{item.name}</span>
            </div>
            {item.modifiers && item.modifiers.length > 0 && (
              <div className="ml-8 space-y-0.5">
                {item.modifiers.map((mod) => (
                  <p key={mod.id} className="text-sm">
                    {mod.type === 'substitution' && 'SUB: '}
                    {mod.type === 'add-on' && 'ADD: '}
                    {mod.name}
                  </p>
                ))}
              </div>
            )}
            {item.notes && (
              <p className="ml-8 text-sm font-semibold italic">NOTE: {item.notes}</p>
            )}
          </div>
        ))}
      </div>

      {/* Special Instructions */}
      {receiptData.orderNotes && (
        <div className="border-t-2 border-foreground pt-3">
          <p className="font-semibold mb-1">Special Instructions:</p>
          <p className="italic">{receiptData.orderNotes}</p>
        </div>
      )}
    </div>
  );

  const renderContent = () => {
    if (template.type === 'kitchen') {
      return renderKitchenTicket();
    }

    switch (template.layout) {
      case 'compact':
        return renderCompact();
      case 'detailed':
        return renderStandard();
      default:
        return renderStandard();
    }
  };

  return (
    <Card className={cn(
      "w-full max-w-md mx-auto",
      template.type === 'kitchen' && "bg-background"
    )}>
      <CardContent className="p-6">
        {/* Actions */}
        {showActions && (
          <div className="flex justify-end gap-2 mb-4 pb-4 border-b">
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            )}
            {onPrint && (
              <Button variant="outline" size="icon" onClick={onPrint}>
                <Printer className="w-4 h-4" />
              </Button>
            )}
            {onEmail && (
              <Button variant="outline" size="icon" onClick={onEmail}>
                <Mail className="w-4 h-4" />
              </Button>
            )}
            {onSMS && (
              <Button variant="outline" size="icon" onClick={onSMS}>
                <MessageSquare className="w-4 h-4" />
              </Button>
            )}
          </div>
        )}

        {/* Receipt Content */}
        <div className={cn(
          "receipt-content",
          template.type === 'kitchen' && "font-mono"
        )}>
          {renderContent()}
        </div>
      </CardContent>
    </Card>
  );
}


