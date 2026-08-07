import type { CSSProperties } from 'react';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import type { ShopDayReportData } from '@/hooks/useShopDayReport';
import { expenseCategoryLabel, expensePaymentMethodLabel } from '@/hooks/useOperatingExpenses';
import { fc } from '@/lib/currency';

const BRAND = {
  gold: '#B8860B',
  goldLight: '#D4AF37',
  green: '#1B7A3D',
  greenDark: '#0F5A2A',
  text: '#1a1a1a',
  muted: '#4a4a4a',
} as const;

const thStyle: CSSProperties = {
  backgroundColor: BRAND.green,
  color: '#fff',
  fontWeight: 700,
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  padding: '6px 4px',
  border: `1px solid ${BRAND.greenDark}`,
  whiteSpace: 'nowrap',
};

const cellStyle: CSSProperties = {
  padding: '5px 4px',
  border: '1px solid #c5c5c5',
  fontSize: '11px',
  verticalAlign: 'middle',
};

interface ShopDayReportPrintProps {
  report: ShopDayReportData;
  displaySettlement: {
    opening_float: number;
    closing_float: number;
    expected_cash: number;
    expected_mpesa: number;
    expected_bank: number;
    cash_counted: number;
    mpesa_confirmed: number;
    bank_confirmed: number;
    cash_variance: number;
    mpesa_variance: number;
    bank_variance: number;
    notes: string | null;
  };
}

function qty(n: number | null): string {
  if (n === null || Number.isNaN(n)) return '—';
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function ShopDayReportPrint({ report, displaySettlement }: ShopDayReportPrintProps) {
  const { settings, shopLogoUrl, companyName } = useCompanySettings();
  const brandTitle = settings.fullName || companyName || 'Shop Day Report';

  return (
    <div
      id="shop-day-report"
      style={{
        backgroundColor: '#fff',
        color: BRAND.text,
        padding: '24px 28px',
        fontFamily: 'Georgia, "Times New Roman", serif',
        fontSize: '12px',
        lineHeight: 1.45,
        maxWidth: '794px',
        margin: '0 auto',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '12px',
          borderBottom: `2px solid ${BRAND.goldLight}`,
          paddingBottom: '12px',
        }}
      >
        <div style={{ flexShrink: 0, minWidth: '100px' }}>
          {shopLogoUrl ? (
            <img
              src={shopLogoUrl}
              alt={brandTitle}
              style={{ height: '72px', maxWidth: '140px', objectFit: 'contain' }}
            />
          ) : (
            <div style={{ color: BRAND.gold, fontWeight: 700, fontSize: '20px' }}>
              {companyName || brandTitle}
            </div>
          )}
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: BRAND.greenDark }}>
            Shop Day Close
          </div>
          <div style={{ fontSize: '13px', color: BRAND.muted, marginTop: 4 }}>
            {report.storeName} · {report.businessDateLabel}
          </div>
        </div>
        <div style={{ width: 100 }} />
      </div>

      {/* Sales */}
      <h3 style={{ margin: '16px 0 8px', color: BRAND.greenDark, fontSize: 13 }}>
        Sales by payment method
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={thStyle}>Cash</th>
            <th style={thStyle}>M-Pesa</th>
            <th style={thStyle}>Bank</th>
            <th style={thStyle}>Credit outstanding</th>
            <th style={thStyle}>Collected (excl. credit)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, textAlign: 'right' }}>{fc(report.salesBreakdown.cash)}</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>{fc(report.salesBreakdown.mpesa)}</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>{fc(report.salesBreakdown.bank)}</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>
              {fc(report.totalOutstandingCredit)}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>
              {fc(report.salesBreakdown.totalCollected)}
            </td>
          </tr>
        </tbody>
      </table>

      {(report.discountOut > 0 || report.refunds > 0) && (
        <p style={{ fontSize: 11, color: BRAND.muted, marginBottom: 12 }}>
          {report.discountOut > 0 && <>Discounts: {fc(report.discountOut)}. </>}
          {report.refunds > 0 && <>Refunds: {fc(report.refunds)}.</>}
        </p>
      )}

      {/* Expenses */}
      <h3 style={{ margin: '16px 0 8px', color: BRAND.greenDark, fontSize: 13 }}>
        Expenses (shop counter)
      </h3>
      {report.expenses.length === 0 ? (
        <p style={{ fontSize: 11, color: BRAND.muted }}>No shop expenses for this day.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left' }}>Description</th>
              <th style={thStyle}>Category</th>
              <th style={thStyle}>Paid via</th>
              <th style={thStyle}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {report.expenses.map((e) => (
              <tr key={e.id}>
                <td style={{ ...cellStyle, textAlign: 'left' }}>{e.description}</td>
                <td style={cellStyle}>{expenseCategoryLabel(e.category)}</td>
                <td style={cellStyle}>{expensePaymentMethodLabel(e.payment_method)}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{fc(e.amount)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} style={{ ...cellStyle, fontWeight: 700, textAlign: 'right' }}>
                Total · Cash {fc(report.expenseBreakdown.cash)} · M-Pesa{' '}
                {fc(report.expenseBreakdown.mpesa)} · Bank {fc(report.expenseBreakdown.bank)}
              </td>
              <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>
                {fc(report.expenseBreakdown.total)}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      {/* Settlement */}
      <h3 style={{ margin: '16px 0 8px', color: BRAND.greenDark, fontSize: 13 }}>
        Till reconciliation
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left' }}>Channel</th>
            <th style={thStyle}>Expected</th>
            <th style={thStyle}>Actual</th>
            <th style={thStyle}>Variance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ ...cellStyle, textAlign: 'left' }}>
              Cash (float {fc(displaySettlement.opening_float)} →{' '}
              {fc(displaySettlement.closing_float)})
            </td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>
              {fc(displaySettlement.expected_cash)}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>
              {fc(displaySettlement.cash_counted)}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>
              {fc(displaySettlement.cash_variance)}
            </td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, textAlign: 'left' }}>M-Pesa till</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>
              {fc(displaySettlement.expected_mpesa)}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>
              {fc(displaySettlement.mpesa_confirmed)}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>
              {fc(displaySettlement.mpesa_variance)}
            </td>
          </tr>
          <tr>
            <td style={{ ...cellStyle, textAlign: 'left' }}>Bank</td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>
              {fc(displaySettlement.expected_bank)}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right' }}>
              {fc(displaySettlement.bank_confirmed)}
            </td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 700 }}>
              {fc(displaySettlement.bank_variance)}
            </td>
          </tr>
        </tbody>
      </table>

      {displaySettlement.notes && (
        <p style={{ fontSize: 11, marginBottom: 12 }}>
          <strong>Notes:</strong> {displaySettlement.notes}
        </p>
      )}

      {/* Stock movement */}
      <h3 style={{ margin: '16px 0 8px', color: BRAND.greenDark, fontSize: 13 }}>
        Stock movement (system)
      </h3>
      {report.stockMovements.length === 0 ? (
        <p style={{ fontSize: 11, color: BRAND.muted }}>No stock movement recorded for this day.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thStyle, textAlign: 'left' }}>Product</th>
              <th style={thStyle}>Opening</th>
              <th style={thStyle}>In</th>
              <th style={thStyle}>Sold</th>
              <th style={thStyle}>Adj. out</th>
              <th style={thStyle}>Closing</th>
            </tr>
          </thead>
          <tbody>
            {report.stockMovements.map((line) => (
              <tr key={line.productId}>
                <td style={{ ...cellStyle, textAlign: 'left' }}>
                  {line.productName}
                  <span style={{ color: BRAND.muted, fontSize: 10 }}> ({line.unit})</span>
                </td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{qty(line.opening)}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{qty(line.stockIn)}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{qty(line.sold)}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{qty(line.adjustmentsOut)}</td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{qty(line.closing)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
