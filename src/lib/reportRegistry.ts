export type ReportModule = 'milk' | 'transport';

export interface ReportDef {
  key: string;
  label: string;
  module: ReportModule;
}

export const MILK_REPORTS: ReportDef[] = [
  { key: 'milk:daily', label: 'Daily Milk Sales Report', module: 'milk' },
  { key: 'milk:dateWise', label: 'Date Wise Sales Report', module: 'milk' },
  { key: 'milk:monthly', label: 'Monthly Sales Report', module: 'milk' },
  { key: 'milk:customer', label: 'Customer Wise Report', module: 'milk' },
  { key: 'milk:route', label: 'Route Wise Report', module: 'milk' },
  { key: 'milk:vehicle', label: 'Vehicle Wise Report', module: 'milk' },
  { key: 'milk:product', label: 'Product Wise Report', module: 'milk' },
  { key: 'milk:quantity', label: 'Quantity Report', module: 'milk' },
  { key: 'milk:salesAmount', label: 'Sales Amount Report', module: 'milk' },
  { key: 'milk:paidBills', label: 'Paid Bills Report', module: 'milk' },
  { key: 'milk:pendingBills', label: 'Pending Bills Report', module: 'milk' },
  { key: 'milk:outstanding', label: 'Outstanding Report', module: 'milk' },
  { key: 'milk:collection', label: 'Collection Report', module: 'milk' },
  { key: 'milk:paymentHistory', label: 'Payment History Report', module: 'milk' },
  { key: 'milk:ledger', label: 'Customer Ledger', module: 'milk' },
  { key: 'milk:statement', label: 'Customer Statement', module: 'milk' },
  { key: 'milk:profit', label: 'Profit Report', module: 'milk' },
  { key: 'milk:gst', label: 'GST Report', module: 'milk' },
  { key: 'milk:invoiceRegister', label: 'Invoice Register', module: 'milk' },
  { key: 'milk:topCustomers', label: 'Top Customers Report', module: 'milk' },
];

export const TRANSPORT_REPORTS: ReportDef[] = [
  { key: 'transport:daily', label: 'Daily Trip Report', module: 'transport' },
  { key: 'transport:dateWise', label: 'Date Wise Trip Report', module: 'transport' },
  { key: 'transport:monthly', label: 'Monthly Trip Report', module: 'transport' },
  { key: 'transport:vehicle', label: 'Vehicle Wise Report', module: 'transport' },
  { key: 'transport:driver', label: 'Driver Wise Report', module: 'transport' },
  { key: 'transport:lrNumber', label: 'LR Number Report', module: 'transport' },
  { key: 'transport:material', label: 'Material Wise Report', module: 'transport' },
  { key: 'transport:loading', label: 'Loading Location Report', module: 'transport' },
  { key: 'transport:unloading', label: 'Unloading Location Report', module: 'transport' },
  { key: 'transport:customer', label: 'Customer Wise Report', module: 'transport' },
  { key: 'transport:companyIncome', label: 'Company Income Report', module: 'transport' },
  { key: 'transport:diesel', label: 'Diesel Expense Report', module: 'transport' },
  { key: 'transport:maintenance', label: 'Maintenance Report', module: 'transport' },
  { key: 'transport:advance', label: 'Advance Report', module: 'transport' },
  { key: 'transport:paidBills', label: 'Paid Bills Report', module: 'transport' },
  { key: 'transport:pendingBills', label: 'Pending Bills Report', module: 'transport' },
  { key: 'transport:outstanding', label: 'Outstanding Report', module: 'transport' },
  { key: 'transport:tripProfit', label: 'Trip Profit Report', module: 'transport' },
  { key: 'transport:vehicleProfit', label: 'Vehicle Profitability Report', module: 'transport' },
  { key: 'transport:driverPayment', label: 'Driver Payment Report', module: 'transport' },
  { key: 'transport:gstInvoice', label: 'GST Report', module: 'transport' },
  { key: 'transport:invoiceRegister', label: 'Invoice Register', module: 'transport' },
  { key: 'transport:ledger', label: 'Transport Ledger', module: 'transport' },
  { key: 'transport:collection', label: 'Collection Report', module: 'transport' },
  { key: 'transport:vehicleUtil', label: 'Vehicle Utilization Report', module: 'transport' },
  { key: 'transport:tripSummary', label: 'Trip Summary Report', module: 'transport' },
];

export const ALL_REPORTS: ReportDef[] = [...MILK_REPORTS, ...TRANSPORT_REPORTS];

export function reportKeyToType(key: string): string {
  return key.split(':')[1];
}
