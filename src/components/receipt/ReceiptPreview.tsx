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

  const renderCompact = () => (
    <div className="space-y-3 text-sm">
      {/* Header */}
      <div className="text-center border-b pb-3">
        <h2 className="font-bold text-lg">{company.fullName}</h2>
        <p className="text-xs text-muted-foreground">{company.address}</p>
        <p className="text-xs text-muted-foreground">{company.city}</p>
      </div>

      {/* Order Info */}
      <div className="space-y-1">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Order:</span>
          <span className="font-semibold">#{receiptData.orderNumber}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Date:</span>
          <span>{format(receiptData.date, 'MMM dd, yyyy HH:mm')}</span>
        </div>
        {receiptData.tableNumber && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Table:</span>
            <span>#{receiptData.tableNumber}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="border-t pt-2 space-y-1">
        {receiptData.items.map((item, index) => (
          <div key={index} className="flex justify-between text-xs">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span>{item.quantity}x</span>
                <span className="font-medium">{item.name}</span>
              </div>
              {item.notes && (
                <p className="text-muted-foreground ml-4 italic">Note: {item.notes}</p>
              )}
            </div>
            <span className="font-medium">{fc(item.price * item.quantity)}</span>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="border-t pt-2 space-y-1">
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
        <div className="flex justify-between font-bold text-lg border-t pt-1">
          <span>Total:</span>
          <span>{fc(receiptData.total)}</span>
        </div>
      </div>

      {/* Payment */}
      <div className="border-t pt-2">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Payment:</span>
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
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-muted-foreground">Order #</p>
          <p className="font-semibold">{receiptData.orderNumber}</p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground">Date</p>
          <p>{format(receiptData.date, 'MMM dd, yyyy')}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Time</p>
          <p>{format(receiptData.date, 'HH:mm')}</p>
        </div>
        {receiptData.tableNumber && (
          <div className="text-right">
            <p className="text-muted-foreground">Table</p>
            <p>#{receiptData.tableNumber}</p>
          </div>
        )}
        {receiptData.customerName && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Customer</p>
            <p>{receiptData.customerName}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="border-t pt-3 space-y-3">
        {receiptData.items.map((item, index) => {
          const itemTotal = item.price * item.quantity;
          return (
            <div key={index} className="space-y-1">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.quantity}x</span>
                    <span className="font-semibold">{item.name}</span>
                  </div>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="ml-6 mt-1 space-y-0.5">
                      {item.modifiers.map((mod) => (
                        <p key={mod.id} className="text-xs text-muted-foreground">
                          {mod.type === 'add-on' && '+'} {mod.name}
                          {mod.price && mod.price > 0 && ` (+${fc(mod.price)})`}
                        </p>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <p className="ml-6 text-xs text-muted-foreground italic">Note: {item.notes}</p>
                  )}
                </div>
                <span className="font-medium">{fc(itemTotal)}</span>
              </div>
            </div>
          );
        })}
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
      <div className="border-t pt-3 text-center text-xs text-muted-foreground">
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


