import { useWorkflowStore } from '../modules/workflow-designer/store/useWorkflowStore';

// ── useExport ─────────────────────────────────────────────────
// Returns a function that serializes the full store into a
// structured JSON file compatible with the M-Files COM API.
export const useExport = () => {
  const workflows  = useWorkflowStore(s => s.workflows);
  const users      = useWorkflowStore(s => s.users);
  const properties = useWorkflowStore(s => s.properties);
  const rules      = useWorkflowStore(s => s.rules);

  const exportJSON = () => {
    const payload = {
      _meta: {
        exportedAt:  new Date().toISOString(),
        version:     '2.0',
        tool:        'Proviso Workflow Designer',
        target:      'M-Files COM API',
      },
      // ── Vault push payload (workflows only) ────────────────────────
      // NOTE: Only workflows[].{name, states, transitions} are consumed
      // by push-to-vault.ps1 during M-Files ingestion.
      //
      // The fields below (users, properties, rules) are included in the
      // exported JSON for human-readable SOW documentation and are intentionally
      // NOT pushed to the vault in Phase 1.
      //
      // FUTURE UPDATE — Phase 2:
      //   - users[]      → vault LoginAccounts / UserGroups (ACL setup)
      //   - properties[] → vault PropertyDefinitions (metadata card)
      //   - rules[]      → state Preconditions / transition TriggerCriteria
      workflows: workflows.map(wf => ({
        id:          wf.id,
        name:        wf.name,
        states:      wf.states.map(s => ({
          name:    s.name,
          initial: s.initial,
        })),
        transitions: wf.transitions.map(t => ({
          from:        t.from,
          to:          t.to,
          conditions:  t.conditions  || null,
          permissions: t.permissions || null,
        })),
      })),
      users: users.map(u => ({
        name:  u.name,
        role:  u.role,
        email: u.email,
        isContractManager: u.isCM,
      })),
      properties: properties.map(p => ({
        name:     p.name,
        type:     p.type,
        required: p.required,
      })),
      rules: rules.map(r => r.text).filter(Boolean),
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `proviso-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return { exportJSON };
};
