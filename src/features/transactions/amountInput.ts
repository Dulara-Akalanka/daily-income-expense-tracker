export type PadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | 'back';

const MAX_INTEGER_DIGITS = 9;

/** Applies one number-pad key to the raw amount string (e.g. "1250.5"). */
export function applyPadKey(current: string, key: PadKey, decimals: number): string {
  if (key === 'back') return current.slice(0, -1);

  if (key === '.') {
    if (decimals === 0 || current.includes('.')) return current;
    return current === '' ? '0.' : `${current}.`;
  }

  const [integerPart, fractionPart] = current.split('.');
  if (fractionPart !== undefined) {
    return fractionPart.length >= decimals ? current : current + key;
  }
  if (integerPart.length >= MAX_INTEGER_DIGITS) return current;
  return current === '0' ? key : current + key;
}

/** Trims extra fraction digits when switching to a currency with fewer decimals. */
export function clampDecimals(current: string, decimals: number): string {
  const [integerPart, fractionPart] = current.split('.');
  if (fractionPart === undefined) return current;
  if (decimals === 0) return integerPart;
  return `${integerPart}.${fractionPart.slice(0, decimals)}`;
}

export function parseAmount(raw: string): number {
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : 0;
}

/** "1234567.5" → "1,234,567.5" for display while typing. */
export function formatAmountInput(raw: string): string {
  if (raw === '') return '0';
  const [integerPart, fractionPart] = raw.split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fractionPart === undefined ? grouped : `${grouped}.${fractionPart}`;
}

/** Pulls "#tags" out of a note: "lunch #work #team" → ["work", "team"]. */
export function extractTags(note: string): string[] {
  const matches = note.match(/#[\w-]+/g) ?? [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}
