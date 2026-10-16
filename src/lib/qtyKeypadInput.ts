export type QtyKeypadInputAction =
  | { type: 'append'; char: string }
  | { type: 'backspace' }
  | { type: 'set'; value: string };

const MAX_INTEGER_DIGITS = 9;
const MAX_DECIMAL_PLACES = 3;

function countIntegerDigits(beforeDecimal: string): number {
  return beforeDecimal.replace(/\D/g, '').length;
}

/**
 * Pure reducer for on-screen quantity entry (string state, no leading currency).
 */
export function qtyKeypadInputReducer(
  state: string,
  action: QtyKeypadInputAction,
  allowDecimal: boolean,
): string {
  switch (action.type) {
    case 'set':
      return action.value;
    case 'backspace':
      return state.slice(0, -1);
    case 'append': {
      const char = action.char;
      if (char === '.') {
        if (!allowDecimal || state.includes('.')) return state;
        if (!state) return '0.';
        return `${state}.`;
      }
      if (!/^\d$/.test(char)) return state;

      if (state === '0') {
        return char === '0' ? '0' : char;
      }

      const dotIndex = state.indexOf('.');
      if (dotIndex >= 0) {
        const frac = state.slice(dotIndex + 1);
        if (frac.length >= MAX_DECIMAL_PLACES) return state;
        return state + char;
      }

      if (countIntegerDigits(state) >= MAX_INTEGER_DIGITS) return state;
      return state + char;
    }
    default:
      return state;
  }
}

export function parseKeypadQuantityString(
  state: string,
  allowDecimal: boolean,
): number | null {
  const trimmed = state.trim();
  if (!trimmed || trimmed === '0' || trimmed === '0.') return null;
  const val = allowDecimal ? parseFloat(trimmed) : parseInt(trimmed, 10);
  if (!Number.isFinite(val) || val <= 0) return null;
  if (allowDecimal) {
    return Math.round(val * 1000) / 1000;
  }
  return val;
}

export function qtyKeypadQuickValues(allowDecimal: boolean): number[] {
  return allowDecimal ? [0.5, 1, 2, 5, 10, 25, 50] : [1, 2, 5, 10, 25, 50];
}
