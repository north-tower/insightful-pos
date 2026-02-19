import { ReceiptData } from '@/data/receiptData';
import { format } from 'date-fns';
import { ReceiptPreview } from './ReceiptPreview';
import { receiptTemplates } from '@/data/receiptData';

interface KitchenTicketProps {
  receiptData: ReceiptData;
  onPrint?: () => void;
}

export function KitchenTicket({ receiptData, onPrint }: KitchenTicketProps) {
  const kitchenTemplate = receiptTemplates.find((t) => t.type === 'kitchen') || receiptTemplates[3];

  return (
    <div className="kitchen-ticket">
      <ReceiptPreview
        receiptData={receiptData}
        template={kitchenTemplate}
        onPrint={onPrint}
        showActions={!!onPrint}
      />
    </div>
  );
}


