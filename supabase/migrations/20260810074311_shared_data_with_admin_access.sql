-- ============================================================================
-- Shared data model: all authenticated users SEE all data.
-- Only the row owner (or admin) can UPDATE / DELETE.
-- INSERT: any authenticated user; user_id defaults to auth.uid().
-- ============================================================================

-- Helper: is_admin() already exists as SECURITY DEFINER; reuse it.

-- Tables to update (business data tables with user_id column):
--   company_bills, mar_bills, milk_entries, milk_indent_upload,
--   drivers, vehicles, finance, payments, maintenance,
--   locations, districts, materials, settings, audit_logs

-- ============================================================================
-- company_bills
-- ============================================================================
DROP POLICY IF EXISTS select_own_company_bills ON company_bills;
DROP POLICY IF EXISTS insert_own_company_bills ON company_bills;
DROP POLICY IF EXISTS update_own_company_bills ON company_bills;
DROP POLICY IF EXISTS delete_own_company_bills ON company_bills;

CREATE POLICY select_all_company_bills ON company_bills FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_company_bills ON company_bills FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_company_bills ON company_bills FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_company_bills ON company_bills FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- mar_bills
-- ============================================================================
DROP POLICY IF EXISTS select_own_mar_bills ON mar_bills;
DROP POLICY IF EXISTS insert_own_mar_bills ON mar_bills;
DROP POLICY IF EXISTS update_own_mar_bills ON mar_bills;
DROP POLICY IF EXISTS delete_own_mar_bills ON mar_bills;

CREATE POLICY select_all_mar_bills ON mar_bills FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_mar_bills ON mar_bills FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_mar_bills ON mar_bills FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_mar_bills ON mar_bills FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- milk_entries
-- ============================================================================
DROP POLICY IF EXISTS select_own_milk_entries ON milk_entries;
DROP POLICY IF EXISTS insert_own_milk_entries ON milk_entries;
DROP POLICY IF EXISTS update_own_milk_entries ON milk_entries;
DROP POLICY IF EXISTS delete_own_milk_entries ON milk_entries;

CREATE POLICY select_all_milk_entries ON milk_entries FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_milk_entries ON milk_entries FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_milk_entries ON milk_entries FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_milk_entries ON milk_entries FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- milk_indent_upload
-- ============================================================================
DROP POLICY IF EXISTS select_own_milk_indent_upload ON milk_indent_upload;
DROP POLICY IF EXISTS insert_own_milk_indent_upload ON milk_indent_upload;
DROP POLICY IF EXISTS update_own_milk_indent_upload ON milk_indent_upload;
DROP POLICY IF EXISTS delete_own_milk_indent_upload ON milk_indent_upload;

CREATE POLICY select_all_milk_indent_upload ON milk_indent_upload FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_milk_indent_upload ON milk_indent_upload FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_milk_indent_upload ON milk_indent_upload FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_milk_indent_upload ON milk_indent_upload FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- milk_indent_details (uses is_milk_indent_owner helper; update for shared read)
-- ============================================================================
DROP POLICY IF EXISTS select_own_milk_indent_details ON milk_indent_details;
DROP POLICY IF EXISTS insert_own_milk_indent_details ON milk_indent_details;
DROP POLICY IF EXISTS update_own_milk_indent_details ON milk_indent_details;
DROP POLICY IF EXISTS delete_own_milk_indent_details ON milk_indent_details;

CREATE POLICY select_all_milk_indent_details ON milk_indent_details FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_milk_indent_details ON milk_indent_details FOR INSERT
  TO authenticated WITH CHECK (public.is_milk_indent_owner(upload_id));
CREATE POLICY update_milk_indent_details ON milk_indent_details FOR UPDATE
  TO authenticated USING (public.is_milk_indent_owner(upload_id) OR public.is_admin())
  WITH CHECK (public.is_milk_indent_owner(upload_id) OR public.is_admin());
CREATE POLICY delete_milk_indent_details ON milk_indent_details FOR DELETE
  TO authenticated USING (public.is_milk_indent_owner(upload_id) OR public.is_admin());

-- ============================================================================
-- drivers
-- ============================================================================
DROP POLICY IF EXISTS select_own_drivers ON drivers;
DROP POLICY IF EXISTS insert_own_drivers ON drivers;
DROP POLICY IF EXISTS update_own_drivers ON drivers;
DROP POLICY IF EXISTS delete_own_drivers ON drivers;

CREATE POLICY select_all_drivers ON drivers FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_drivers ON drivers FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_drivers ON drivers FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_drivers ON drivers FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- vehicles
-- ============================================================================
DROP POLICY IF EXISTS select_own_vehicles ON vehicles;
DROP POLICY IF EXISTS insert_own_vehicles ON vehicles;
DROP POLICY IF EXISTS update_own_vehicles ON vehicles;
DROP POLICY IF EXISTS delete_own_vehicles ON vehicles;

CREATE POLICY select_all_vehicles ON vehicles FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_vehicles ON vehicles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_vehicles ON vehicles FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_vehicles ON vehicles FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- finance
-- ============================================================================
DROP POLICY IF EXISTS select_own_finance ON finance;
DROP POLICY IF EXISTS insert_own_finance ON finance;
DROP POLICY IF EXISTS update_own_finance ON finance;
DROP POLICY IF EXISTS delete_own_finance ON finance;

CREATE POLICY select_all_finance ON finance FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_finance ON finance FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_finance ON finance FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_finance ON finance FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- payments
-- ============================================================================
DROP POLICY IF EXISTS select_own_payments ON payments;
DROP POLICY IF EXISTS insert_own_payments ON payments;
DROP POLICY IF EXISTS update_own_payments ON payments;
DROP POLICY IF EXISTS delete_own_payments ON payments;

CREATE POLICY select_all_payments ON payments FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_payments ON payments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_payments ON payments FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_payments ON payments FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- maintenance
-- ============================================================================
DROP POLICY IF EXISTS select_own_maintenance ON maintenance;
DROP POLICY IF EXISTS insert_own_maintenance ON maintenance;
DROP POLICY IF EXISTS update_own_maintenance ON maintenance;
DROP POLICY IF EXISTS delete_own_maintenance ON maintenance;

CREATE POLICY select_all_maintenance ON maintenance FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_maintenance ON maintenance FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_maintenance ON maintenance FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_maintenance ON maintenance FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- locations
-- ============================================================================
DROP POLICY IF EXISTS select_own_locations ON locations;
DROP POLICY IF EXISTS insert_own_locations ON locations;
DROP POLICY IF EXISTS update_own_locations ON locations;
DROP POLICY IF EXISTS delete_own_locations ON locations;

CREATE POLICY select_all_locations ON locations FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_locations ON locations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_locations ON locations FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_locations ON locations FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- districts
-- ============================================================================
DROP POLICY IF EXISTS select_own_districts ON districts;
DROP POLICY IF EXISTS insert_own_districts ON districts;
DROP POLICY IF EXISTS update_own_districts ON districts;
DROP POLICY IF EXISTS delete_own_districts ON districts;

CREATE POLICY select_all_districts ON districts FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_districts ON districts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_districts ON districts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_districts ON districts FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- materials
-- ============================================================================
DROP POLICY IF EXISTS select_own_materials ON materials;
DROP POLICY IF EXISTS insert_own_materials ON materials;
DROP POLICY IF EXISTS update_own_materials ON materials;
DROP POLICY IF EXISTS delete_own_materials ON materials;

CREATE POLICY select_all_materials ON materials FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_materials ON materials FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_materials ON materials FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_materials ON materials FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- settings (shared company settings — one row, readable by all,
-- writable by admin or the row owner)
-- ============================================================================
DROP POLICY IF EXISTS select_own_settings ON settings;
DROP POLICY IF EXISTS insert_own_settings ON settings;
DROP POLICY IF EXISTS update_own_settings ON settings;
DROP POLICY IF EXISTS delete_own_settings ON settings;

CREATE POLICY select_all_settings ON settings FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_settings ON settings FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY update_settings ON settings FOR UPDATE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin())
  WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY delete_settings ON settings FOR DELETE
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- ============================================================================
-- audit_logs (shared read, owner-only write — keep as-is but open SELECT)
-- ============================================================================
DROP POLICY IF EXISTS select_own_audit_logs ON audit_logs;
DROP POLICY IF EXISTS insert_own_audit_logs ON audit_logs;

CREATE POLICY select_all_audit_logs ON audit_logs FOR SELECT
  TO authenticated USING (true);
CREATE POLICY insert_audit_logs ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);
