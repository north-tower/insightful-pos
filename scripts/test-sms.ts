/**
 * Send test SMS messages through the same Supabase `send-sms` edge function as the app.
 *
 * Usage (from repo root):
 *   npm run test:sms -- --mobile 2547XXXXXXXX --type account
 *   npm run test:sms -- --dry-run --type account
 *   npm run test:sms -- --mobile 2547XXXXXXXX --type account --also-owner
 *
 * Types:
 *   account          Order History "Pay" (account balance) — customer SMS
 *   account-settled  Same as account with balance 0 (fully settled wording)
 *   account-owner    Owner alert for account payment
 *   invoice-payment  Payment tied to an invoice — customer SMS
 *   invoice-created  New credit invoice — customer SMS
 *   raw              Send --message verbatim (gateway / template debugging)
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import {
  buildAccountPaymentReceivedCustomerMessage,
  buildAccountPaymentReceivedOwnerMessage,
  buildInvoiceCreatedCustomerMessage,
  buildPaymentReceivedCustomerMessage,
} from '../src/lib/smsMessages';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv(): Record<string, string> {
  const envPath = join(repoRoot, '.env');
  if (!existsSync(envPath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function parseArgs(argv: string[]) {
  const opts: Record<string, string | boolean> = {
    type: 'account',
    dryRun: false,
    alsoOwner: false,
    name: 'Kilimo Feeds',
    shop: 'Main Store',
    previous: '50000',
    paid: '10000',
    balance: '40000',
    invoice: 'INV-TEST-001',
    message: '',
    mobile: '',
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      opts.dryRun = true;
      continue;
    }
    if (arg === '--also-owner') {
      opts.alsoOwner = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        opts[key] = next;
        i++;
      }
    }
  }
  return opts;
}

function buildMessage(opts: Record<string, string | boolean>): string {
  const type = String(opts.type);
  const previous = Number(opts.previous);
  const paid = Number(opts.paid);
  const balance = Number(opts.balance);
  const shop = String(opts.shop);
  const name = String(opts.name);

  if (type === 'raw') {
    const msg = String(opts.message || '').trim();
    if (!msg) throw new Error('--type raw requires --message "..."');
    return msg;
  }

  if (type === 'account-settled') {
    return buildAccountPaymentReceivedCustomerMessage(name, paid, previous, 0, shop);
  }

  if (type === 'account' || type === 'account-owner') {
    const builder =
      type === 'account-owner'
        ? buildAccountPaymentReceivedOwnerMessage
        : buildAccountPaymentReceivedCustomerMessage;
    return builder(name, paid, previous, balance, shop);
  }

  if (type === 'invoice-payment') {
    return buildPaymentReceivedCustomerMessage(
      {
        id: 'test',
        customer_name: name,
        customer_phone: String(opts.mobile),
        invoice_number: String(opts.invoice),
        order_number: String(opts.invoice),
        total: paid,
        items: [],
      } as Parameters<typeof buildPaymentReceivedCustomerMessage>[0],
      paid,
      previous,
      balance,
      shop,
    );
  }

  if (type === 'invoice-created') {
    return buildInvoiceCreatedCustomerMessage(
      {
        id: 'test',
        customer_name: name,
        customer_phone: String(opts.mobile),
        invoice_number: String(opts.invoice),
        order_number: String(opts.invoice),
        total: paid,
        items: [],
      } as Parameters<typeof buildInvoiceCreatedCustomerMessage>[0],
      shop,
      previous,
      balance,
    );
  }

  throw new Error(
    `Unknown --type ${type}. Use: account | account-settled | account-owner | invoice-payment | invoice-created | raw`,
  );
}

async function sendViaEdgeFunction(
  supabaseUrl: string,
  anonKey: string,
  mobile: string,
  message: string,
): Promise<void> {
  const supabase = createClient(supabaseUrl, anonKey);
  const { data, error } = await supabase.functions.invoke('send-sms', {
    body: { mobile, message },
  });

  if (error) {
    console.error('Invoke error:', error);
    process.exit(1);
  }

  console.log('Edge function response:', JSON.stringify(data, null, 2));
}

async function main() {
  const env = loadDotEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  const opts = parseArgs(process.argv.slice(2));

  const message = buildMessage(opts);
  const mobile = String(opts.mobile || '').trim();

  console.log('--- Message preview ---');
  console.log(message);
  console.log('--- Length:', message.length, 'chars ---');

  if (opts.dryRun) {
    console.log('\nDry run: not sending. Remove --dry-run and pass --mobile to send.');
    if (opts.alsoOwner) {
      const ownerMsg = buildAccountPaymentReceivedOwnerMessage(
        String(opts.name),
        Number(opts.paid),
        Number(opts.previous),
        Number(opts.balance),
        String(opts.shop),
      );
      console.log('\n--- Owner message preview ---');
      console.log(ownerMsg);
    }
    return;
  }

  if (!mobile) {
    console.error('Missing --mobile (Kenya format, e.g. 254712345678 or 0712345678).');
    process.exit(1);
  }

  if (!supabaseUrl || !anonKey) {
    console.error('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  console.log(`\nSending to ${mobile}...`);
  await sendViaEdgeFunction(supabaseUrl, anonKey, mobile, message);

  if (opts.alsoOwner) {
    const ownerPhone = '0729690592';
    const ownerMsg = buildAccountPaymentReceivedOwnerMessage(
      String(opts.name),
      Number(opts.paid),
      Number(opts.previous),
      Number(opts.balance),
      String(opts.shop),
    );
    console.log(`\nSending owner alert to ${ownerPhone}...`);
    await sendViaEdgeFunction(supabaseUrl, anonKey, ownerPhone, ownerMsg);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
