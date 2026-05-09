import { z } from 'zod';

// ── Primitive schemas ─────────────────────────────────────────
export const StateSchema = z.object({
  id:      z.string(),
  name:    z.string().min(1, 'State name is required'),
  initial: z.boolean(),
});

export const TransitionSchema = z.object({
  id:          z.string(),
  from:        z.string().min(1, 'From state is required'),
  to:          z.string().min(1, 'To state is required'),
  conditions:  z.string().nullable().optional(),
  permissions: z.string().nullable().optional(),
});

// ── Workflow schema with cross-field rules ─────────────────────
export const WorkflowSchema = z.object({
  id:          z.string(),
  name:        z.string().min(1, 'Workflow name is required'),
  states:      z.array(StateSchema),
  transitions: z.array(TransitionSchema),
}).superRefine((wf, ctx) => {
  const initials = wf.states.filter(s => s.initial);
  if (initials.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['states'], message: 'One state must be marked as Initial' });
  }
  if (initials.length > 1) {
    ctx.addIssue({ code: 'custom', path: ['states'], message: 'Only one state can be marked Initial' });
  }

  const names = new Set(wf.states.map(s => s.name));
  wf.transitions.forEach((t, i) => {
    if (t.from && !names.has(t.from)) {
      ctx.addIssue({ code: 'custom', path: ['transitions', i, 'from'], message: `Unknown state: "${t.from}"` });
    }
    if (t.to && !names.has(t.to)) {
      ctx.addIssue({ code: 'custom', path: ['transitions', i, 'to'], message: `Unknown state: "${t.to}"` });
    }
    if (t.from && t.to && t.from === t.to) {
      ctx.addIssue({ code: 'custom', path: ['transitions', i, 'to'], message: 'From and To cannot be the same state' });
    }
  });

  // Check for duplicate transitions
  const seen = new Set();
  wf.transitions.forEach((t, i) => {
    const key = `${t.from}→${t.to}`;
    if (seen.has(key)) {
      ctx.addIssue({ code: 'custom', path: ['transitions', i], message: `Duplicate transition: ${t.from} → ${t.to}` });
    }
    seen.add(key);
  });
});

// ── Main validator ─────────────────────────────────────────────
// Returns { valid, errors[], transitionErrors: Set<index>, stateErrors: Set<index> }
export const validateWorkflow = (wf) => {
  const result = WorkflowSchema.safeParse(wf);
  if (result.success) return { valid: true, errors: [], transitionErrors: new Set(), stateErrors: new Set() };

  const errors = result.error.issues.map(issue => ({
    path:            issue.path,
    message:         issue.message,
    transitionIndex: issue.path[0] === 'transitions' && typeof issue.path[1] === 'number' ? issue.path[1] : null,
    stateIndex:      issue.path[0] === 'states'      && typeof issue.path[1] === 'number' ? issue.path[1] : null,
  }));

  const transitionErrors = new Set(
    errors.filter(e => e.transitionIndex !== null).map(e => e.transitionIndex)
  );
  const stateErrors = new Set(
    errors.filter(e => e.stateIndex !== null).map(e => e.stateIndex)
  );

  return { valid: false, errors, transitionErrors, stateErrors };
};
