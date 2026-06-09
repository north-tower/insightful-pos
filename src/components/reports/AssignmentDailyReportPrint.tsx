import type { CSSProperties } from 'react';
import { useCompanySettings } from '@/context/BusinessSettingsContext';
import type { AssignmentDailyReportData } from '@/hooks/useAssignmentReport';
import { fc } from '@/lib/currency';
import { cn } from '@/lib/utils';

/** AFYA GOLD–inspired palette for route daily sales reports */
const BRAND = {
  gold: '#B8860B',
  goldLight: '#D4AF37',
  green: '#1B7A3D',
  greenDark: '#0F5A2A',
  greenTint: '#E8F5E9',
  red: '#C62828',
  redTint: '#FFEBEE',
  blueTint: '#E3F2FD',
  border: '#2E7D32',
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

interface AssignmentDailyReportPrintProps {
  report: AssignmentDailyReportData;
  displaySettlement: {
    expected_remittance: number;
    cash_submitted: number;
    mpesa_submitted: number;
    bank_submitted: number;
    variance: number;
    notes: string | null;
  };
}

function salesWorkOutBg(index: number): string {
  const palette = [BRAND.redTint, '#fff', BRAND.blueTint, '#fff'];
  return palette[index % palette.length];
}

export function AssignmentDailyReportPrint({
  report,
  displaySettlement,
}: AssignmentDailyReportPrintProps) {
  const { settings, shopLogoUrl, companyName } = useCompanySettings();
  const brandTitle = settings.fullName || companyName || 'Daily Sales Report';
  const tagline = settings.tagline || 'Reliable Supply, Trusted Growth.';

  const netFormula = `${fc(report.totalCollectedExCredit)} − ${fc(report.totalExpenses)} − ${fc(report.discountOut)}`;

  return (
    <div
      id="assignment-daily-report"
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
      {/* ── Header ── */}
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
            <div
              style={{
                color: BRAND.gold,
                fontWeight: 700,
                fontSize: '22px',
                letterSpacing: '0.06em',
                lineHeight: 1.1,
              }}
            >
              {(companyName || brandTitle).split(' ').filter(Boolean).map((word, i) => (
                <span key={i} style={{ display: 'block' }}>
                  {word}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ flex: 1, textAlign: 'center' }}>
          <p
            style={{
              margin: 0,
              fontSize: '26px',
              fontWeight: 700,
              color: BRAND.gold,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {companyName}
          </p>
          <p
            style={{
              margin: '6px 0 0',
              fontSize: '14px',
              fontWeight: 800,
              color: BRAND.red,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontFamily: 'Arial, Helvetica, sans-serif',
            }}
          >
            Daily Sales Report Invoice
          </p>
        </div>

        <div style={{ width: '100px', flexShrink: 0 }} />
      </div>

      {/* Route + Date badges */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'center',
          marginBottom: '16px',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        {[
          { label: 'Route', value: `${report.routeName.toUpperCase()} ROUTE` },
          { label: 'Date', value: report.assignmentDateLabel },
        ].map((badge) => (
          <div
            key={badge.label}
            style={{
              border: `2px solid ${BRAND.border}`,
              borderRadius: '4px',
              padding: '6px 16px',
              minWidth: '180px',
              textAlign: 'center',
              backgroundColor: BRAND.greenTint,
            }}
          >
            <span
              style={{
                display: 'block',
                fontSize: '9px',
                color: BRAND.muted,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
              }}
            >
              {badge.label}
            </span>
            <span
              style={{
                fontWeight: 700,
                fontSize: '12px',
                color: BRAND.greenDark,
                letterSpacing: '0.04em',
              }}
            >
              {badge.value}
            </span>
          </div>
        ))}
      </div>

      <p
        style={{
          textAlign: 'center',
          fontSize: '10px',
          color: BRAND.muted,
          margin: '0 0 10px',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        Staff: <strong>{report.cashierName}</strong>
      </p>

      {/* ── Product table ── */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          marginBottom: '10px',
          fontFamily: 'Arial, Helvetica, sans-serif',
        }}
      >
        <thead>
          <tr>
            {[
              { label: 'Product', align: 'left' as const },
              { label: 'PS(KG)', align: 'center' as const },
              { label: 'Quantity', align: 'center' as const },
              { label: 'Sales Work Out', align: 'right' as const },
              { label: 'Returns', align: 'center' as const },
              { label: 'Sold Out', align: 'center' as const },
              { label: 'Money Receive', align: 'right' as const },
            ].map((col) => (
              <th key={col.label} style={{ ...thStyle, textAlign: col.align }}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {report.products.map((p, idx) => (
            <tr key={p.productId} style={{ backgroundColor: idx % 2 === 0 ? '#fafafa' : '#fff' }}>
              <td style={{ ...cellStyle, fontWeight: 600 }}>{p.productName}</td>
              <td style={{ ...cellStyle, textAlign: 'center' }}>{p.packSize}</td>
              <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 600 }}>{p.quantity}</td>
              <td
                style={{
                  ...cellStyle,
                  textAlign: 'right',
                  backgroundColor: salesWorkOutBg(idx),
                  fontWeight: 600,
                }}
              >
                {fc(p.salesWorkOut)}
              </td>
              <td
                style={{
                  ...cellStyle,
                  textAlign: 'center',
                  color: p.returns > 0 ? BRAND.red : BRAND.text,
                }}
              >
                {p.returns}
              </td>
              <td
                style={{
                  ...cellStyle,
                  textAlign: 'center',
                  fontWeight: 700,
                  color: BRAND.greenDark,
                }}
              >
                {p.soldOut}
              </td>
              <td
                style={{
                  ...cellStyle,
                  textAlign: 'right',
                  fontWeight: 700,
                  backgroundColor: BRAND.greenTint,
                  color: BRAND.greenDark,
                }}
              >
                {fc(p.moneyReceived)}
              </td>
            </tr>
          ))}
          <tr style={{ backgroundColor: BRAND.greenTint }}>
            <td colSpan={2} style={{ ...cellStyle, fontWeight: 800, color: BRAND.greenDark }}>
              Total
            </td>
            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 800, color: BRAND.greenDark }}>
              {report.totals.quantity} (PCS)
            </td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 800, color: BRAND.greenDark }}>
              {fc(report.totals.salesWorkOut)}
            </td>
            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 800, color: BRAND.greenDark }}>
              {report.totals.returns} (PCS)
            </td>
            <td style={{ ...cellStyle, textAlign: 'center', fontWeight: 800, color: BRAND.greenDark }}>
              {report.totals.soldOut} (PCS)
            </td>
            <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 800, color: BRAND.greenDark }}>
              {fc(report.totals.moneyReceived)}
            </td>
          </tr>
        </tbody>
      </table>

      {report.mostSoldProduct && report.mostSoldProduct.qty > 0 && (
        <p
          style={{
            textAlign: 'center',
            fontWeight: 700,
            color: BRAND.green,
            fontSize: '11px',
            margin: '8px 0 16px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Most sold: {report.mostSoldProduct.name} — {report.mostSoldProduct.qty} pcs
        </p>
      )}

      {/* ── Summary grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          marginTop: '8px',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '11px',
        }}
      >
        {/* Left column */}
        <div>
          <SectionTitle>Daily Sales Report</SectionTitle>
          <SummaryRow
            label="Grand Sales + Credit"
            value={fc(report.grandSalesPlusCredit)}
            valueColor={BRAND.green}
            bold
          />

          <SectionTitle style={{ marginTop: '12px' }}>Expenses</SectionTitle>
          {report.expenses.length === 0 ? (
            <p style={{ color: BRAND.muted, fontSize: '10px', margin: '4px 0' }}>No route expenses</p>
          ) : (
            report.expenses.map((e, i) => (
              <SummaryRow key={e.id} label={`${i + 1}. ${e.description}`} value={fc(e.amount)} />
            ))
          )}
          <SummaryRow
            label="Total Exp"
            value={fc(report.totalExpenses)}
            valueColor={BRAND.red}
            bold
            borderTop
          />

          {report.discountOut > 0 && (
            <>
              <SectionTitle style={{ marginTop: '10px' }}>Other Deductions</SectionTitle>
              <SummaryRow
                label="Discount Out"
                value={fc(report.discountOut)}
                valueColor={BRAND.red}
                bold
              />
            </>
          )}

          <SectionTitle style={{ marginTop: '12px' }}>Sales Breakdown</SectionTitle>
          <SummaryRow label="1. Cash Sales" value={fc(report.salesBreakdown.cash)} />
          <SummaryRow label="2. Total Sales" value={fc(report.salesBreakdown.totalSales)} />
          <SummaryRow label="3. M-Pesa / Paybill" value={fc(report.salesBreakdown.mpesa)} />
          <SummaryRow label="4. Direct Bank" value={fc(report.salesBreakdown.directBank)} />
          <SummaryRow label="5. Credit" value={fc(report.salesBreakdown.credit)} />
        </div>

        {/* Right column — calculations */}
        <div>
          <SectionTitle>Calculations</SectionTitle>
          <p style={{ margin: '4px 0', fontSize: '10px', lineHeight: 1.6 }}>
            Total Sales Collected (excl. credit):{' '}
            <strong>{fc(report.totalCollectedExCredit)}</strong>
          </p>
          {report.totalOutstandingCredit > 0 && (
            <p style={{ margin: '4px 0', fontSize: '10px' }}>
              Less outstanding credit: <strong style={{ color: BRAND.red }}>−{fc(report.totalOutstandingCredit)}</strong>
            </p>
          )}
          <p style={{ margin: '4px 0', fontSize: '10px' }}>
            Less expenses &amp; discount:{' '}
            <strong>
              −{fc(report.totalExpenses + report.discountOut)}
            </strong>
          </p>
          <p
            style={{
              margin: '8px 0 4px',
              fontSize: '10px',
              color: BRAND.muted,
              fontStyle: 'italic',
            }}
          >
            {netFormula}
          </p>

          <div
            style={{
              marginTop: '12px',
              padding: '10px 12px',
              border: `2px solid ${BRAND.green}`,
              borderRadius: '4px',
              backgroundColor: BRAND.greenTint,
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: '11px',
                fontWeight: 800,
                color: BRAND.greenDark,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                textAlign: 'center',
              }}
            >
              Final Balance
            </p>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: '18px',
                fontWeight: 800,
                color: BRAND.green,
                textAlign: 'center',
              }}
            >
              {fc(report.netAfterExpensesAndDiscount)}
            </p>
          </div>

          {report.outstandingCredit.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <p style={{ margin: '0 0 4px', fontWeight: 700, color: BRAND.red, fontSize: '11px' }}>
                Outstanding Credit: −{fc(report.totalOutstandingCredit)}
              </p>
              {report.outstandingCredit.map((c, i) => (
                <p key={i} style={{ margin: '2px 0', paddingLeft: '8px', color: BRAND.muted, fontSize: '10px' }}>
                  −{c.customerName}: {fc(c.amount)}
                </p>
              ))}
            </div>
          )}

          {/* Settlement block */}
          <div
            style={{
              marginTop: '16px',
              padding: '10px',
              border: `1px dashed ${BRAND.goldLight}`,
              borderRadius: '4px',
            }}
          >
            <SectionTitle>Final Settlement</SectionTitle>
            <SummaryRow label="Expected remittance" value={fc(displaySettlement.expected_remittance)} bold />
            <SummaryRow label="Cash submitted" value={fc(displaySettlement.cash_submitted)} bold />
            <SummaryRow label="M-Pesa confirmed" value={fc(displaySettlement.mpesa_submitted)} />
            <SummaryRow label="Bank confirmed" value={fc(displaySettlement.bank_submitted)} />
            <SummaryRow
              label="Variance"
              value={`${displaySettlement.variance >= 0 ? '+' : ''}${fc(displaySettlement.variance)}`}
              valueColor={
                displaySettlement.variance < 0
                  ? BRAND.red
                  : displaySettlement.variance > 0
                    ? BRAND.green
                    : BRAND.text
              }
              bold
            />
            {displaySettlement.notes && (
              <p style={{ margin: '6px 0 0', fontSize: '9px', fontStyle: 'italic', color: BRAND.muted }}>
                Note: {displaySettlement.notes}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div
        style={{
          marginTop: '24px',
          paddingTop: '12px',
          borderTop: `1px solid ${BRAND.goldLight}`,
          textAlign: 'center',
          color: BRAND.green,
        }}
      >
        <p style={{ margin: '0 0 2px', fontWeight: 700, fontSize: '12px' }}>{brandTitle}</p>
        <p style={{ margin: '0 0 4px', fontSize: '10px', fontFamily: 'Arial, sans-serif' }}>
          {settings.address ? `${settings.address}${settings.city ? ` · ${settings.city}` : ''}` : 'Animal Feeds Distribution'}
        </p>
        <p style={{ margin: 0, fontSize: '10px', fontStyle: 'italic', color: BRAND.gold }}>
          &ldquo;{tagline}&rdquo;
        </p>
      </div>
    </div>
  );
}

function SectionTitle({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: CSSProperties;
}) {
  return (
    <p
      style={{
        margin: '0 0 6px',
        fontWeight: 800,
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: BRAND.greenDark,
        borderBottom: `1px solid ${BRAND.green}`,
        paddingBottom: '3px',
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
  bold,
  borderTop,
}: {
  label: string;
  value: string;
  valueColor?: string;
  bold?: boolean;
  borderTop?: boolean;
}) {
  return (
    <div
      className={cn(borderTop && 'border-t')}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '8px',
        margin: '3px 0',
        fontSize: '10px',
        borderTopColor: '#ddd',
        paddingTop: borderTop ? '4px' : undefined,
      }}
    >
      <span style={{ color: BRAND.muted }}>{label}</span>
      <span
        style={{
          fontWeight: bold ? 700 : 500,
          color: valueColor || BRAND.text,
          whiteSpace: 'nowrap',
        }}
      >
        {value}
      </span>
    </div>
  );
}
