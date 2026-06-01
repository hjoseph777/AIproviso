/**
 * workflowPersistence.js
 * API client for the workflow designer persistence layer.
 * Calls /api/workflows endpoints on the Flask backend.
 * All functions are fire-and-forget safe — errors are logged, never thrown.
 */

const BASE = '/api/workflows';

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[workflowPersistence]', err.message);
    return null;
  }
}

/** Load all workflow stubs (id, name, status, version) for the current tenant. */
export async function listWorkflows(tenantId) {
  return apiFetch(`${BASE}?tenant_id=${encodeURIComponent(tenantId || '')}`);
}

/** Load the full WorkflowDefinition JSON for a single workflow. */
export async function loadWorkflow(id) {
  return apiFetch(`${BASE}/${id}`);
}

/**
 * Upsert a workflow definition.
 * Called by the auto-save debounce — safe to call frequently.
 */
export async function saveWorkflow(id, { name, definition, version = 1, tenantId, projectId } = {}) {
  return apiFetch(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, definition, version, tenant_id: tenantId, project_id: projectId }),
  });
}

/** Create a brand-new workflow record (status: draft). */
export async function createWorkflow({ id, name, definition, tenantId } = {}) {
  return apiFetch(BASE, {
    method: 'POST',
    body: JSON.stringify({ id, name, definition, tenant_id: tenantId }),
  });
}

/** Publish a workflow (draft → published, version++). */
export async function publishWorkflow(id) {
  return apiFetch(`${BASE}/${id}/publish`, { method: 'POST' });
}

/** Soft-delete (retire) a workflow. */
export async function retireWorkflow(id) {
  return apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
}
