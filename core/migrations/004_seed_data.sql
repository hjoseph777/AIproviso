-- =============================================================================
-- 004_seed_data.sql
-- Development seed data — creates a dev tenant and a dev admin user.
-- ONLY run in development environments. NOT for production.
-- =============================================================================

\c proviso;

DO $$
DECLARE
  v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
  v_user_id   UUID := '00000000-0000-0000-0000-000000000002';
BEGIN
  -- ── Dev Tenant ──────────────────────────────────────────────────────────────
  INSERT INTO tenant_configurations (tenant_id, config_json, version)
  VALUES (
    v_tenant_id,
    '{
      "po_required":           false,
      "match_type":            "2-way",
      "default_currency":      "CAD",
      "approval_thresholds":   [{"amount": 5000, "approver_role": "manager"}],
      "sla_overrides":         {},
      "ocr_confidence_floor":  0.70,
      "duplicate_window_days": 30,
      "alias_prefix":          "DEV"
    }',
    1
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- ── Dev Admin User ───────────────────────────────────────────────────────────
  -- Bypasses RLS during seed (superuser session). Set local context for app use.
  INSERT INTO users (id, tenant_id, email, display_name, role, active)
  VALUES (
    v_user_id,
    v_tenant_id,
    'admin@proviso.dev',
    'Proviso Dev Admin',
    'admin',
    TRUE
  )
  ON CONFLICT (email, tenant_id) DO NOTHING;

  -- ── Dev Vendor ───────────────────────────────────────────────────────────────
  INSERT INTO vendors (tenant_id, name, display_name, erp_vendor_number, email_domain)
  VALUES (
    v_tenant_id,
    'Acme Supplies Inc',
    'Acme Corp',
    'VENDOR-001',
    'acme.com'
  )
  ON CONFLICT DO NOTHING;

  -- ── Dev Approval Matrix ──────────────────────────────────────────────────────
  INSERT INTO approval_matrix (tenant_id, rules_json, version, active)
  VALUES (
    v_tenant_id,
    '[
      {"amount_lte": 999,   "approver_role": "ap_operator"},
      {"amount_lte": 4999,  "approver_role": "manager"},
      {"amount_gte": 5000,  "approver_role": "approver"}
    ]',
    '1.0.0',
    TRUE
  )
  ON CONFLICT DO NOTHING;

  -- ── Dev Mock Purchase Order ──────────────────────────────────────────────────
  INSERT INTO mock_purchase_orders (tenant_id, po_number, total, currency, status)
  VALUES (
    v_tenant_id,
    'PO-DEV-001',
    2500.00,
    'CAD',
    'open'
  )
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Seed complete: tenant=% user=%', v_tenant_id, v_user_id;
END
$$;
