import { useRef } from 'react';
import { Printer, X, Download } from 'lucide-react';
import { MilkEntry } from '@/types/database';
import { formatDate } from '@/lib/calc';
import { COMPANY } from '@/lib/company';

interface InvoiceSettings {
  customerName: string;
  customerAddress: string;
  customerGstin: string;
  invoiceDate: string;
  invoiceNumber: string;
}

interface Props {
  entries: MilkEntry[];
  settings: InvoiceSettings;
  onClose: () => void;
  embedded?: boolean;
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function numToWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = convert(rupees) + ' Rupees';
  if (paise > 0) words += ' and ' + convert(paise) + ' Paise';
  return words + ' Only';
}

function buildExcelXML(entries: MilkEntry[], settings: InvoiceSettings): string {
  const salesOf = (e: MilkEntry) => e.selling_amount || e.selling_rate * e.quantity;
  const totalQty = entries.reduce((s, e) => s + e.quantity, 0);
  const totalSales = entries.reduce((s, e) => s + salesOf(e), 0);
  const totalCommission = entries.reduce((s, e) => s + (e.commission_amount || 0), 0);
  const totalNet = totalSales - totalCommission;

  const s = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const num = (v: number) => Number(v).toFixed(2);

  const rows: string[] = [];

  // Header
  rows.push(`<Row><Cell ss:StyleID="hdr"><Data ss:Type="String">GSTIN: ${s(COMPANY.gstin)}</Data></Cell><Cell ss:StyleID="title" ss:MergeAcross="5"><Data ss:Type="String">Tax Invoice</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">Cell: ${s(COMPANY.cell1)}, ${s(COMPANY.cell2)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="company" ss:MergeAcross="6"><Data ss:Type="String">${s(COMPANY.name)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="tagline" ss:MergeAcross="6"><Data ss:Type="String">${s(COMPANY.tagline)}</Data></Cell></Row>`);
  COMPANY.addressLines.forEach((line) => {
    rows.push(`<Row><Cell ss:StyleID="addr" ss:MergeAcross="6"><Data ss:Type="String">${s(line)}</Data></Cell></Row>`);
  });
  rows.push(`<Row><Cell ss:StyleID="addr" ss:MergeAcross="6"><Data ss:Type="String">EMAIL: ${s(COMPANY.email)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="6"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Bill To:</Data></Cell><Cell ss:StyleID="bold"><Data ss:Type="String">${s(settings.customerName)}</Data></Cell><Cell ss:StyleID="lblR"><Data ss:Type="String">Date:</Data></Cell><Cell ss:StyleID="bold"><Data ss:Type="String">${s(settings.invoiceDate)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Address:</Data></Cell><Cell ss:StyleID="wrap"><Data ss:Type="String">${s(settings.customerAddress)}</Data></Cell><Cell ss:StyleID="lblR"><Data ss:Type="String">Invoice No.:</Data></Cell><Cell ss:StyleID="bold"><Data ss:Type="String">${s(settings.invoiceNumber)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">GSTIN No.</Data></Cell><Cell ss:StyleID="bold" ss:MergeAcross="4"><Data ss:Type="String">${s(settings.customerGstin)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="6"><Data ss:Type="String"></Data></Cell></Row>`);

  const cols = ['Sr No', 'Date', 'Product', 'District', 'Qty', 'Unit', 'Selling Rate', 'Amount (excl GST)', 'Commission', 'Net Amount'];
  rows.push(`<Row>${cols.map((c) => `<Cell ss:StyleID="th"><Data ss:Type="String">${s(c)}</Data></Cell>`).join('')}</Row>`);

  entries.forEach((e, idx) => {
    const sno = idx + 1;
    const amount = salesOf(e);
    const commission = e.commission_amount || 0;
    const net = amount - commission;
    rows.push(
      `<Row>` +
      `<Cell ss:StyleID="tc"><Data ss:Type="Number">${sno}</Data></Cell>` +
      `<Cell ss:StyleID="tc"><Data ss:Type="String">${s(formatDate(e.entry_date))}</Data></Cell>` +
      `<Cell ss:StyleID="tc"><Data ss:Type="String">${s(e.product_name || 'Milk')}</Data></Cell>` +
      `<Cell ss:StyleID="tl"><Data ss:Type="String">${s(e.district_name)}</Data></Cell>` +
      `<Cell ss:StyleID="tr"><Data ss:Type="Number">${num(e.quantity)}</Data></Cell>` +
      `<Cell ss:StyleID="tc"><Data ss:Type="String">${s(e.unit || 'L')}</Data></Cell>` +
      `<Cell ss:StyleID="tr"><Data ss:Type="Number">${num(e.selling_rate)}</Data></Cell>` +
      `<Cell ss:StyleID="tr"><Data ss:Type="Number">${num(amount)}</Data></Cell>` +
      `<Cell ss:StyleID="tr"><Data ss:Type="Number">${num(commission)}</Data></Cell>` +
      `<Cell ss:StyleID="trb"><Data ss:Type="Number">${num(net)}</Data></Cell>` +
      `</Row>`
    );
  });

  rows.push(
    `<Row>` +
    `<Cell ss:StyleID="trb" ss:MergeAcross="3"><Data ss:Type="String">TOTAL</Data></Cell>` +
    `<Cell ss:StyleID="trb"><Data ss:Type="Number">${totalQty.toFixed(2)}</Data></Cell>` +
    `<Cell ss:StyleID="trb"><Data ss:Type="String"></Data></Cell>` +
    `<Cell ss:StyleID="trb"><Data ss:Type="String"></Data></Cell>` +
    `<Cell ss:StyleID="trb"><Data ss:Type="Number">${num(totalSales)}</Data></Cell>` +
    `<Cell ss:StyleID="trb"><Data ss:Type="Number">${num(totalCommission)}</Data></Cell>` +
    `<Cell ss:StyleID="trb"><Data ss:Type="Number">${num(totalNet)}</Data></Cell>` +
    `</Row>`
  );

  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="7"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Amount in Words:</Data></Cell><Cell ss:StyleID="wrap" ss:MergeAcross="6"><Data ss:Type="String">${s(numToWords(Math.round(totalNet)))}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Total Sales Amount</Data></Cell><Cell ss:StyleID="trb" ss:MergeAcross="2"><Data ss:Type="String">Rs. ${fmt(totalSales)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Total Commission</Data></Cell><Cell ss:StyleID="trb" ss:MergeAcross="2"><Data ss:Type="String">(-) Rs. ${fmt(totalCommission)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="total"><Data ss:Type="String">Net Receivable</Data></Cell><Cell ss:StyleID="totalV"><Data ss:Type="String">Rs. ${fmt(totalNet)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="7"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Bank Name:</Data></Cell><Cell ss:StyleID="tl" ss:MergeAcross="4"><Data ss:Type="String">__________________________</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Account No.:</Data></Cell><Cell ss:StyleID="tl" ss:MergeAcross="4"><Data ss:Type="String">__________________________</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">IFSC Code:</Data></Cell><Cell ss:StyleID="tl" ss:MergeAcross="4"><Data ss:Type="String">__________________________</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Branch:</Data></Cell><Cell ss:StyleID="tl" ss:MergeAcross="4"><Data ss:Type="String">__________________________</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="7"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Declaration:</Data></Cell><Cell ss:StyleID="wrap" ss:MergeAcross="6"><Data ss:Type="String">We declare that this invoice shows the actual price of the goods / services described and that all particulars are true and correct.</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="7"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="7"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="7"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="7"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="sig" ss:MergeAcross="5"><Data ss:Type="String"></Data></Cell><Cell ss:StyleID="sigB"><Data ss:Type="String">For ${s(COMPANY.name)}</Data></Cell><Cell ss:StyleID="sigB"><Data ss:Type="String">Authorised Signatory</Data></Cell></Row>`);

  const colWidths = [35, 60, 50, 120, 50, 40, 55, 70, 55, 70]
    .map((w) => `<Column ss:Width="${w}"/>`).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><Font ss:FontName="Arial" ss:Size="10"/></Style>
  <Style ss:ID="title"><Font ss:FontName="Arial" ss:Size="14" ss:Bold="1"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="company"><Font ss:FontName="Arial" ss:Size="20" ss:Bold="1"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="tagline"><Font ss:FontName="Arial" ss:Size="12" ss:Bold="1"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="addr"><Font ss:FontName="Arial" ss:Size="9"/><Alignment ss:Horizontal="Center"/></Style>
  <Style ss:ID="hdr"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="bold"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="lblR"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="wrap"><Font ss:FontName="Arial" ss:Size="9"/><Alignment ss:WrapText="1" ss:Vertical="Top"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="empty"><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="th"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1"/><Alignment ss:Horizontal="Center" ss:WrapText="1"/><Interior ss:Color="#D9D9D9" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="tc"><Font ss:FontName="Arial" ss:Size="9"/><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="tl"><Font ss:FontName="Arial" ss:Size="9"/><Alignment ss:Horizontal="Left"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="tr"><Font ss:FontName="Arial" ss:Size="9"/><Alignment ss:Horizontal="Right"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="trb"><Font ss:FontName="Arial" ss:Size="9" ss:Bold="1"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#D9D9D9" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="total"><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1"/><Interior ss:Color="#D6EAF8" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="totalV"><Font ss:FontName="Arial" ss:Size="11" ss:Bold="1" ss:Color="#1A5276"/><Alignment ss:Horizontal="Right"/><Interior ss:Color="#D6EAF8" ss:Pattern="Solid"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="sig"><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
  <Style ss:ID="sigB"><Font ss:FontName="Arial" ss:Size="10" ss:Bold="1"/><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
 </Styles>
 <Worksheet ss:Name="Invoice">
  <Table>${colWidths}
   ${rows.join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;
}

export function MilkInvoice({ entries, settings, onClose, embedded = false }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const salesOf = (e: MilkEntry) => e.selling_amount || e.selling_rate * e.quantity;
  const totalQty = entries.reduce((s, e) => s + e.quantity, 0);
  const totalSales = entries.reduce((s, e) => s + salesOf(e), 0);
  const totalCommission = entries.reduce((s, e) => s + (e.commission_amount || 0), 0);
  const totalNet = totalSales - totalCommission;

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Popup blocked. Please allow popups for this site to print the invoice.');
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Milk Invoice - ${settings.invoiceNumber}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4 landscape; margin: 8mm; }
  body { font-family: Arial, sans-serif; font-size: 9px; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .invoice-wrap { width: 277mm; margin: 0 auto; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  td, th { border: 1px solid #000; padding: 2px 3px; vertical-align: middle; word-break: break-word; overflow: hidden; }
  th { background-color: #d9d9d9 !important; font-weight: bold; text-align: center; }
  .bg-gray-100, .bg-gray-50 { background-color: #f3f4f6 !important; }
  .bg-sky-50 { background-color: #f0f9ff !important; }
  .text-xl { font-size: 14px; }
  .text-sm { font-size: 10px; }
  .text-base { font-size: 11px; }
  @media print {
    body { width: 277mm; font-size: 9px; }
    .invoice-wrap { width: 277mm; }
  }
</style></head><body>
<div class="invoice-wrap">${content.innerHTML}</div>
</body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 300);
  };

  const handleDownloadExcel = () => {
    const xml = buildExcelXML(entries, settings);
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Milk_Invoice_${settings.invoiceNumber}_${settings.invoiceDate.replace(/[./]/g, '-')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const cell = 'border border-black px-1 py-1 text-[10px] leading-tight';
  const hdr = `${cell} font-bold bg-gray-100 text-center`;

  const actionButtons = (
    <>
      <button
        onClick={handleDownloadExcel}
        className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-emerald-700"
      >
        <Download className="h-4 w-4" />
        Download Excel
      </button>
      <button
        onClick={handlePrint}
        className="flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-sky-700"
      >
        <Printer className="h-4 w-4" />
        Print / PDF
      </button>
      {!embedded && (
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
          Close
        </button>
      )}
    </>
  );

  if (embedded) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap justify-end gap-2">{actionButtons}</div>
        <div
          ref={printRef}
          className="w-full rounded-lg bg-white shadow-sm"
          style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#000' }}
        >
        {/* HEADER TABLE */}
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${cell} w-1/4 font-bold`}>GSTIN : {COMPANY.gstin}</td>
              <td className={`${cell} w-2/4 text-center`}>
                <span className="text-base font-bold underline">Tax Invoice</span>
              </td>
              <td className={`${cell} w-1/4 text-right`}>
                <div className="font-bold">Cell: {COMPANY.cell1}</div>
                <div className="font-bold">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{COMPANY.cell2}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className={`${cell} text-center text-xl font-bold`}>
                {COMPANY.name}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className={`${cell} text-center text-sm font-bold`}>
                {COMPANY.tagline}
              </td>
            </tr>
            {COMPANY.addressLines.map((line, i) => (
              <tr key={i}>
                <td colSpan={3} className={`${cell} text-center text-xs`}>
                  {line}
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3} className={`${cell} text-center text-xs`}>
                EMAIL: {COMPANY.email}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black px-2 py-2">&nbsp;</td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black px-2 py-1 align-top">
                <div className="grid grid-cols-[80px_1fr] gap-y-0.5">
                  <span className="text-xs font-bold">Bill To:</span>
                  <span className="text-xs font-bold">{settings.customerName}</span>
                  <span className="text-xs font-bold">Address:</span>
                  <span className="text-xs">
                    {settings.customerAddress.split('\n').map((line, i) => (
                      <span key={i}>{line}<br /></span>
                    ))}
                  </span>
                </div>
              </td>
              <td className="border border-black px-2 py-1 align-top">
                <div className="grid grid-cols-[90px_1fr] gap-y-0.5">
                  <span className="text-xs text-right font-semibold">Date:</span>
                  <span className="text-xs font-bold pl-2">{settings.invoiceDate}</span>
                  <span className="text-xs text-right font-semibold">Invoice No.:</span>
                  <span className="text-xs font-bold pl-2">{settings.invoiceNumber}</span>
                </div>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className="border border-black px-2 py-1">
                <span className="text-xs font-bold">GSTIN No. </span>
                <span className="text-xs font-bold">{settings.customerGstin}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* LINE ITEMS TABLE */}
        <table className="w-full border-collapse mt-0" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '40px' }} />
            <col style={{ width: '70px' }} />
            <col />
            <col style={{ width: '70px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '90px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '90px' }} />
          </colgroup>
          <thead>
            <tr>
              <th className={hdr}>Sr<br/>No</th>
              <th className={hdr}>Date</th>
              <th className={hdr}>District</th>
              <th className={hdr}>Qty<br/>(Litres)</th>
              <th className={hdr}>Selling<br/>Rate/L</th>
              <th className={hdr}>Amount<br/>(excl GST)</th>
              <th className={hdr}>Commission</th>
              <th className={hdr}>Net<br/>Amount</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e, i) => {
              const sno = i + 1;
              const amount = salesOf(e);
              const commission = e.commission_amount || 0;
              const net = amount - commission;
              return (
                <tr key={e.id} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                  <td className={`${cell} text-center`}>{sno}</td>
                  <td className={`${cell} text-center`}>{formatDate(e.entry_date)}</td>
                  <td className={`${cell}`}>{e.district_name}</td>
                  <td className={`${cell} text-right`}>{e.quantity.toFixed(0)}</td>
                  <td className={`${cell} text-right`}>{fmt(e.selling_rate)}</td>
                  <td className={`${cell} text-right`}>{fmt(amount)}</td>
                  <td className={`${cell} text-right text-amber-700`}>{commission > 0 ? fmt(commission) : '—'}</td>
                  <td className={`${cell} text-right font-bold`}>{fmt(net)}</td>
                </tr>
              );
            })}
            <tr className="bg-gray-100">
              <td colSpan={3} className={`${cell} text-right font-bold`}>TOTAL</td>
              <td className={`${cell} text-right font-bold`}>{totalQty.toFixed(0)}</td>
              <td className={`${cell}`}></td>
              <td className={`${cell} text-right font-bold`}>{fmt(totalSales)}</td>
              <td className={`${cell} text-right font-bold`}>{fmt(totalCommission)}</td>
              <td className={`${cell} text-right font-bold`}>{fmt(totalNet)}</td>
            </tr>
          </tbody>
        </table>

        {/* SUMMARY + DECLARATION */}
        <table className="w-full border-collapse mt-0">
          <tbody>
            <tr>
              <td className="border border-black px-3 py-2 w-1/2 align-top">
                <p className="text-xs font-bold mb-1">Amount in Words:</p>
                <p className="text-xs font-semibold text-slate-800 capitalize">
                  {numToWords(Math.round(totalNet))}
                </p>
              </td>
              <td className="border border-black px-0 py-0 w-1/2 align-top">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className="border border-black px-3 py-1 text-xs font-semibold">Total Sales Amount</td>
                      <td className="border border-black px-3 py-1 text-xs text-right font-bold">
                        ₹ {fmt(totalSales)}
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-black px-3 py-1 text-xs font-semibold">Total Commission</td>
                      <td className="border border-black px-3 py-1 text-xs text-right font-bold text-amber-700">
                        (−) ₹ {fmt(totalCommission)}
                      </td>
                    </tr>
                    <tr className="bg-sky-50">
                      <td className="border border-black px-3 py-2 text-sm font-bold">Net Receivable</td>
                      <td className="border border-black px-3 py-2 text-sm text-right font-bold text-sky-800">
                        ₹ {fmt(totalNet)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
            <tr>
              <td className="border border-black px-3 py-2 align-top">
                <p className="text-xs font-bold mb-1">Bank Details:</p>
                <div className="text-xs space-y-0.5">
                  <p><span className="font-semibold">Bank Name:</span> ___________________________</p>
                  <p><span className="font-semibold">Account No.:</span> ___________________________</p>
                  <p><span className="font-semibold">IFSC Code:</span> ___________________________</p>
                  <p><span className="font-semibold">Branch:</span> ___________________________</p>
                </div>
              </td>
              <td className="border border-black px-3 py-2 text-right align-bottom">
                <p className="text-xs mb-10">For {COMPANY.name}</p>
                <p className="text-xs font-bold border-t border-black pt-1 mt-1">Authorised Signatory</p>
              </td>
            </tr>
            <tr>
              <td colSpan={2} className="border border-black px-3 py-1">
                <p className="text-xs font-bold mb-0.5">Declaration:</p>
                <p className="text-xs text-slate-600">
                  We declare that this invoice shows the actual price of the goods / services described and that
                  all particulars are true and correct.
                </p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-8">
      <div className="fixed right-6 top-6 z-50 flex gap-2">{actionButtons}</div>
      <div className="w-full max-w-[1100px]">
        <div
          ref={printRef}
          className="w-full rounded-lg bg-white shadow-2xl"
          style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#000' }}
        >
          {/* HEADER TABLE */}
          <table className="w-full border-collapse">
            <tbody>
              <tr>
                <td className={`${cell} w-1/4 font-bold`}>GSTIN : {COMPANY.gstin}</td>
                <td className={`${cell} w-2/4 text-center`}>
                  <span className="text-base font-bold underline">Tax Invoice</span>
                </td>
                <td className={`${cell} w-1/4 text-right`}>
                  <div className="font-bold">Cell: {COMPANY.cell1}</div>
                  <div className="font-bold">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{COMPANY.cell2}</div>
                </td>
              </tr>
              <tr>
                <td colSpan={3} className={`${cell} text-center text-xl font-bold`}>
                  {COMPANY.name}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className={`${cell} text-center text-sm font-bold`}>
                  {COMPANY.tagline}
                </td>
              </tr>
              {COMPANY.addressLines.map((line, i) => (
                <tr key={i}>
                  <td colSpan={3} className={`${cell} text-center text-xs`}>
                    {line}
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} className={`${cell} text-center text-xs`}>
                  EMAIL: {COMPANY.email}
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="border border-black px-2 py-2">&nbsp;</td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-black px-2 py-1 align-top">
                  <div className="grid grid-cols-[80px_1fr] gap-y-0.5">
                    <span className="text-xs font-bold">Bill To:</span>
                    <span className="text-xs font-bold">{settings.customerName}</span>
                    <span className="text-xs font-bold">Address:</span>
                    <span className="text-xs">
                      {settings.customerAddress.split('\n').map((line, i) => (
                        <span key={i}>{line}<br /></span>
                      ))}
                    </span>
                  </div>
                </td>
                <td className="border border-black px-2 py-1 align-top">
                  <div className="grid grid-cols-[90px_1fr] gap-y-0.5">
                    <span className="text-xs text-right font-semibold">Date:</span>
                    <span className="text-xs font-bold pl-2">{settings.invoiceDate}</span>
                    <span className="text-xs text-right font-semibold">Invoice No.:</span>
                    <span className="text-xs font-bold pl-2">{settings.invoiceNumber}</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td colSpan={3} className="border border-black px-2 py-1">
                  <span className="text-xs font-bold">GSTIN No. </span>
                  <span className="text-xs font-bold">{settings.customerGstin}</span>
                </td>
              </tr>
            </tbody>
          </table>

          {/* LINE ITEMS TABLE */}
          <table className="w-full border-collapse mt-0" style={{ tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '40px' }} />
              <col style={{ width: '70px' }} />
              <col />
              <col style={{ width: '70px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '90px' }} />
              <col style={{ width: '70px' }} />
              <col style={{ width: '90px' }} />
            </colgroup>
            <thead>
              <tr>
                <th className={hdr}>Sr<br/>No</th>
                <th className={hdr}>Date</th>
                <th className={hdr}>District</th>
                <th className={hdr}>Qty<br/>(Litres)</th>
                <th className={hdr}>Selling<br/>Rate/L</th>
                <th className={hdr}>Amount<br/>(excl GST)</th>
                <th className={hdr}>Commission</th>
                <th className={hdr}>Net<br/>Amount</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const sno = i + 1;
                const amount = salesOf(e);
                const commission = e.commission_amount || 0;
                const net = amount - commission;
                return (
                  <tr key={e.id} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                    <td className={`${cell} text-center`}>{sno}</td>
                    <td className={`${cell} text-center`}>{formatDate(e.entry_date)}</td>
                    <td className={`${cell}`}>{e.district_name}</td>
                    <td className={`${cell} text-right`}>{e.quantity.toFixed(0)}</td>
                    <td className={`${cell} text-right`}>{fmt(e.selling_rate)}</td>
                    <td className={`${cell} text-right`}>{fmt(amount)}</td>
                    <td className={`${cell} text-right text-amber-700`}>{commission > 0 ? fmt(commission) : '—'}</td>
                    <td className={`${cell} text-right font-bold`}>{fmt(net)}</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-100">
                <td colSpan={3} className={`${cell} text-right font-bold`}>TOTAL</td>
                <td className={`${cell} text-right font-bold`}>{totalQty.toFixed(0)}</td>
                <td className={`${cell}`}></td>
                <td className={`${cell} text-right font-bold`}>{fmt(totalSales)}</td>
                <td className={`${cell} text-right font-bold`}>{fmt(totalCommission)}</td>
                <td className={`${cell} text-right font-bold`}>{fmt(totalNet)}</td>
              </tr>
            </tbody>
          </table>

          {/* SUMMARY + DECLARATION */}
          <table className="w-full border-collapse mt-0">
            <tbody>
              <tr>
                <td className="border border-black px-3 py-2 w-1/2 align-top">
                  <p className="text-xs font-bold mb-1">Amount in Words:</p>
                  <p className="text-xs font-semibold text-slate-800 capitalize">
                    {numToWords(Math.round(totalNet))}
                  </p>
                </td>
                <td className="border border-black px-0 py-0 w-1/2 align-top">
                  <table className="w-full border-collapse">
                    <tbody>
                      <tr>
                        <td className="border border-black px-3 py-1 text-xs font-semibold">Total Sales Amount</td>
                        <td className="border border-black px-3 py-1 text-xs text-right font-bold">
                          ₹ {fmt(totalSales)}
                        </td>
                      </tr>
                      <tr>
                        <td className="border border-black px-3 py-1 text-xs font-semibold">Total Commission</td>
                        <td className="border border-black px-3 py-1 text-xs text-right font-bold text-amber-700">
                          (−) ₹ {fmt(totalCommission)}
                        </td>
                      </tr>
                      <tr className="bg-sky-50">
                        <td className="border border-black px-3 py-2 text-sm font-bold">Net Receivable</td>
                        <td className="border border-black px-3 py-2 text-sm text-right font-bold text-sky-800">
                          ₹ {fmt(totalNet)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </td>
              </tr>
              <tr>
                <td className="border border-black px-3 py-2 align-top">
                  <p className="text-xs font-bold mb-1">Bank Details:</p>
                  <div className="text-xs space-y-0.5">
                    <p><span className="font-semibold">Bank Name:</span> ___________________________</p>
                    <p><span className="font-semibold">Account No.:</span> ___________________________</p>
                    <p><span className="font-semibold">IFSC Code:</span> ___________________________</p>
                    <p><span className="font-semibold">Branch:</span> ___________________________</p>
                  </div>
                </td>
                <td className="border border-black px-3 py-2 text-right align-bottom">
                  <p className="text-xs mb-10">For {COMPANY.name}</p>
                  <p className="text-xs font-bold border-t border-black pt-1 mt-1">Authorised Signatory</p>
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="border border-black px-3 py-1">
                  <p className="text-xs font-bold mb-0.5">Declaration:</p>
                  <p className="text-xs text-slate-600">
                    We declare that this invoice shows the actual price of the goods / services described and that
                    all particulars are true and correct.
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
