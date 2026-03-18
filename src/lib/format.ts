export function formatDisplayDate(value: string) {
  if (!value) return '-';
  // value expected YYYY-MM-DD
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  const date = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

