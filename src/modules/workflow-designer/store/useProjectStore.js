/**
 * useProjectStore — Project Container Model (PRD v12 §2.3)
 *
 * Projects are the top-level container for all client AP work.
 * Workflows always live inside a project. The active project scopes
 * everything in the Integrator Workspace.
 */

import { create } from 'zustand';
import {
  listProjects,
  createProject,
  updateProject,
  archiveProject,
  listProjectWorkflows,
} from './projectPersistence';

const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001';

const useProjectStore = create((set, get) => ({
  // ── State ──────────────────────────────────────────────────────────────────
  projects:             [],     // [{id, name, client_name, status, version, ...}]
  activeProjectId:      null,   // currently open project
  pendingProjectSwitch: null,   // projectId waiting for save/discard confirmation
  projectPanelOpen:     false,  // controls dropdown from any component
  loading:              false,
  error:                null,

  // ── Derived ────────────────────────────────────────────────────────────────
  getActiveProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId) || null;
  },

  // ── Bootstrap: load all projects on mount ─────────────────────────────────
  bootstrapProjects: async (tenantId = DEV_TENANT_ID) => {
    set({ loading: true, error: null });
    try {
      const result = await listProjects(tenantId);
      if (result?.ok && Array.isArray(result.projects)) {
        const projects = result.projects;
        // Auto-select the most recently updated project if none active
        const current = get().activeProjectId;
        const autoSelect = !current && projects.length > 0 ? projects[0].id : current;
        set({ projects, activeProjectId: autoSelect, loading: false });
        return projects;
      }
    } catch {
      set({ error: 'Failed to load projects', loading: false });
    }
    set({ loading: false });
    return [];
  },

  // ── Set active project — signals a switch; UI layer handles dirty check ─────
  // The project store deliberately knows NOTHING about the workflow store.
  // Dirty-check and canvas-clear are the Shell's responsibility (avoids circular deps).
  setActiveProject: (projectId) => {
    if (get().activeProjectId === projectId) return;
    // Always raise pendingProjectSwitch — Shell decides whether to prompt or auto-confirm
    set({ pendingProjectSwitch: projectId });
  },

  // ── Confirm a pending project switch (called by Shell after save/discard) ──
  confirmProjectSwitch: () => {
    const { pendingProjectSwitch } = get();
    if (!pendingProjectSwitch) return;
    set({ activeProjectId: pendingProjectSwitch, pendingProjectSwitch: null });
  },

  cancelProjectSwitch: () => set({ pendingProjectSwitch: null }),

  openProjectPanel:  () => set({ projectPanelOpen: true }),
  closeProjectPanel: () => set({ projectPanelOpen: false }),
  toggleProjectPanel: () => set(s => ({ projectPanelOpen: !s.projectPanelOpen })),

  // ── Create project ─────────────────────────────────────────────────────────
  createProject: async ({ name, clientName, description }, tenantId = DEV_TENANT_ID) => {
    set({ loading: true, error: null });
    try {
      const result = await createProject({ name, clientName, description, tenantId });
      if (result?.ok && result.project) {
        const newProject = result.project;
        set((state) => ({
          projects: [newProject, ...state.projects],
          activeProjectId: newProject.id,
          loading: false,
        }));
        return newProject;
      }
    } catch {
      set({ error: 'Failed to create project', loading: false });
    }
    set({ loading: false });
    return null;
  },

  // ── Update project metadata ────────────────────────────────────────────────
  updateProject: async (id, fields) => {
    try {
      const result = await updateProject(id, fields);
      if (result?.ok && result.project) {
        set((state) => ({
          projects: state.projects.map((p) => (p.id === id ? result.project : p)),
        }));
        return result.project;
      }
    } catch {
      /* silent */
    }
    return null;
  },

  // ── Archive (soft-delete) project ─────────────────────────────────────────
  archiveProject: async (id) => {
    try {
      await archiveProject(id);
      set((state) => {
        const remaining = state.projects.filter((p) => p.id !== id);
        return {
          projects: remaining,
          activeProjectId: state.activeProjectId === id
            ? (remaining[0]?.id || null)
            : state.activeProjectId,
        };
      });
    } catch {
      /* silent */
    }
  },

  // ── Load workflows for the active project ─────────────────────────────────
  loadProjectWorkflows: async (projectId) => {
    try {
      const result = await listProjectWorkflows(projectId);
      return result?.ok ? (result.workflows || []) : [];
    } catch {
      return [];
    }
  },
}));

export default useProjectStore;
