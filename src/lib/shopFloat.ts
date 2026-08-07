/** Standard cash left in the till at open and close (KES). */
export const SHOP_CASH_FLOAT = 1500;

export function formatShopCashFloat(): string {
  return SHOP_CASH_FLOAT.toLocaleString('en-KE');
}
