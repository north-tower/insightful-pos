import { format } from 'date-fns';
import { SaleOrder } from '@/hooks/useOrders';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import { Customer } from '@/hooks/useCustomers';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { fc } from '@/lib/currency';

interface InvoicePreviewProps {
  order: SaleOrder;
  customer?: Customer | null;
}

export function InvoicePreview({ order, customer }: InvoicePreviewProps) {
  const { settings: company } = useCompanySettings();
  const invoiceNumber = order.invoice_number || order.order_number;
  const isCreditSale = order.sale_type === 'credit';
  const isPaid = order.payment_status === 'paid';
  const isVoided = order.status === 'voided' || order.payment_status === 'voided';
  const totalPaid = order.payments.reduce((sum, p) => sum + p.amount, 0);
  const balanceDue = Math.max(order.total - totalPaid, 0);

  const customerName = customer
    ? `${customer.first_name} ${customer.last_name}`.trim()
    : order.customer_name || '';

  // Account balance breakdown for credit sales.
  // The DB trigger already added this order's total to credit_balance on insert,
  // and we refetch the customer after order creation, so credit_balance is current.
  // overall = customer.credit_balance (includes this invoice)
  // previous = overall − (this invoice's unpaid balance)
  const overallBalance = customer?.credit_balance ?? 0;
  const previousBalance = overallBalance - balanceDue;

  return (
    <div className="invoice-content bg-white text-black p-4 sm:p-8 max-w-[210mm] mx-auto font-sans text-sm leading-relaxed print:p-6">
      {/* ── Header: Company + Invoice title ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 sm:gap-6 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
            {company.fullName}
          </h1>
          <p className="text-gray-500 mt-1 text-xs sm:text-sm">{company.address}</p>
          <p className="text-gray-500 text-xs sm:text-sm">{company.city}</p>
          <p className="text-gray-500 mt-1 text-xs sm:text-sm">Tel: {company.phone}</p>
          {company.email && (
            <p className="text-gray-500 text-xs sm:text-sm">{company.email}</p>
          )}
          {company.website && (
            <p className="text-gray-500 text-xs sm:text-sm">{company.website}</p>
          )}
        </div>

        <div className="sm:text-right">
          <h2 className="text-xl sm:text-3xl font-extrabold tracking-tight text-gray-900 uppercase">
            {isCreditSale ? 'Invoice' : 'Sales Invoice'}
          </h2>
          <div className="mt-2 sm:mt-3 space-y-1">
            <div className="flex sm:justify-end gap-2 sm:gap-4">
              <span className="text-gray-500 font-medium text-xs sm:text-sm">Invoice #:</span>
              <span className="font-bold text-gray-900 text-xs sm:text-sm">{invoiceNumber}</span>
            </div>
            <div className="flex sm:justify-end gap-2 sm:gap-4">
              <span className="text-gray-500 font-medium text-xs sm:text-sm">Order #:</span>
              <span className="font-semibold text-gray-700 text-xs sm:text-sm">{order.order_number}</span>
            </div>
            <div className="flex sm:justify-end gap-2 sm:gap-4">
              <span className="text-gray-500 font-medium text-xs sm:text-sm">Date:</span>
              <span className="text-gray-700 text-xs sm:text-sm">
                {format(new Date(order.created_at), 'MMM dd, yyyy')}
              </span>
            </div>
            {order.due_date && (
              <div className="flex sm:justify-end gap-2 sm:gap-4">
                <span className="text-gray-500 font-medium text-xs sm:text-sm">Due Date:</span>
                <span className="text-gray-700 text-xs sm:text-sm">
                  {format(new Date(order.due_date), 'MMM dd, yyyy')}
                </span>
              </div>
            )}
          </div>

          {/* Status Badge */}
          <div className="mt-2 sm:mt-3">
            {isVoided ? (
              <span className="inline-block px-3 py-1 bg-red-100 text-red-700 text-xs font-bold rounded uppercase tracking-wider">
                VOIDED
              </span>
            ) : isPaid ? (
              <span className="inline-block px-3 py-1 bg-green-100 text-green-700 text-xs font-bold rounded uppercase tracking-wider">
                PAID
              </span>
            ) : isCreditSale ? (
              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-700 text-xs font-bold rounded uppercase tracking-wider">
                {order.payment_status === 'partial' ? 'PARTIALLY PAID' : 'CREDIT — UNPAID'}
              </span>
            ) : (
              <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded uppercase tracking-wider">
                CASH SALE
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Divider ───────────────────────────────────────────────────── */}
      <div className="border-t-2 border-gray-900 mb-4 sm:mb-6" />

      {/* ── Bill To / Sale Details ────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-6 sm:mb-8">
        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Bill To
          </h3>
          {customerName ? (
            <div>
              <p className="font-bold text-gray-900 text-sm sm:text-base">{customerName}</p>
              {customer?.email && (
                <p className="text-gray-600 text-xs sm:text-sm">{customer.email}</p>
              )}
              {customer?.phone && (
                <p className="text-gray-600 text-xs sm:text-sm">{customer.phone}</p>
              )}
              {customer?.address && (
                <p className="text-gray-600 mt-1 text-xs sm:text-sm">
                  {customer.address}
                  {customer.city && (
                    <>
                      <br />
                      {customer.city}
                      {customer.postal_code && `, ${customer.postal_code}`}
                      {customer.country && ` ${customer.country}`}
                    </>
                  )}
                </p>
              )}
              {isCreditSale && customer && (
                <p className="text-gray-500 mt-2 text-xs">
                  Previous Balance: <span className="font-bold text-amber-600">{fc(previousBalance)}</span>
                </p>
              )}
            </div>
          ) : (
            <p className="text-gray-400 italic text-xs sm:text-sm">Walk-in Customer</p>
          )}
        </div>

        <div>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
            Sale Details
          </h3>
          <div className="space-y-1 text-gray-700 text-xs sm:text-sm">
            <div className="flex gap-2 sm:gap-4">
              <span className="text-gray-500 w-20 sm:w-24 shrink-0">Sale Type:</span>
              <span className="font-medium capitalize">{order.sale_type || 'cash'}</span>
            </div>
            <div className="flex gap-2 sm:gap-4">
              <span className="text-gray-500 w-20 sm:w-24 shrink-0">Order Type:</span>
              <span className="font-medium capitalize">
                {order.order_type.replace('-', ' ')}
              </span>
            </div>
            {order.table_number && (
              <div className="flex gap-2 sm:gap-4">
                <span className="text-gray-500 w-20 sm:w-24 shrink-0">Table:</span>
                <span className="font-medium">#{order.table_number}</span>
              </div>
            )}
            {order.staff_name && (
              <div className="flex gap-2 sm:gap-4">
                <span className="text-gray-500 w-20 sm:w-24 shrink-0">Served By:</span>
                <span className="font-medium">{order.staff_name}</span>
              </div>
            )}
            {order.consignment_info && (
              <div className="flex gap-2 sm:gap-4">
                <span className="text-gray-500 w-20 sm:w-24 shrink-0">Consignment:</span>
                <span className="font-medium">{order.consignment_info}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Items — Desktop Table / Mobile Cards ───────────────────────── */}

      {/* Desktop table (hidden on mobile) */}
      <div className="hidden sm:block mb-6">
        <table className="w-full">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 text-xs font-bold text-gray-500 uppercase tracking-wider w-8">
                #
              </th>
              <th className="text-left py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                Item
              </th>
              {order.items.some((i) => i.sku) && (
                <th className="text-left py-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  SKU
                </th>
              )}
              <th className="text-center py-2 text-xs font-bold text-gray-500 uppercase tracking-wider w-16">
                Qty
              </th>
              <th className="text-right py-2 text-xs font-bold text-gray-500 uppercase tracking-wider w-24">
                Unit Price
              </th>
              <th className="text-right py-2 text-xs font-bold text-gray-500 uppercase tracking-wider w-28">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item, idx) => (
              <tr
                key={item.id}
                className={cn(
                  'border-b border-gray-200',
                  idx % 2 === 0 ? 'bg-white' : 'bg-gray-50',
                )}
              >
                <td className="py-3 text-gray-500 text-xs">{idx + 1}</td>
                <td className="py-3">
                  <p className="font-semibold text-gray-900">{item.product_name}</p>
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="mt-0.5">
                      {item.modifiers.map((mod, mi) => (
                        <p key={mi} className="text-xs text-gray-500">
                          + {mod.name}
                          {mod.price && mod.price > 0
                            ? ` (${fc(mod.price)})`
                            : ''}
                        </p>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-xs text-gray-400 italic mt-0.5">
                      Note: {item.notes}
                    </p>
                  )}
                </td>
                {order.items.some((i) => i.sku) && (
                  <td className="py-3 text-gray-600 text-xs font-mono">
                    {item.sku || '—'}
                  </td>
                )}
                <td className="py-3 text-center text-gray-700">{item.quantity}</td>
                <td className="py-3 text-right text-gray-700">
                  {fc(item.unit_price)}
                </td>
                <td className="py-3 text-right font-semibold text-gray-900">
                  {fc(item.line_total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile item cards (hidden on desktop) */}
      <div className="sm:hidden mb-4">
        <div className="border-b-2 border-gray-900 pb-1 mb-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Items</h3>
        </div>
        <div className="space-y-2">
          {order.items.map((item, idx) => (
            <div
              key={item.id}
              className={cn(
                'p-3 rounded border border-gray-200',
                idx % 2 === 0 ? 'bg-white' : 'bg-gray-50',
              )}
            >
              <div className="flex justify-between items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 text-xs">{item.product_name}</p>
                  {item.sku && (
                    <p className="text-[10px] text-gray-400 font-mono mt-0.5">SKU: {item.sku}</p>
                  )}
                  {item.modifiers && item.modifiers.length > 0 && (
                    <div className="mt-0.5">
                      {item.modifiers.map((mod, mi) => (
                        <p key={mi} className="text-[10px] text-gray-500">
                          + {mod.name}{mod.price && mod.price > 0 ? ` (${fc(mod.price)})` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-[10px] text-gray-400 italic mt-0.5">Note: {item.notes}</p>
                  )}
                </div>
                <p className="font-semibold text-gray-900 text-xs tabular-nums shrink-0">
                  {fc(item.line_total)}
                </p>
              </div>
              <div className="flex justify-between mt-1 text-[10px] text-gray-500">
                <span>{fc(item.unit_price)} × {item.quantity}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Totals ────────────────────────────────────────────────────── */}
      <div className="flex justify-end mb-6 sm:mb-8">
        <div className="w-full sm:w-72">
          <div className="space-y-2">
            {order.discount_amount > 0 && (
              <>
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span>{fc(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-{fc(order.discount_amount)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between font-bold text-xl text-gray-900 border-t-2 border-gray-900 pt-2 mt-2">
              <span>Total</span>
              <span>{fc(order.total)}</span>
            </div>

            {/* Payment info */}
            {order.payments.length > 0 && (
              <div className="border-t border-gray-200 pt-2 mt-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Payments
                </p>
                {order.payments.map((payment, idx) => (
                  <div key={idx} className="text-gray-600 text-sm mb-1">
                    <div className="flex justify-between">
                      <span className="capitalize">
                        {payment.method}
                        {payment.reference ? ` (${payment.reference})` : ''}
                      </span>
                      <span>{fc(payment.amount)}</span>
                    </div>
                    {payment.description && (
                      <p className="text-xs text-gray-500">{payment.description}</p>
                    )}
                  </div>
                ))}
                <div className="flex justify-between text-gray-500 text-sm mt-1">
                  <span>Total Paid</span>
                  <span className="font-semibold">{fc(totalPaid)}</span>
                </div>
              </div>
            )}

            {/* Balance due for credit sales */}
            {isCreditSale && balanceDue > 0 && (
              <div className="flex justify-between font-bold text-lg text-amber-600 border-t-2 border-amber-400 pt-2 mt-2">
                <span>Balance Due</span>
                <span>{fc(balanceDue)}</span>
              </div>
            )}

            {/* Overall Account Balance for credit sales */}
            {isCreditSale && customer && (
              <div className="border-t-2 border-gray-300 pt-3 mt-3 space-y-1.5">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Account Summary
                </p>
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>Previous Balance</span>
                  <span>{fc(previousBalance)}</span>
                </div>
                <div className="flex justify-between text-gray-600 text-sm">
                  <span>This Invoice</span>
                  <span>+ {fc(balanceDue)}</span>
                </div>
                {totalPaid > 0 && (
                  <div className="flex justify-between text-green-600 text-sm">
                    <span>Payments Received</span>
                    <span>− {fc(totalPaid)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base text-red-700 border-t border-gray-400 pt-2 mt-1">
                  <span>Overall Account Balance</span>
                  <span>{fc(overallBalance)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────── */}
      {order.notes && (
        <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-gray-50 rounded border border-gray-200">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
            Notes
          </h3>
          <p className="text-gray-700 text-xs sm:text-sm">{order.notes}</p>
        </div>
      )}

      {/* ── Terms & Footer ────────────────────────────────────────────── */}
      <div className="border-t border-gray-300 pt-3 sm:pt-4 mt-6 sm:mt-8">
        {isCreditSale && (
          <div className="mb-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Terms & Conditions
            </h3>
            <p className="text-xs text-gray-500">
              Payment is due within 30 days of the invoice date. Late payments may
              be subject to a 1.5% monthly finance charge. Please include the
              invoice number with your payment.
            </p>
          </div>
        )}

        <div className="text-center text-[10px] sm:text-xs text-gray-400 mt-4 sm:mt-6 space-y-1">
          <p>Thank you for your business!</p>
          {company.tax_id && <p>Tax ID: {company.tax_id}</p>}
          <p>
            {company.fullName} • {company.address} • {company.city}
          </p>
        </div>
      </div>
    </div>
  );
}
