/**
 * projectPersistence.js
 * API client for the Project Container Model (PRD v12 §2.3).
 * Mirrors the pattern of workflowPersistence.js — fire-and-forget safe.
 */

const BASE = '/api/projects';

async function apiFetch(path, options = {}) {
  try {
    const res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[projectPersistence]', err.message);
    return null;
  }
}

/** List all projects for the current tenant. */
export async function listProjects(tenantId) {
  return apiFetch(`${BASE}?tenant_id=${encodeURIComponent(tenantId || '')}`);
}

/** Load a single project by id. */
export async function loadProject(id) {
  return apiFetch(`${BASE}/${id}`);
}

/** Create a new project container. */
export async function createProject({ id, name, clientName, description, tenantId } = {}) {
  return apiFetch(BASE, {
    method: 'POST',
    body: JSON.stringify({
      id,
      name,
      client_name: clientName || '',
      description: description || '',
      tenant_id: tenantId,
    }),
  });
}

/** Update project metadata. */
export async function updateProject(id, { name, clientName, description, status } = {}) {
  return apiFetch(`${BASE}/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, client_name: clientName, description, status }),
  });
}

/** Soft-delete (archive) a project. */
export async function archiveProject(id) {
  return apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
}

/** List all workflow stubs belonging to a project. */
export async function listProjectWorkflows(projectId) {
  return apiFetch(`${BASE}/${projectId}/workflows`);
}
