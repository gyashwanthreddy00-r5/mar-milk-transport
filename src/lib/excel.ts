import { companyHeaderLines } from '@/lib/company';

function escapeCSV(value: string | number | undefined | null): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCSV(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][],
  options?: { withHeader?: boolean; title?: string }
): void {
  const withHeader = options?.withHeader ?? true;
  const title = options?.title;

  const csvLines: string[] = [];

  if (withHeader) {
    if (title) csvLines.push(escapeCSV(title));
    csvLines.push(...companyHeaderLines().map(escapeCSV));
    csvLines.push('');
  }

  csvLines.push(headers.map(escapeCSV).join(','));
  csvLines.push(...rows.map((row) => row.map(escapeCSV).join(',')));

  const csv = '\uFEFF' + csvLines.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
