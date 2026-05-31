/** Demo users see real store data but must not persist changes. */

/** Branding for Store 007 demo (Top Ranch). */
export const DEMO_BRANDING = {
  name: 'Top Ranch',
  shortName: 'Top Ranch',
  logoUrl: 'https://i.postimg.cc/g2F3BkfD/IMG-20260531-WA0024.jpg',
  /** Optional local copy: place file at public/branding/top-ranch-logo.jpg */
  logoUrlLocal: '/branding/top-ranch-logo.jpg',
  tagline: 'Retail demo — Store 007',
} as const;

export function getDemoLogoUrl(): string {
  return DEMO_BRANDING.logoUrl;
}

export const DEMO_WRITE_BLOCKED_MESSAGE =
  'Demo account: changes are not saved to the database.';

export const DEMO_WRITE_ERROR = {
  message: DEMO_WRITE_BLOCKED_MESSAGE,
  code: 'DEMO_MODE',
  details: null,
  hint: null,
} as const;

const WRITE_RPC_NAMES = new Set([
  'generate_order_number',
  'generate_invoice_number',
  'generate_purchase_number',
  'generate_production_batch_number',
  'complete_production_batch',
  'save_product_recipe',
  'record_customer_account_payment',
  'refund_order_and_restore_stock',
]);

let demoModeActive = false;

export function setDemoModeActive(active: boolean): void {
  demoModeActive = active;
}

export function isDemoModeActive(): boolean {
  return demoModeActive;
}

export function isWriteRpc(fn: string): boolean {
  return WRITE_RPC_NAMES.has(fn);
}

export function demoBlockedResult<T = null>(): {
  data: T;
  error: typeof DEMO_WRITE_ERROR;
  count: null;
  status: number;
  statusText: string;
} {
  return {
    data: null as T,
    error: DEMO_WRITE_ERROR,
    count: null,
    status: 403,
    statusText: 'Demo mode',
  };
}

/** Postgrest-style builder that always resolves to a demo-blocked error. */
export function createDemoBlockedBuilder(): unknown {
  const result = demoBlockedResult();

  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === 'then') {
        return (
          onFulfilled?: (value: typeof result) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) =>
          Promise.resolve(result).then(onFulfilled, onRejected);
      }
      return () => new Proxy({}, handler);
    },
  };

  return new Proxy({}, handler);
}

export function assertCanWriteLocally(): void {
  if (isDemoModeActive()) {
    throw new Error(DEMO_WRITE_BLOCKED_MESSAGE);
  }
}
