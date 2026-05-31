import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  createDemoBlockedBuilder,
  demoBlockedResult,
  isDemoModeActive,
  isWriteRpc,
} from '@/lib/demoMode';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase credentials are required. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.',
  );
}

const baseClient = createClient(supabaseUrl, supabaseAnonKey);

const WRITE_TABLE_METHODS = new Set(['insert', 'update', 'upsert', 'delete']);

function wrapQueryBuilder<T extends object>(builder: T): T {
  if (!isDemoModeActive()) return builder;

  return new Proxy(builder, {
    get(target, prop, receiver) {
      if (WRITE_TABLE_METHODS.has(String(prop))) {
        return () => createDemoBlockedBuilder();
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const next = value.apply(target, args);
          if (next && typeof next === 'object') {
            return wrapQueryBuilder(next as object);
          }
          return next;
        };
      }
      return value;
    },
  }) as T;
}

function wrapSupabaseClient(client: SupabaseClient): SupabaseClient {
  return new Proxy(client, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => wrapQueryBuilder(target.from(table));
      }
      if (prop === 'rpc') {
        return (fn: string, args?: object, options?: object) => {
          if (isDemoModeActive() && isWriteRpc(fn)) {
            return Promise.resolve(demoBlockedResult());
          }
          return target.rpc(fn, args, options);
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  }) as SupabaseClient;
}

export const supabase = wrapSupabaseClient(baseClient);
