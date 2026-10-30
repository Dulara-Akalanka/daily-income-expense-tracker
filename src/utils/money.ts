const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND']);

export function currencyDecimals(code: string): number {
  return ZERO_DECIMAL_CURRENCIES.has(code) ? 0 : 2;
}

export function roundMoney(value: number, currency: string): number {
  const factor = 10 ** currencyDecimals(currency);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Converts between currencies given rates expressed as units per 1 USD. */
export function convert(amount: number, fromPerUsd: number, toPerUsd: number): number {
  return (amount / fromPerUsd) * toPerUsd;
}

export function formatMoney(value: number, currency: string, fallbackSymbol?: string): string {
  const digits = currencyDecimals(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value);
  } catch {
    return `${fallbackSymbol ?? currency} ${value.toFixed(digits)}`;
  }
}
