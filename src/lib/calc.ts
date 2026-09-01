export function formatCurrency(amount: number, currency = '₹'): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${amount < 0 ? '-' : ''}${currency}${formatted}`;
}

export function formatNumber(num: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

export function firstOfMonthISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

export function calcMilkMargin(purchaseRate: number, sellingRate: number, quantity: number): number {
  return (sellingRate - purchaseRate) * quantity;
}

export function calcDailyEmi(monthlyEmi: number): number {
  return monthlyEmi / 30;
}

export function calcGst(amount: number, gstRate: number): number {
  return (amount * gstRate) / 100;
}

export function calcCompanyBillTotals(
  tons: number,
  perTon: number,
  gstRate: number,
  advance: number,
  dieselLitres: number,
  dieselRate: number
) {
  const amountWithoutGst = tons * perTon;
  const gstAmount = calcGst(amountWithoutGst, gstRate);
  const grossCompanyIncome = amountWithoutGst + gstAmount;
  const dieselAmount = dieselLitres * dieselRate;
  const netCompanyIncome = grossCompanyIncome - dieselAmount - advance;
  const netReceivable = grossCompanyIncome - advance - dieselAmount;
  return { amountWithoutGst, gstAmount, amountWithGst: grossCompanyIncome, companyIncome: grossCompanyIncome, grossCompanyIncome, dieselAmount, netCompanyIncome, netReceivable };
}

export function calcMarBillTotals(
  netCompanyIncome: number,
  driverWage: number,
  dieselCost: number,
  tollGates: number,
  driverWaiting: number,
  otherCharges: number,
  maintenance: number,
  dailyEmi: number
) {
  const totalExpense =
    driverWage + dieselCost + tollGates + driverWaiting + otherCharges + maintenance + dailyEmi;
  const tripProfit = netCompanyIncome - totalExpense;
  return { totalExpense, tripProfit };
}

export function paymentStatusFromPaid(netReceivable: number, paidAmount: number): 'pending' | 'partial' | 'paid' {
  if (paidAmount <= 0) return 'pending';
  if (paidAmount >= netReceivable) return 'paid';
  return 'partial';
}
