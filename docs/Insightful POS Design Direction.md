# Insightful POS: Design Direction

Status: draft v4, aubergine accent chosen; Shopify POS, Square and Mercury studies folded in. All hex values are proposals; verify contrast before locking.

## 1. Thesis

**The till is a receipt being written.** A POS turns a sale into a paid, KRA-signed receipt, fast, even when the network drops. The receipt is the hero object of the product.

**Signature moment:** a sale moves through one visible chain: **Rung up → Paid (Cash / M-PESA / Credit) → Signed by KRA**, with a fourth state, **Saved on this device, waiting for network**. The cart is a receipt in progress; charging stamps it.

## 2. Who and where

- Primary till: **phone or tablet**, held in one hand, often in bright light, sometimes offline. Design at 360px first, then tablet (landscape 1024px), then desktop for the owner back-office.
- Cashier: speed, big targets, glanceable total. Owner: today's takings, stock exceptions, eTIMS health.
- Receipts: digital share (WhatsApp/SMS) is the default; thermal print is optional. Assumption to confirm.

## 3. Color tokens (proposed)

Warm paper, ink text, hairline borders. One accent for actions only.

- `--paper` #F6F3EC (page), `--surface` #FCFBF7 (panels, receipt), `--ink` #1B1A17, `--ink-2` #55524A, `--hairline` #E3DED2
- `--accent` #6B2D5C, aubergine (hover #54224A, soft #F3E9F0; dark mode #C98BB9). Used only for buttons, links, focus rings, selected state. Never for status or decoration. Decided: aubergine, chosen over indigo, which sat close to Mercury's periwinkle. Contrast, computed: 9.7:1 against white, 8.8:1 against paper, 8.2:1 on the soft tint; dark-mode accent 7.0:1 on the dark paper. Status colors on paper: ok 4.8:1, wait 4.5:1, fail 5.9:1; wait is only just over 4.5:1, so do not use it for small text on tinted backgrounds. Danger actions stay red with a text label, so purple never reads as an error.
- Semantic status, nothing else:
  - `--ok` #1F7A4D: Paid, Signed, confirmations
  - `--wait` #B45309: Low stock, Waiting for network
  - `--fail` #B42318: Out of stock, failed or rejected by eTIMS, errors
  - Neutral (`--ink-2`): Open, draft, no change
- Rule: **silence is the default.** In-stock products show no badge; only exceptions get one.
- Dark mode keeps the same roles on an ink background; also check outdoor legibility (high contrast, no thin greys).

## 4. Typography

- UI and headlines: **Geist Sans**. IDs, SKUs, receipt numbers, every KES amount: **Geist Mono** with tabular numerals.
- Serif accent (Instrument Serif) for one or two words in marketing headlines only, never in the app.
- Inputs 16px minimum (prevents iOS zoom). Cart total 32-40px mono. Whole shillings large, decimals small and shown only when non-zero; negative amounts carry a minus sign, never color alone. Body text 14px minimum.

## 5. Motifs

- Receipt paper: the cart panel has a torn or zigzag bottom edge, ruled lines, dotted leaders between item and price.
- The seal: a small stamp icon plus text for Signed; the status chain strip shows where a sale is.
- Hairline rules instead of boxed cards. Radii 12-16px. Soft shadow only on floating elements (sheets, menus, the pay bar).
- No gradient tiles, no emoji as UI, no pastel icon squares.

## 6. Page structure

**POS (phone):** slim header (menu, store, one connection chip). Search plus scan on top, then one actions row (Scan, Discount, Note, Hold sale). Favorites is the default view, All is secondary, and categories sit at the bottom in thumb reach. Product list as dense ruled rows (name, price, stock exception, inline quantity stepper); photos only if a real photo exists. Sticky bottom bar: "3 items · KES 1,240 · Charge". Tapping it opens the receipt as a full sheet.

**POS (tablet and desktop):** product list left, receipt panel right (about 380px, pinned). The receipt header leads with the customer (name, and balance owed on credit sales); the picker stays closed until needed, and the Create button says why it is disabled. Always show the VAT line, and put the total inside the Charge button. On tablet the sidebar collapses to an icon rail with badges.

**Weight and pack sheet:** items sold by KGS or pack open a sheet with single-tap choices (per kg, 5 kg, 50 kg bag) and a quantity stepper, with Add at top right. On tablet the receipt stays visible beside the sheet.

**Checkout:** The amount due is large at the top; M-PESA is the first row, then Cash, then Credit. Cash: quick-amount chips (Exact, 100, 200, 500, 1,000, Custom) and change due. M-PESA: waiting-for-prompt state, then confirmed. After payment, a calm full-screen state steps through Paid, Signing with KRA, Signed (offline: Saved on this device). Receipt delivery is three big choices, WhatsApp / SMS / Print, with a quiet No receipt, then New sale. No upsell or loyalty screens in between.

**Connection chip:** one place for Online / Offline · N sales waiting. Remove every other "Online" indicator.

**Dashboard (owner):** hero row with today's takings in large mono type, a delta against the same weekday last week, and a one-line split (M-PESA, Cash, Credit); with no data, show a dash, never a green arrow. Beside it, exception tiles only: credit overdue, eTIMS unsigned ("2 unsigned"), stock needing reorder. Below, ruled rows with a thin proportional bar and % share for takings by payment method, top sellers, and stock against reorder level, each with one action (Reorder). One row of action pills: New sale (filled), Receive stock, Close day, Create PO. A "Today in one line" summary of 2-3 templated sentences computed from real data, with no invented figures. Daily takings are bars, not smoothed curves. Empty states are one compact line, no illustration. Three columns at 1440px, one stacked column at 360px.

**Login:** single column on phone; on wide screens, show a real sample receipt (labelled Sample), not an illustration. Fix contrast on secondary text.

**Lists (products, customers, transactions):** ruled rows with a name and sublabel (SKU, phone), one value column (stock, balance owed) and one action column (Reorder, Request payment). A status tag beside the name only for exceptions (Not signed, Out of stock). Transactions filter tabs: Today, Credit, Unsigned, Voided. Lists cap at about 960px on desktop; on phone show the top 5 and View all.

## 7. Rules for every Cursor prompt

1. Visual changes only: no logic, routes, permissions, data or API changes.
2. Use existing tokens only (after step 1 of the rollout defines them); no hard-coded colors or sizes.
3. One source of truth: low-stock threshold, `formatKES`, and a date formatter (`9 Oct 2026`, Africa/Nairobi) are shared helpers, not repeated inline.
4. Keep existing aria labels, test ids and keyboard behavior.
5. Test at 360px, 768px, 1024px landscape and 1440px; no horizontal scroll.
6. Finish with a report: files changed, anything unsure, TODOs.

## 8. Quality bar

- 4.5:1 text contrast; visible focus rings (2px accent, offset).
- Touch targets 48px minimum; primary Charge button 56px. Tap budget: a one-item cash sale of a favorite takes 4 taps or fewer (item, Charge, exact amount, receipt choice).
- Status never by color alone: always text or icon.
- Respect reduced motion. Content visible without JavaScript (marketing site).
- Lighthouse mobile 90+.
- Offline state designed, not an afterthought: every screen has a defined behavior.
- Local and specific: KES first, M-PESA, eTIMS, Kenya. No invented customers, quotes or figures.

## 9. Rollout order

1. Tokens and fonts only.
2. Signature moment: receipt panel plus status chip component.
3. Main screens: POS (phone and tablet), checkout, result.
4. Secondary pages: login, dashboard.
5. App shell: sidebar, header, bottom nav, connection chip.
6. List screens: products, inventory, transactions, customers.
7. Marketing site.

After each pass: review a screenshot before moving on.

## 10. Refer

|  |  |  |
| --- | --- | --- |
|  |  |  |
|  |  |  |

## ence studies

Capture screenshots; for each, note one idea to borrow, not the look. Done: Shopify POS (tablet screenshot), Square (checkout recording) and Mercury (owner dashboard screenshots). Still to capture: a receipt (Stripe or Monzo).

| Reference | Idea to borrow | Insightful version |
| --- | --- | --- |
| Shopify POS | Cart starts with the customer | Receipt header shows customer and balance owed |
| Shopify POS | Total inside the pay button, tax line visible | "Charge KES 1,240" plus a VAT line |
| Shopify POS | Shortcuts beside the grid | One actions row: Scan, Discount, Note, Hold sale |
| Shopify POS | Icon rail with badges on tablet | Collapsed sidebar on tablet |
| Square | Favorites by default, categories at the bottom | Favorites is the default view |
| Square | Option sheet with single-tap choices | Weight and pack sheet for KGS items |
| Square | Quick-cash chips on the Cash row | KES chips, M-PESA as the first row |
| Square | Calm full-screen state after payment | Paid, Signing with KRA, Signed |
| Square | Big receipt-delivery choices | WhatsApp / SMS / Print |

Not borrowed: photo-led tiles, blue-on-black decoration, loyalty and upsell screens, full-screen sheets that hide the cart.

Mercury (owner dashboard):

| Reference | Idea to borrow | Insightful version |
| --- | --- | --- |
| Mercury | Big number, delta against prior period, one-line breakdown | Today's takings, delta against last week, M-PESA / Cash / Credit split |
| Mercury | Ruled rows with a thin proportional bar and % share | Takings by payment method, top sellers, stock against reorder level |
| Mercury | Small decimals beside a large figure | Whole shillings large, decimals small |
| Mercury | One filled action among outlined pills | New sale filled; Receive stock, Close day, Create PO outlined |
| Mercury | Summary tiles that show exceptions only | Credit overdue, eTIMS unsigned, reorder needed |
| Mercury | Inline status tag beside a row | "Not signed" tag on a sale; Today / Credit / Unsigned / Voided tabs |
| Mercury | Plain-language summary lines beside the chart | "Today in one line", templated from real data |
| Mercury | Name, sublabel, value, one action per row | Products and customers lists |
| Mercury | Centered readable column for lists | Lists capped at about 960px on desktop |

Not borrowed from Mercury: dark as the default, 11-12px grey-on-dark text, the drag-to-select date scrubber, the floating onboarding checklist, the Command bar, long ledger lists on phone, and smoothed curves on sparse data.
