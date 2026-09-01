export type Role = 'admin' | 'manager' | 'staff';
export type Language = 'en' | 'te';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: Role;
  language: Language;
  created_at: string;
}

export interface District {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Location {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Material {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  user_id: string | null;
  name: string;
  code: string;
  unit: string;
  unit_display: string;
  default_purchase_rate: number;
  default_selling_rate: number;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface Driver {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  is_active: boolean;
  advance_salary: number;
  created_at: string;
}

export interface Vehicle {
  id: string;
  user_id: string;
  vehicle_number: string;
  owner_name: string | null;
  driver_id: string | null;
  monthly_emi: number;
  emi_date: number;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface MilkEntry {
  id: string;
  user_id: string;
  entry_date: string;
  district_id: string | null;
  district_name: string;
  product_id: string | null;
  product_name: string;
  unit: string;
  unit_display: string;
  purchase_rate: number;
  selling_rate: number;
  quantity: number;
  margin: number;
  daily_emi: number;
  company_paid: number;
  purchase_amount: number;
  selling_amount: number;
  commission_rate: number;
  commission_amount: number;
  image_url: string;
  notes: string;
  bill_paid: boolean;
  paid_date: string | null;
  created_at: string;
}

export interface CompanyBill {
  id: string;
  user_id: string;
  trip_date: string;
  vehicle_id: string | null;
  vehicle_number: string;
  driver_name: string;
  loading_location: string;
  unloading_location: string;
  tons: number;
  per_ton: number;
  amount_without_gst: number;
  gst_amount: number;
  amount_with_gst: number;
  advance: number;
  diesel: number;
  diesel_rate: number;
  diesel_amount: number;
  company_income: number;
  net_company_income: number;
  net_receivable: number;
  paid_amount: number;
  payment_status: 'pending' | 'partial' | 'paid';
  lr_no: string | null;
  material_name: string | null;
  advance_company_date: string | null;
  bill_paid: boolean;
  paid_date: string | null;
  created_at: string;
}

export interface MarBill {
  id: string;
  user_id: string;
  trip_date: string;
  vehicle_id: string | null;
  vehicle_number: string;
  driver_name: string;
  company_bill_id: string | null;
  driver_wage: number;
  diesel_litres: number;
  diesel_cost: number;
  diesel_rate: number;
  net_company_income: number;
  toll_gates: number;
  driver_waiting: number;
  other_charges: number;
  maintenance: number;
  daily_emi: number;
  total_expense: number;
  trip_income: number;
  trip_profit: number;
  created_at: string;
}

export interface Maintenance {
  id: string;
  user_id: string;
  vehicle_id: string | null;
  vehicle_number: string;
  type: 'tyre' | 'repair' | 'service' | 'other';
  date: string;
  amount: number;
  description: string;
  created_at: string;
}

export interface Payment {
  id: string;
  user_id: string;
  ref_type: 'company_bill' | 'milk' | 'transport';
  ref_id: string | null;
  party: string;
  date: string;
  amount: number;
  mode: string;
  notes: string;
  created_at: string;
}

export interface FinanceEntry {
  id: string;
  user_id: string;
  type: 'income' | 'expense';
  category: string;
  description: string;
  date: string;
  amount: number;
  created_at: string;
}

export interface Settings {
  id: string;
  user_id: string;
  gst_rate: number;
  currency: string;
  default_language: Language;
  company_name: string;
  diesel_rate: number;
  show_sgst_cgst: boolean;
  created_at: string;
}


