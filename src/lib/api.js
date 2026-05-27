const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function requestJson(path, options = {}) {
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || `Request failed with status ${response.status}`);
  }
  return payload;
}

export function getDashboardSummary() {
  return requestJson('/api/dashboard/summary');
}

export function getInvoices({ status = 'all', search = '' } = {}) {
  const query = new URLSearchParams();
  if (status && status !== 'all') query.set('status', status);
  if (search.trim()) query.set('search', search.trim());
  const suffix = query.toString() ? `?${query}` : '';
  return requestJson(`/api/invoices${suffix}`);
}

export function approveInvoice(invoiceId) {
  return requestJson(`/api/invoices/${invoiceId}/approve`, { method: 'POST', body: JSON.stringify({}) });
}

export function sendInvoiceToReview(invoiceId) {
  return requestJson(`/api/invoices/${invoiceId}/review`, { method: 'POST', body: JSON.stringify({}) });
}

export function getRuntimeView(invoiceId) {
  const query = new URLSearchParams();
  if (invoiceId) query.set('invoice_id', invoiceId);
  const suffix = query.toString() ? `?${query}` : '';
  return requestJson(`/api/runtime-view${suffix}`);
}

export function intakeUpload({ file, tenantId = '00000000-0000-0000-0000-000000000001' } = {}) {
  const body = new FormData();
  if (file) body.append('file', file);
  body.append('tenant_id', tenantId);
  return requestJson('/api/intake/upload', { method: 'POST', body });
}