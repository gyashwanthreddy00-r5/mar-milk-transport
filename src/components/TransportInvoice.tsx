import { useRef, useState } from 'react';
import { Printer, X, Download } from 'lucide-react';
import { CompanyBill } from '@/types/database';
import { formatDate } from '@/lib/calc';
import { COMPANY } from '@/lib/company';

interface InvoiceSettings {
  customerName: string;
  customerAddress: string;
  customerGstin: string;
  invoiceDate: string;
  invoiceNumber: string;
}

type InvoiceBill = CompanyBill & { owner_name?: string | null };

interface Props {
  bills: InvoiceBill[];
  settings: InvoiceSettings;
  withGst: boolean;
  onClose: () => void;
  onSettingsChange: (s: InvoiceSettings) => void;
}

const SUPPLIER = {
  name: COMPANY.name,
  tagline: COMPANY.tagline,
  email: COMPANY.email,
  gstin: COMPANY.gstin,
  cell1: COMPANY.phone1,
  cell2: COMPANY.phone2,
};

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

function buildExcelXML(bills: InvoiceBill[], settings: InvoiceSettings, withGst: boolean): string {
  const rowGst = bills.map((b) => withGst ? b.amount_without_gst * 0.18 : 0);
  const totalExcl = bills.reduce((s, b) => s + b.amount_without_gst, 0);
  const totalGst = rowGst.reduce((s, g) => s + g, 0);
  const totalIncl = totalExcl + totalGst;
  const totalReceivable = bills.reduce((s, b, i) => s + b.amount_without_gst + rowGst[i], 0);
  const totalQty = bills.reduce((s, b) => s + b.tons, 0);

  const s = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const num = (v: number) => Number(v).toFixed(2);

  const rows: string[] = [];

  rows.push(`<Row><Cell ss:StyleID="hdr"><Data ss:Type="String">GSTIN: ${s(SUPPLIER.gstin)}</Data></Cell><Cell ss:StyleID="title" ss:MergeAcross="2"><Data ss:Type="String">Tax Invoice</Data></Cell><Cell ss:StyleID="hdr"><Data ss:Type="String">Cell: ${s(SUPPLIER.cell1)}, ${s(SUPPLIER.cell2)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="company" ss:MergeAcross="3"><Data ss:Type="String">${s(SUPPLIER.name)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="tagline" ss:MergeAcross="3"><Data ss:Type="String">${s(SUPPLIER.tagline)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="addr" ss:MergeAcross="3"><Data ss:Type="String">Sy No: 25, Majeedpur to Medchal Checkpost Road, Opp Essar Petrol Pump,,</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="addr" ss:MergeAcross="3"><Data ss:Type="String">Majeedpur (V), MEDCHAL (M) MEDCHAL-MALKAJGIRI DIST., TELANGANA, 501401</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="addr" ss:MergeAcross="3"><Data ss:Type="String">EMAIL: ${s(SUPPLIER.email)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="3"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Bill To:</Data></Cell><Cell ss:StyleID="bold"><Data ss:Type="String">${s(settings.customerName)}</Data></Cell><Cell ss:StyleID="lblR"><Data ss:Type="String">Date:</Data></Cell><Cell ss:StyleID="bold"><Data ss:Type="String">${s(settings.invoiceDate)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Address:</Data></Cell><Cell ss:StyleID="wrap"><Data ss:Type="String">${s(settings.customerAddress)}</Data></Cell><Cell ss:StyleID="lblR"><Data ss:Type="String">Invoice No.:</Data></Cell><Cell ss:StyleID="bold"><Data ss:Type="String">${s(settings.invoiceNumber)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">GSTIN No.</Data></Cell><Cell ss:StyleID="bold" ss:MergeAcross="2"><Data ss:Type="String">${s(settings.customerGstin)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="14"><Data ss:Type="String"></Data></Cell></Row>`);

  const cols = withGst
    ? ['Sr No', 'Description of Service', 'LR No', 'Material', 'Vehicle No', 'Owner Name', 'Date', 'Qty (MT)', 'Rate /MT', 'Amount (excl GST)', 'CGST 9%', 'SGST 9%', 'Net Receivable']
    : ['Sr No', 'Description of Service', 'LR No', 'Material', 'Vehicle No', 'Owner Name', 'Date', 'Qty (MT)', 'Rate /MT', 'Amount', 'Net Receivable'];
  rows.push(`<Row>${cols.map((c) => `<Cell ss:StyleID="th"><Data ss:Type="String">${s(c)}</Data></Cell>`).join('')}</Row>`);

  bills.forEach((b, idx) => {
    const sno = idx + 1;
    const gst = rowGst[idx];
    rows.push(
      `<Row>` +
      `<Cell ss:StyleID="tc"><Data ss:Type="Number">${sno}</Data></Cell>` +
      `<Cell ss:StyleID="tl"><Data ss:Type="String">${s(`Transport Service - ${b.loading_location || ''} to ${b.unloading_location}`)}</Data></Cell>` +
      `<Cell ss:StyleID="tc"><Data ss:Type="String">${s(b.lr_no || '-')}</Data></Cell>` +
      `<Cell ss:StyleID="tc"><Data ss:Type="String">${s(b.material_name || '-')}</Data></Cell>` +
      `<Cell ss:StyleID="tc"><Data ss:Type="String">${s(b.vehicle_number)}</Data></Cell>` +
      `<Cell ss:StyleID="tl"><Data ss:Type="String">${s(b.owner_name || '-')}</Data></Cell>` +
      `<Cell ss:StyleID="tc"><Data ss:Type="String">${s(formatDate(b.trip_date))}</Data></Cell>` +
      `<Cell ss:StyleID="tr"><Data ss:Type="Number">${b.tons}</Data></Cell>` +
      `<Cell ss:StyleID="tr"><Data ss:Type="Number">${num(b.per_ton)}</Data></Cell>` +
      `<Cell ss:StyleID="tr"><Data ss:Type="Number">${num(b.amount_without_gst)}</Data></Cell>` +
      (withGst ? `<Cell ss:StyleID="tr"><Data ss:Type="Number">${num(gst / 2)}</Data></Cell>` + `<Cell ss:StyleID="tr"><Data ss:Type="Number">${num(gst / 2)}</Data></Cell>` : '') +
      `<Cell ss:StyleID="trb"><Data ss:Type="Number">${num(b.amount_without_gst + gst)}</Data></Cell>` +
      `</Row>`
    );
  });

  rows.push(
    `<Row>` +
    `<Cell ss:StyleID="trb" ss:MergeAcross="6"><Data ss:Type="String">TOTAL</Data></Cell>` +
    `<Cell ss:StyleID="trb"><Data ss:Type="Number">${totalQty.toFixed(2)}</Data></Cell>` +
    `<Cell ss:StyleID="trb"><Data ss:Type="String"></Data></Cell>` +
    `<Cell ss:StyleID="trb"><Data ss:Type="Number">${num(totalExcl)}</Data></Cell>` +
    (withGst ? `<Cell ss:StyleID="trb"><Data ss:Type="Number">${num(totalGst / 2)}</Data></Cell>` + `<Cell ss:StyleID="trb"><Data ss:Type="Number">${num(totalGst / 2)}</Data></Cell>` : '') +
    `<Cell ss:StyleID="trb"><Data ss:Type="Number">${num(totalReceivable)}</Data></Cell>` +
    `</Row>`
  );

  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="14"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Amount in Words:</Data></Cell><Cell ss:StyleID="wrap" ss:MergeAcross="7"><Data ss:Type="String">${s(numToWords(Math.round(totalReceivable)))}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">${withGst ? 'Total Amount (excl GST)' : 'Amount'}</Data></Cell><Cell ss:StyleID="trb" ss:MergeAcross="2"><Data ss:Type="String">Rs. ${fmt(totalExcl)}</Data></Cell></Row>`);
  if (withGst) {
    rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">CGST @ 9%</Data></Cell><Cell ss:StyleID="trb" ss:MergeAcross="2"><Data ss:Type="String">Rs. ${fmt(totalGst / 2)}</Data></Cell></Row>`);
    rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">SGST @ 9%</Data></Cell><Cell ss:StyleID="trb" ss:MergeAcross="2"><Data ss:Type="String">Rs. ${fmt(totalGst / 2)}</Data></Cell></Row>`);
    rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Total Amount (incl GST)</Data></Cell><Cell ss:StyleID="trb" ss:MergeAcross="2"><Data ss:Type="String">Rs. ${fmt(totalIncl)}</Data></Cell></Row>`);
  }
  rows.push(`<Row><Cell ss:StyleID="total"><Data ss:Type="String">Net Receivable</Data></Cell><Cell ss:StyleID="totalV"><Data ss:Type="String">Rs. ${fmt(totalReceivable)}</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="14"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Bank Name:</Data></Cell><Cell ss:StyleID="tl" ss:MergeAcross="5"><Data ss:Type="String">__________________________</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Account No.:</Data></Cell><Cell ss:StyleID="tl" ss:MergeAcross="5"><Data ss:Type="String">__________________________</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">IFSC Code:</Data></Cell><Cell ss:StyleID="tl" ss:MergeAcross="5"><Data ss:Type="String">__________________________</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Branch:</Data></Cell><Cell ss:StyleID="tl" ss:MergeAcross="5"><Data ss:Type="String">__________________________</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="14"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="bold"><Data ss:Type="String">Declaration:</Data></Cell><Cell ss:StyleID="wrap" ss:MergeAcross="7"><Data ss:Type="String">We declare that this invoice shows the actual price of the goods / services described and that all particulars are true and correct.</Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="14"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="14"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="14"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="empty" ss:MergeAcross="14"><Data ss:Type="String"></Data></Cell></Row>`);
  rows.push(`<Row><Cell ss:StyleID="sig" ss:MergeAcross="11"><Data ss:Type="String"></Data></Cell><Cell ss:StyleID="sigB"><Data ss:Type="String">For ${s(SUPPLIER.name)}</Data></Cell><Cell ss:StyleID="sigB"><Data ss:Type="String"></Data></Cell><Cell ss:StyleID="sigB"><Data ss:Type="String">Authorised Signatory</Data></Cell></Row>`);

  const colWidths = (withGst
    ? [35, 180, 50, 60, 70, 95, 60, 45, 55, 70, 40, 40, 80]
    : [35, 180, 50, 60, 70, 95, 60, 45, 55, 70, 80])
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

export function TransportInvoice({ bills, settings, withGst, onClose, onSettingsChange }: Props) {
  const printRef = useRef<HTMLDivElement>(null);
  const [showEditPanel, setShowEditPanel] = useState(true);
  const update = (field: keyof InvoiceSettings, value: string) => onSettingsChange({ ...settings, [field]: value });

  const invoiceRows = bills.map((bill) => {
    const gstAmount = withGst ? bill.amount_without_gst * 0.18 : 0;
    return {
      bill,
      gstAmount,
      amountWithGst: bill.amount_without_gst + gstAmount,
      invoiceAmount: bill.amount_without_gst + gstAmount,
    };
  });
  const grandTotal = invoiceRows.reduce((s, row) => s + row.invoiceAmount, 0);
  const totalAmtWithoutGst = bills.reduce((s, b) => s + b.amount_without_gst, 0);
  const totalAmtWithGst = invoiceRows.reduce((s, row) => s + row.amountWithGst, 0);
  const totalGst = invoiceRows.reduce((s, row) => s + row.gstAmount, 0);

  const handlePrint = () => {
    const content = printRef.current;
    if (!content) return;
    const win = window.open('', '_blank', 'width=900,height=700');
    if (!win) {
      alert('Popup blocked. Please allow popups for this site to print the invoice.');
      return;
    }
    win.document.write(`<!DOCTYPE html><html><head><title>Transport Invoice - ${settings.invoiceNumber}</title>
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
    const xml = buildExcelXML(bills, settings, withGst);
    const blob = new Blob([xml], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Invoice_${settings.invoiceNumber}_${settings.invoiceDate.replace(/[./]/g, '-')}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const cell = 'border border-black px-1 py-1 text-[10px] leading-tight';
  const hdr = `${cell} font-bold bg-gray-100 text-center`;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/60 p-4 pt-8">
      {/* Controls */}
      <div className="fixed right-6 top-6 z-50 flex gap-2">
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
        <button
          onClick={onClose}
          className="flex items-center gap-2 rounded-xl bg-slate-700 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
          Close
        </button>
      </div>

      {/* Editable Settings Panel — updates preview live, excluded from print */}
      {showEditPanel && (
        <div className="fixed left-6 top-6 z-50 w-72 rounded-2xl bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Invoice Details</h3>
            <button
              onClick={() => setShowEditPanel(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Invoice Number</label>
              <input
                type="text"
                value={settings.invoiceNumber}
                onChange={(e) => update('invoiceNumber', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Invoice Date</label>
              <input
                type="text"
                value={settings.invoiceDate}
                onChange={(e) => update('invoiceDate', e.target.value)}
                placeholder="DD.MM.YYYY"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Customer / Bill To Name</label>
              <input
                type="text"
                value={settings.customerName}
                onChange={(e) => update('customerName', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Customer GSTIN</label>
              <input
                type="text"
                value={settings.customerGstin}
                onChange={(e) => update('customerGstin', e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Customer Address</label>
              <textarea
                value={settings.customerAddress}
                onChange={(e) => update('customerAddress', e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 focus:outline-none"
              />
            </div>
          </div>
        </div>
      )}
      {!showEditPanel && (
        <button
          onClick={() => setShowEditPanel(true)}
          className="fixed left-6 top-6 z-50 flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-sky-700"
        >
          Edit Details
        </button>
      )}

      {/* Invoice Paper */}
      <div
        ref={printRef}
        className="w-full max-w-[1100px] rounded-lg bg-white shadow-2xl"
        style={{ fontFamily: 'Arial, sans-serif', fontSize: '10px', color: '#000' }}
      >
        {/* ── HEADER TABLE ── */}
        <table className="w-full border-collapse">
          <tbody>
            <tr>
              <td className={`${cell} w-1/4 font-bold`}>GSTIN : {SUPPLIER.gstin}</td>
              <td className={`${cell} w-2/4 text-center`}>
                <span className="text-base font-bold underline">Tax Invoice</span>
              </td>
              <td className={`${cell} w-1/4 text-right`}>
                <div className="font-bold">Cell: {SUPPLIER.cell1}</div>
                <div className="font-bold">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{SUPPLIER.cell2}</div>
              </td>
            </tr>
            <tr>
              <td colSpan={3} className={`${cell} text-center text-xl font-bold`}>
                {SUPPLIER.name}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className={`${cell} text-center text-sm font-bold`}>
                {SUPPLIER.tagline}
              </td>
            </tr>
            <tr>
              <td colSpan={3} className={`${cell} text-center text-xs`}>
                Sy No: 25, Majeedpur to Medchal Checkpost Road, Opp Essar Petrol Pump,,
              </td>
            </tr>
            <tr>
              <td colSpan={3} className={`${cell} text-center text-xs`}>
                Majeedpur (V), MEDCHAL (M) MEDCHAL-MALKAJGIRI DIST., TELANGANA, 501401
              </td>
            </tr>
            <tr>
              <td colSpan={3} className={`${cell} text-center text-xs`}>
                EMAIL: {SUPPLIER.email}
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

        {/* ── LINE ITEMS TABLE ── */}
        <table className="w-full border-collapse mt-0" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '34px' }} />
            <col />
            <col style={{ width: '58px' }} />
            <col style={{ width: '70px' }} />
            <col style={{ width: '78px' }} />
            <col style={{ width: '92px' }} />
            <col style={{ width: '58px' }} />
            <col style={{ width: '46px' }} />
            <col style={{ width: '58px' }} />
            <col style={{ width: '76px' }} />
            {withGst && <col style={{ width: '38px' }} />}
            {withGst && <col style={{ width: '72px' }} />}
            <col style={{ width: '80px' }} />
          </colgroup>
          <thead>
            <tr>
              <th className={hdr}>Sr<br/>No</th>
              <th className={hdr}>Description of Service</th>
              <th className={hdr}>LR No.</th>
              <th className={hdr}>Material</th>
              <th className={hdr}>Vehicle No.</th>
              <th className={hdr}>Owner Name</th>
              <th className={hdr}>Date</th>
              <th className={hdr}>Qty<br/>(MT)</th>
              <th className={hdr}>Rate<br/>/MT</th>
              <th className={hdr}>{withGst ? <>Amount<br/>(excl GST)</> : <>Amount</>}</th>
              {withGst && <th className={hdr}>CGST<br/>9%</th>}
              {withGst && <th className={hdr}>SGST<br/>9%</th>}
              <th className={hdr}>Grand<br/>Total</th>
            </tr>
          </thead>
          <tbody>
{invoiceRows.map(({ bill: b, gstAmount }, i) => {
    const sno = i + 1;
    return (
              <tr key={b.id} className={i % 2 === 1 ? 'bg-gray-50' : ''}>
                <td className={`${cell} text-center`}>{sno}</td>
                <td className={`${cell}`}>
                  Transport Service —{' '}
                  {b.loading_location && `${b.loading_location} to `}{b.unloading_location}
                </td>
                <td className={`${cell} text-center`}>{b.lr_no || '—'}</td>
                <td className={`${cell} text-center`}>{b.material_name || '—'}</td>
                <td className={`${cell} text-center font-medium`}>{b.vehicle_number}</td>
                <td className={`${cell} text-center`}>{b.owner_name || '—'}</td>
                <td className={`${cell} text-center`}>{formatDate(b.trip_date)}</td>
                <td className={`${cell} text-right`}>{b.tons}</td>
                <td className={`${cell} text-right`}>{fmt(b.per_ton)}</td>
                <td className={`${cell} text-right`}>{fmt(b.amount_without_gst)}</td>
                {withGst && <td className={`${cell} text-right`}>{fmt(gstAmount / 2)}</td>}
                {withGst && <td className={`${cell} text-right`}>{fmt(gstAmount / 2)}</td>}
                <td className={`${cell} text-right font-bold`}>{fmt(b.amount_without_gst + gstAmount)}</td>
              </tr>
    );
  })}
            <tr className="bg-gray-100">
              <td colSpan={7} className={`${cell} text-right font-bold`}>TOTAL</td>
              <td className={`${cell} text-right font-bold`}>
                {bills.reduce((s, b) => s + b.tons, 0).toFixed(2)}
              </td>
              <td className={`${cell}`}></td>
              <td className={`${cell} text-right font-bold`}>
                {fmt(bills.reduce((s, b) => s + b.amount_without_gst, 0))}
              </td>
              {withGst && <td className={`${cell} text-right font-bold`}>{fmt(totalGst / 2)}</td>}
              {withGst && <td className={`${cell} text-right font-bold`}>{fmt(totalGst / 2)}</td>}
              <td className={`${cell} text-right font-bold`}>{fmt(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        {/* ── SUMMARY + DECLARATION ── */}
        <table className="w-full border-collapse mt-0">
          <tbody>
            <tr>
              <td className="border border-black px-3 py-2 w-1/2 align-top">
                <p className="text-xs font-bold mb-1">Amount in Words:</p>
                <p className="text-xs font-semibold text-slate-800 capitalize">
                  {numToWords(Math.round(grandTotal))}
                </p>
              </td>
              <td className="border border-black px-0 py-0 w-1/2 align-top">
                <table className="w-full border-collapse">
                  <tbody>
                    <tr>
                      <td className="border border-black px-3 py-1 text-xs font-semibold">{withGst ? 'Amount (Excl. GST)' : 'Amount'}</td>
                      <td className="border border-black px-3 py-1 text-xs text-right font-bold">
                        ₹ {fmt(totalAmtWithoutGst)}
                      </td>
                    </tr>
                    {withGst && <>
                      <tr>
                        <td className="border border-black px-3 py-1 text-xs font-semibold">CGST @ 9%</td>
                        <td className="border border-black px-3 py-1 text-xs text-right font-bold">₹ {fmt(totalGst / 2)}</td>
                      </tr>
                      <tr>
                        <td className="border border-black px-3 py-1 text-xs font-semibold">SGST @ 9%</td>
                        <td className="border border-black px-3 py-1 text-xs text-right font-bold">₹ {fmt(totalGst / 2)}</td>
                      </tr>
                      <tr>
                        <td className="border border-black px-3 py-1 text-xs font-semibold">Total Amount (incl. GST)</td>
                        <td className="border border-black px-3 py-1 text-xs text-right font-bold">₹ {fmt(totalAmtWithGst)}</td>
                      </tr>
                    </>}
                    <tr className="bg-sky-50">
                      <td className="border border-black px-3 py-2 text-sm font-bold">Grand Total</td>
                      <td className="border border-black px-3 py-2 text-sm text-right font-bold text-sky-800">
                        ₹ {fmt(grandTotal)}
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
                <p className="text-xs mb-10">For {SUPPLIER.name}</p>
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
