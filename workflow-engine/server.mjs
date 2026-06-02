import http from 'node:http';
import { Pool } from 'pg';
import { createActor, createMachine } from 'xstate';

const port = Number(process.env.PORT || 5100);
const databaseUrl = process.env.DATABASE_URL;
const pool = new Pool({ connectionString: databaseUrl });

const workflowMachine = createMachine({
  id: 'apWorkflow',
  initial: 'received',
  states: {
    received: { on: { EXTRACTED: 'extracted', 'invoice.received': 'received' } },
    extracted: { on: { MATCHED: 'matched', 'invoice.extracted': 'extracted', APPROVED: 'approved', EXCEPTION: 'exception' } },
    matched: { on: { PENDING_APPROVAL: 'pending_approval', APPROVED: 'approved', EXCEPTION: 'exception' } },
    pending_approval: { on: { APPROVED: 'approved', REJECTED: 'rejected', EXCEPTION: 'exception', POSTED: 'posted' } },
    approved: { on: { POSTED: 'posted', REJECTED: 'rejected' } },
    exception: { on: { APPROVED: 'approved', REJECTED: 'rejected' } },
    rejected: { type: 'final' },
    posted: { on: { RECONCILED: 'reconciled' } },
    reconciled: { type: 'final' }
  }
});

const transitionTargets = {
  received: { 'invoice.received': 'received', 'invoice.extracted': 'extracted' },
  extracted: { 'invoice.extracted': 'extracted', 'invoice.matched': 'matched', 'invoice.approved': 'approved', 'invoice.exception': 'exception' },
  matched: { 'invoice.pending_approval': 'pending_approval', 'invoice.approved': 'approved', 'invoice.exception': 'exception' },
  pending_approval: { 'invoice.approved': 'approved', 'invoice.exception': 'exception', 'invoice.rejected': 'rejected', 'invoice.posted': 'posted' },
  approved: { 'invoice.posted': 'posted', 'invoice.rejected': 'rejected' },
  exception: { 'invoice.approved': 'approved', 'invoice.rejected': 'rejected' },
  posted: { 'invoice.reconciled': 'reconciled' }
};

const timerConfig = {
  extracted: { timerKey: 'sla.current', timerType: 'sla', targetState: 'matched', hours: 1 },
  matched: { timerKey: 'sla.current', timerType: 'sla', targetState: 'pending_approval', hours: 2 },
  pending_approval: { timerKey: 'sla.current', timerType: 'sla', targetState: 'exception', hours: 4 },
  exception: { timerKey: 'sla.current', timerType: 'sla', targetState: 'pending_approval', hours: 1 }
};

const runtimeRuleCatalog = {
  'rule.invoice.confidence.manual_review': {
    guardName: 'evaluate_confidence_threshold',
    remediation: 'Send the invoice to manual review and correct low-confidence fields before approval.',
    expected: (invoice) => `average confidence >= 0.70 (actual threshold: ${(invoice.autoReviewThreshold ?? 0.7).toFixed(2)})`
  },
  'rule.invoice.po.required': {
    guardName: 'require_purchase_order_reference',
    remediation: 'Attach or correct the PO number before the workflow continues.',
    expected: () => 'po_number must be present and non-empty'
  },
  'rule.invoice.approval.pending': {
    guardName: 'await_approver_decision',
    remediation: 'Complete the approver decision to move the invoice beyond the approval gate.',
    expected: () => 'approver decision must be captured'
  },
  'rule.workflow.transition.recorded': {
    guardName: 'persist_workflow_transition',
    remediation: 'No remediation required. The runtime successfully persisted the transition.',
    expected: () => 'workflow transition is recorded in history'
  }
};

function evaluateDemoMachine() {
  const actor = createActor(workflowMachine);
  actor.start();
  actor.send({ type: 'EXTRACTED' });
  actor.send({ type: 'MATCHED' });
  actor.send({ type: 'PENDING_APPROVAL' });
  return String(actor.getSnapshot().value);
}

function jsonResponse(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error('payload_too_large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!body.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

function normalizeEventType(eventType = '') {
  return String(eventType).trim();
}

function resolveTargetState(currentState, eventType, explicitTarget) {
  if (explicitTarget) return explicitTarget;
  return transitionTargets[currentState]?.[eventType] || null;
}

function eventToMachineEvent(eventType) {
  const map = {
    'invoice.received': 'invoice.received',
    'invoice.extracted': 'invoice.extracted',
    'invoice.matched': 'MATCHED',
    'invoice.pending_approval': 'PENDING_APPROVAL',
    'invoice.approved': 'APPROVED',
    'invoice.exception': 'EXCEPTION',
    'invoice.rejected': 'REJECTED',
    'invoice.posted': 'POSTED',
    'invoice.reconciled': 'RECONCILED'
  };
  return map[eventType] || eventType;
}

function normalizeTriggerSource(triggerSource = '') {
  const value = String(triggerSource || '').trim().toLowerCase();
  if (!value) return 'system';
  if (['system', 'user', 'timer', 'api', 'webhook', 'ai'].includes(value)) {
    return value;
  }
  if (value === 'worker' || value === 'validation') {
    return 'system';
  }
  return 'api';
}

function numericAverage(values = []) {
  const valid = values
    .map(value => Number(value))
    .filter(value => Number.isFinite(value));
  if (!valid.length) return 0;
  return Number((valid.reduce((sum, value) => sum + value, 0) / valid.length).toFixed(2));
}

function deriveInvoiceFacts(invoice) {
  const confidenceJson = invoice.confidence_json || {};
  const extractedJson = invoice.extracted_json || {};
  const averageConfidence = numericAverage(Object.values(confidenceJson));
  const poNumber = String(extractedJson.po_number || '').trim();
  return {
    averageConfidence,
    poNumber,
    autoReviewThreshold: 0.7,
    extractedJson,
    confidenceJson
  };
}

function deriveRuleContext(invoice, eventType, targetState) {
  const facts = deriveInvoiceFacts(invoice);
  let ruleId = 'rule.workflow.transition.recorded';
  let guardResult = true;

  if (facts.averageConfidence < facts.autoReviewThreshold || eventType === 'invoice.exception') {
    ruleId = 'rule.invoice.confidence.manual_review';
    guardResult = false;
  } else if (!facts.poNumber && (eventType === 'invoice.extracted' || eventType === 'invoice.matched')) {
    ruleId = 'rule.invoice.po.required';
    guardResult = false;
  } else if (targetState === 'pending_approval' || eventType === 'invoice.pending_approval') {
    ruleId = 'rule.invoice.approval.pending';
  }

  const catalog = runtimeRuleCatalog[ruleId] || runtimeRuleCatalog['rule.workflow.transition.recorded'];
  return {
    ruleId,
    guardName: catalog.guardName,
    guardResult,
    expected: catalog.expected({ ...invoice, ...facts }),
    actual: ruleId === 'rule.invoice.confidence.manual_review'
      ? `average confidence ${facts.averageConfidence.toFixed(2)}`
      : ruleId === 'rule.invoice.po.required'
        ? `po_number ${facts.poNumber || 'missing'}`
        : ruleId === 'rule.invoice.approval.pending'
          ? `current target state ${targetState}`
          : `event ${eventType}`,
    remediation: catalog.remediation,
  };
}

async function getWorkflowDefinition(client, tenantId) {
  const { rows } = await client.query(
    `SELECT id, version
     FROM workflow_definitions
     WHERE tenant_id = $1
     ORDER BY active DESC, created_at DESC
     LIMIT 1`,
    [tenantId]
  );
  return rows[0] || null;
}

async function getInvoiceSnapshot(client, tenantId, invoiceId) {
  const { rows } = await client.query(
    `SELECT i.id, i.tenant_id, i.status, i.correlation_id, i.updated_at, i.received_at,
            COALESCE(v.display_name, v.name, latest.extracted_json->>'vendor_name', 'Unknown vendor') AS vendor_name,
            COALESCE(latest.extracted_json->>'invoice_number', i.id::text) AS invoice_number,
            latest.extracted_json,
            latest.confidence_json
     FROM invoices i
     LEFT JOIN vendors v ON v.id = i.vendor_id
     LEFT JOIN LATERAL (
       SELECT extracted_json, confidence_json
       FROM invoice_extractions ie
       WHERE ie.invoice_id = i.id
       ORDER BY ie.version DESC
       LIMIT 1
     ) latest ON TRUE
     WHERE i.tenant_id = $1 AND i.id = $2
     LIMIT 1`,
    [tenantId, invoiceId]
  );
  return rows[0] || null;
}

async function ensureWorkflowState(client, tenantId, invoice, payload) {
  const { rows } = await client.query(
    `SELECT *
     FROM workflow_state
     WHERE tenant_id = $1 AND invoice_id = $2
     LIMIT 1
     FOR UPDATE`,
    [tenantId, invoice.id]
  );
  if (rows[0]) return rows[0];

  const workflowDefinition = await getWorkflowDefinition(client, tenantId);
  const currentState = payload.target_state || invoice.status;
  const snapshotPayload = {
    value: currentState,
    context: {
      invoice_id: invoice.id,
      tenant_id: tenantId,
      invoice_number: invoice.invoice_number,
      vendor_name: invoice.vendor_name,
      correlation_id: invoice.correlation_id
    }
  };
  const contextJson = snapshotPayload.context;
  const insert = await client.query(
    `INSERT INTO workflow_state (
       tenant_id, invoice_id, workflow_definition_id, workflow_version, machine_id,
       current_state, context_json, snapshot_json, last_event, entered_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,now(),now())
     RETURNING *`,
    [
      tenantId,
      invoice.id,
      workflowDefinition?.id || null,
      workflowDefinition?.version || 'v1',
      'invoice-approval',
      currentState,
      JSON.stringify(contextJson),
      JSON.stringify(snapshotPayload),
      payload.event_type || 'workflow.bootstrap'
    ]
  );
  return insert.rows[0];
}

async function cancelScheduledTimers(client, tenantId, invoiceId) {
  const { rows } = await client.query(
    `UPDATE workflow_timers
     SET status = 'cancelled', cancelled_at = now(), updated_at = now()
     WHERE tenant_id = $1 AND invoice_id = $2 AND status = 'scheduled'
     RETURNING timer_key`,
    [tenantId, invoiceId]
  );
  return rows.map(row => row.timer_key);
}

async function getScheduledTimer(client, tenantId, invoiceId, timerKey) {
  const { rows } = await client.query(
    `SELECT id, timer_key, due_at, status
     FROM workflow_timers
     WHERE tenant_id = $1 AND invoice_id = $2 AND timer_key = $3 AND status = 'scheduled'
     ORDER BY created_at DESC
     LIMIT 1`,
    [tenantId, invoiceId, timerKey]
  );
  return rows[0] || null;
}

async function scheduleTimer(client, tenantId, invoiceId, workflowStateId, nextState, eventType) {
  const config = timerConfig[nextState];
  if (!config) return null;

  const existingTimer = await getScheduledTimer(client, tenantId, invoiceId, config.timerKey);
  if (existingTimer) {
    return existingTimer;
  }

  const dueAt = new Date(Date.now() + config.hours * 60 * 60 * 1000).toISOString();
  const { rows } = await client.query(
    `INSERT INTO workflow_timers (
       tenant_id, invoice_id, workflow_state_id, timer_key, timer_type, target_state,
       status, due_at, payload_json, created_at, updated_at
     ) VALUES ($1,$2,$3,$4,$5,$6,'scheduled',$7,$8::jsonb,now(),now())
     RETURNING id, timer_key, due_at, status`,
    [
      tenantId,
      invoiceId,
      workflowStateId,
      config.timerKey,
      config.timerType,
      config.targetState,
      dueAt,
      JSON.stringify({ scheduled_by_event: eventType, scheduled_for_state: nextState })
    ]
  );
  return rows[0] || null;
}

async function advanceWorkflow(payload) {
  const client = await pool.connect();
  try {
    const eventType = normalizeEventType(payload.event_type);
    const triggerSource = normalizeTriggerSource(payload.trigger_source);
    if (!payload.tenant_id || !payload.invoice_id || !eventType) {
      throw new Error('tenant_id, invoice_id, and event_type are required');
    }

    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [payload.tenant_id]);

    const invoice = await getInvoiceSnapshot(client, payload.tenant_id, payload.invoice_id);
    if (!invoice) {
      throw new Error('invoice_not_found');
    }

    let workflowState = await ensureWorkflowState(client, payload.tenant_id, invoice, payload);
    const fromState = workflowState.current_state || invoice.status;
    const machineEvent = eventToMachineEvent(eventType);
    const targetState = resolveTargetState(fromState, eventType, payload.target_state) || fromState;
    const ruleContext = deriveRuleContext(invoice, eventType, targetState);

    const snapshotPayload = {
      value: targetState,
      context: {
        invoice_id: invoice.id,
        tenant_id: payload.tenant_id,
        invoice_number: invoice.invoice_number,
        vendor_name: invoice.vendor_name,
        correlation_id: payload.correlation_id || invoice.correlation_id,
        source_module: payload.source_module || 'workflow-engine',
        guard_name: ruleContext.guardName,
        rule_id: ruleContext.ruleId
      }
    };

    const cancelledTimerKeys = fromState !== targetState ? await cancelScheduledTimers(client, payload.tenant_id, invoice.id) : [];

    const updateResult = await client.query(
      `UPDATE workflow_state
       SET current_state = $1::varchar(100),
           context_json = $2::jsonb,
           snapshot_json = $3::jsonb,
           last_event = $4,
         entered_at = CASE WHEN current_state = $1::varchar(100) THEN entered_at ELSE now() END,
           updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [targetState, JSON.stringify(snapshotPayload.context), JSON.stringify(snapshotPayload), eventType, workflowState.id]
    );
    workflowState = updateResult.rows[0];

    if (invoice.status !== targetState) {
      await client.query(
        `UPDATE invoices SET status = $1, updated_at = now() WHERE tenant_id = $2 AND id = $3`,
        [targetState, payload.tenant_id, invoice.id]
      );
    }

    const scheduledTimer = await scheduleTimer(client, payload.tenant_id, invoice.id, workflowState.id, targetState, eventType);
    const actionSummary = [];
    if (cancelledTimerKeys.length) actionSummary.push(`cancelled:${cancelledTimerKeys.join(',')}`);
    if (scheduledTimer?.timer_key) {
      const timerAction = fromState === targetState ? 'scheduled-existing' : 'scheduled';
      actionSummary.push(`${timerAction}:${scheduledTimer.timer_key}`);
    }
    actionSummary.push(`guard:${ruleContext.guardName}`);
    actionSummary.push(`rule:${ruleContext.ruleId}`);

    await client.query(
      `INSERT INTO workflow_state_history (
         tenant_id, invoice_id, workflow_state_id, workflow_definition_id,
         event_type, from_state, to_state, guard_name, rule_id, guard_result, action_summary,
         snapshot_json, triggered_by, trigger_source, correlation_id, recorded_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,now())`,
      [
        payload.tenant_id,
        invoice.id,
        workflowState.id,
        workflowState.workflow_definition_id,
        eventType,
        fromState,
        targetState,
        ruleContext.guardName,
        ruleContext.ruleId,
        ruleContext.guardResult,
        JSON.stringify(actionSummary),
        JSON.stringify({ ...snapshotPayload, rule_context: {
          rule_id: ruleContext.ruleId,
          guard_name: ruleContext.guardName,
          expected: ruleContext.expected,
          actual: ruleContext.actual,
          remediation: ruleContext.remediation,
        } }),
        payload.user_id || null,
        triggerSource,
        payload.correlation_id || invoice.correlation_id || null
      ]
    );

    await client.query('COMMIT');
    return {
      ok: true,
      invoice_id: invoice.id,
      from_state: fromState,
      to_state: targetState,
      cancelled_timers: cancelledTimerKeys,
      scheduled_timer: scheduledTimer || null,
      last_event: eventType,
      machine_event: machineEvent,
      guard_name: ruleContext.guardName,
      rule_id: ruleContext.ruleId,
      guard_result: ruleContext.guardResult
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function markTimerLifecycle(payload) {
  const client = await pool.connect();
  try {
    if (!payload.tenant_id || !payload.invoice_id || !payload.timer_key || !payload.status) {
      throw new Error('tenant_id, invoice_id, timer_key, and status are required');
    }
    if (!['fired', 'cancelled'].includes(payload.status)) {
      throw new Error('status must be fired or cancelled');
    }

    await client.query('BEGIN');
  await client.query("SELECT set_config('app.current_tenant_id', $1, true)", [payload.tenant_id]);
    const column = payload.status === 'fired' ? 'fired_at' : 'cancelled_at';
    const { rows } = await client.query(
      `UPDATE workflow_timers
       SET status = $1,
           ${column} = now(),
           updated_at = now(),
           payload_json = COALESCE(payload_json, '{}'::jsonb) || $2::jsonb,
           job_reference = COALESCE($3, job_reference)
       WHERE id = (
         SELECT id FROM workflow_timers
         WHERE tenant_id = $4 AND invoice_id = $5 AND timer_key = $6
         ORDER BY created_at DESC
         LIMIT 1
       )
       RETURNING id, timer_key, status, due_at, fired_at, cancelled_at`,
      [
        payload.status,
        JSON.stringify({ lifecycle_source: payload.lifecycle_source || 'external', note: payload.note || null }),
        payload.job_reference || null,
        payload.tenant_id,
        payload.invoice_id,
        payload.timer_key
      ]
    );
    if (!rows[0]) {
      throw new Error('timer_not_found');
    }
    await client.query('COMMIT');
    return { ok: true, timer: rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function handleRequest(req, res) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    try {
      const currentState = evaluateDemoMachine();
      await pool.query('SELECT 1');
      jsonResponse(res, 200, {
        status: 'ok',
        service: 'workflow-engine',
        runtime: 'xstate',
        demo_state: currentState,
        database: 'ok'
      });
    } catch (error) {
      jsonResponse(res, 503, { status: 'degraded', service: 'workflow-engine', error: error.message });
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/capabilities') {
    jsonResponse(res, 200, {
      service: 'workflow-engine',
      supports: [
        'states', 'transitions', 'entry-actions', 'exit-actions', 'guards',
        'workflow-state-persistence', 'workflow-history-persistence', 'timer-lifecycle-persistence'
      ]
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/advance') {
    try {
      const payload = await parseRequestBody(req);
      const result = await advanceWorkflow(payload);
      jsonResponse(res, 200, result);
    } catch (error) {
      console.error('advance failed', error);
      jsonResponse(res, 400, { error: error.message || 'advance_failed' });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/timers/mark') {
    try {
      const payload = await parseRequestBody(req);
      const result = await markTimerLifecycle(payload);
      jsonResponse(res, 200, result);
    } catch (error) {
      console.error('timer mark failed', error);
      jsonResponse(res, 400, { error: error.message || 'timer_mark_failed' });
    }
    return;
  }

  jsonResponse(res, 404, { error: 'not_found' });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(error => {
    console.error('workflow-engine internal error', error);
    jsonResponse(res, 500, { error: error.message || 'internal_error' });
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`workflow-engine listening on ${port}`);
});