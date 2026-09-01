import * as XLSX from 'xlsx-js-style';
import { COMPANY } from '@/lib/company';

export interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
  type?: 'text' | 'number' | 'currency' | 'date' | 'integer';
}

export interface ExcelExportConfig {
  reportTitle: string;
  filenamePrefix: string;
  columns: ExcelColumn[];
  rows: Record<string, string | number | null | undefined>[];
  dateField: string;
  fromDate: string;
  toDate: string;
  totals?: { label: string; columnKey: string; value: number }[];
}

const DARK_BLUE = '1A3C5E';
const WHITE = 'FFFFFF';
const LIGHT_GRAY = 'F3F4F6';
const BORDER_GRAY = 'BFBFBF';
const TEXT_DARK = '222222';
const TEXT_MUTED = '555555';

function fmtDate(d: string): string {
  if (!d || d === 'All') return 'All';
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB').replace(/\//g, '-');
}

function fmtDateTime(d: Date): string {
  const date = d.toLocaleDateString('en-GB').replace(/\//g, '-');
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${date} ${time}`;
}

function borderAll(color = BORDER_GRAY) {
  return {
    top: { style: 'thin', color: { rgb: color } },
    bottom: { style: 'thin', color: { rgb: color } },
    left: { style: 'thin', color: { rgb: color } },
    right: { style: 'thin', color: { rgb: color } },
  };
}

type Cell = {
  v?: string | number;
  t?: string;
  s?: Record<string, unknown>;
  f?: string;
};

function buildAOA(cfg: ExcelExportConfig): { aoa: Cell[][]; merges: XLSX.Range[]; colWidths: { wpx: number }[]; freezeRow: number; headerRow: number; dataEndRow: number; totalRow: number } {
  const colCount = cfg.columns.length;
  const colWidths = cfg.columns.map((c) => ({ wpx: (c.width ?? 16) * 7 + 10 }));

  const aoa: Cell[][] = [];
  const merges: XLSX.Range[] = [];
  let row = 0;

  // Helper to add a merged row
  const addMergedRow = (value: string, style: Record<string, unknown>, height?: number) => {
    aoa.push([{ v: value, t: 's', s: style }]);
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: colCount - 1 } });
    if (height) (aoa[row][0] as Cell).s = { ...style, ...(aoa[row][0] as Cell).s };
    row++;
  };

  // Company Name (font 20, bold, dark blue, centered)
  addMergedRow(COMPANY.name, {
    font: { name: 'Arial', sz: 20, bold: true, color: { rgb: DARK_BLUE } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  // Subtitle (font 14, bold)
  addMergedRow(COMPANY.tagline, {
    font: { name: 'Arial', sz: 14, bold: true, color: { rgb: '333333' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });
  // Address lines (font 11)
  COMPANY.addressLines.forEach((line) => {
    addMergedRow(line, {
      font: { name: 'Arial', sz: 11, color: { rgb: TEXT_MUTED } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
  });
  // Email/GSTIN/Cell line (font 11, bold)
  addMergedRow(`Email: ${COMPANY.email}    |    GSTIN: ${COMPANY.gstin}    |    Cell: ${COMPANY.cell1}, ${COMPANY.cell2}`, {
    font: { name: 'Arial', sz: 11, bold: true, color: { rgb: '333333' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  });

  // Report Title (dark blue bg, white bold, font 18)
  addMergedRow(cfg.reportTitle, {
    font: { name: 'Arial', sz: 18, bold: true, color: { rgb: WHITE } },
    fill: { fgColor: { rgb: DARK_BLUE } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: borderAll(DARK_BLUE),
  });

  // Metadata rows (right aligned) - 2 rows: Report Period + Generated On
  // Row 1: label + period value
  const metaLabelCol = Math.max(colCount - 3, 0);
  aoa.push([]);
  for (let i = 0; i < colCount; i++) {
    if (i < metaLabelCol) {
      aoa[row].push({ v: '', t: 's', s: {} });
    } else if (i === metaLabelCol) {
      aoa[row].push({ v: 'Report Period:', t: 's', s: {
        font: { name: 'Arial', sz: 10, bold: true, color: { rgb: TEXT_MUTED } },
        alignment: { horizontal: 'right', vertical: 'center' },
      }});
    } else {
      aoa[row].push({ v: '', t: 's', s: {} });
    }
  }
  merges.push({ s: { r: row, c: metaLabelCol }, e: { r: row, c: colCount - 2 } });
  aoa[row][colCount - 1] = {
    v: `${fmtDate(cfg.fromDate)}  to  ${fmtDate(cfg.toDate)}`,
    t: 's',
    s: {
      font: { name: 'Arial', sz: 10, color: { rgb: '333333' } },
      alignment: { horizontal: 'right', vertical: 'center' },
    },
  };
  row++;

  // Row 2: Generated On
  aoa.push([]);
  for (let i = 0; i < colCount; i++) {
    if (i < metaLabelCol) {
      aoa[row].push({ v: '', t: 's', s: {} });
    } else if (i === metaLabelCol) {
      aoa[row].push({ v: 'Generated On:', t: 's', s: {
        font: { name: 'Arial', sz: 10, bold: true, color: { rgb: TEXT_MUTED } },
        alignment: { horizontal: 'right', vertical: 'center' },
      }});
    } else {
      aoa[row].push({ v: '', t: 's', s: {} });
    }
  }
  merges.push({ s: { r: row, c: metaLabelCol }, e: { r: row, c: colCount - 2 } });
  aoa[row][colCount - 1] = {
    v: fmtDateTime(new Date()),
    t: 's',
    s: {
      font: { name: 'Arial', sz: 10, color: { rgb: '333333' } },
      alignment: { horizontal: 'right', vertical: 'center' },
    },
  };
  row++;

  // Spacer row
  aoa.push([]);
  for (let i = 0; i < colCount; i++) aoa[row].push({ v: '', t: 's', s: {} });
  row++;

  // Header row
  const headerRow = row;
  aoa.push([]);
  cfg.columns.forEach((col) => {
    aoa[row].push({
      v: col.header,
      t: 's',
      s: {
        font: { name: 'Arial', sz: 10, bold: true, color: { rgb: WHITE } },
        fill: { fgColor: { rgb: DARK_BLUE } },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
        border: borderAll(DARK_BLUE),
      },
    });
  });
  row++;

  // Data rows
  cfg.rows.forEach((rowData, idx) => {
    aoa.push([]);
    const bgColor = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
    cfg.columns.forEach((col) => {
      const raw = rowData[col.key];
      const align = col.align ?? 'left';
      const cellStyle: Record<string, unknown> = {
        font: { name: 'Arial', sz: 10, color: { rgb: TEXT_DARK } },
        fill: { fgColor: { rgb: bgColor } },
        alignment: { horizontal: align, vertical: 'center', wrapText: true },
        border: borderAll(),
      };
      if (col.type === 'currency' && typeof raw === 'number') {
        aoa[row].push({ v: raw, t: 'n', s: { ...cellStyle, numFmt: '"₹"#,##0.00' } });
      } else if (col.type === 'number' && typeof raw === 'number') {
        aoa[row].push({ v: raw, t: 'n', s: { ...cellStyle, numFmt: '#,##0.00' } });
      } else if (col.type === 'integer' && typeof raw === 'number') {
        aoa[row].push({ v: raw, t: 'n', s: { ...cellStyle, numFmt: '#,##0' } });
      } else if (col.type === 'date') {
        aoa[row].push({ v: fmtDate(String(raw ?? '')), t: 's', s: { ...cellStyle, alignment: { horizontal: 'center', vertical: 'center' } } });
      } else {
        aoa[row].push({ v: String(raw ?? ''), t: 's', s: cellStyle });
      }
    });
    row++;
  });

  const dataEndRow = row - 1;

  // Totals row
  let totalRow = -1;
  if (cfg.totals && cfg.totals.length > 0) {
    totalRow = row;
    aoa.push([]);
    const totalStyle: Record<string, unknown> = {
      font: { name: 'Arial', sz: 11, bold: true, color: { rgb: WHITE } },
      fill: { fgColor: { rgb: DARK_BLUE } },
      alignment: { horizontal: 'left', vertical: 'center' },
      border: {
        top: { style: 'medium', color: { rgb: DARK_BLUE } },
        bottom: { style: 'thin', color: { rgb: DARK_BLUE } },
        left: { style: 'thin', color: { rgb: DARK_BLUE } },
        right: { style: 'thin', color: { rgb: DARK_BLUE } },
      },
    };
    for (let i = 0; i < colCount; i++) {
      aoa[row].push({ v: '', t: 's', s: totalStyle });
    }
    aoa[row][0] = { v: 'TOTALS', t: 's', s: { ...totalStyle, alignment: { horizontal: 'left', vertical: 'center' } } };
    cfg.totals.forEach((tot) => {
      const colIdx = cfg.columns.findIndex((c) => c.key === tot.columnKey);
      if (colIdx >= 0) {
        const isCurrency = cfg.columns[colIdx].type === 'currency';
        aoa[row][colIdx] = {
          v: tot.value,
          t: 'n',
          s: {
            ...totalStyle,
            alignment: { horizontal: 'right', vertical: 'center' },
            numFmt: isCurrency ? '"₹"#,##0.00' : '#,##0',
          },
        };
      }
    });
    row++;
  }

  return { aoa, merges, colWidths, freezeRow: headerRow, headerRow, dataEndRow, totalRow };
}

export async function exportProfessionalExcel(cfg: ExcelExportConfig): Promise<void> {
  const { aoa, merges, colWidths, freezeRow, headerRow, dataEndRow } = buildAOA(cfg);

  const ws: XLSX.WorkSheet = XLSX.utils.aoa_to_sheet(aoa);

  // Apply merges
  ws['!merges'] = merges;

  // Column widths
  ws['!cols'] = colWidths;

  // Freeze panes (freeze rows above and including header row)
  ws['!freeze'] = { xSplit: 0, ySplit: freezeRow + 1, topLeftCell: XLSX.utils.encode_cell({ r: freezeRow + 1, c: 0 }), activePane: 'bottomRight', state: 'frozen' };

  // Auto filter on header row
  const lastColLetter = XLSX.utils.encode_cell({ r: 0, c: cfg.columns.length - 1 });
  ws['!autofilter'] = { ref: `A${headerRow + 1}:${lastColLetter}${dataEndRow + 1}` };

  // Print settings
  ws['!margins'] = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };
  ws['!pageSetup'] = {
    paperSize: 9, // A4
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 0,
    scale: undefined,
    horizontalCentered: true,
  };
  ws['!printTitles'] = { rows: `${headerRow + 1}:${headerRow + 1}` };
  ws['!headerFooter'] = {
    oddHeader: `&L${COMPANY.name}&C${cfg.reportTitle}&R&D`,
    oddFooter: `&L&D &T&CPage &P of &N&R${COMPANY.name}`,
  };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');

  // Filename
  const fromPart = cfg.fromDate ? fmtDate(cfg.fromDate).replace(/-/g, '') : 'All';
  const toPart = cfg.toDate ? fmtDate(cfg.toDate).replace(/-/g, '') : 'All';
  const filename = `${cfg.filenamePrefix}_${fromPart}_to_${toPart}.xlsx`;

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array', cellStyles: true }) as ArrayBuffer;
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
