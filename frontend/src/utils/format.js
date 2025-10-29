export function formatINR(n, { symbol = true } = {}) {
  const num = Number(n || 0);
  const str = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);
  return symbol ? `₹ ${str}` : str;
}

export function formatINRNoSymbol(n) {
  return formatINR(n, { symbol: false });
}

