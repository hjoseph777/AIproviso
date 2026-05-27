import crypto from 'node:crypto';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379/0';
const backendBaseUrl = process.env.BACKEND_BASE_URL || 'http://backend-api:5000';
const workflowWebhookSecret = process.env.WORKFLOW_WEBHOOK_SECRET || '';
const timerEventsQueue = process.env.TIMER_EVENTS_QUEUE || 'workflow-timer-events';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

function buildSignedHeaders(rawBody) {
  if (!workflowWebhookSecret) {
    throw new Error('WORKFLOW_WEBHOOK_SECRET is required');
  }

  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac('sha256', workflowWebhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  return {
    'Content-Type': 'application/json',
    'X-Proviso-Timestamp': timestamp,
    'X-Proviso-Signature': `v1=${signature}`,
  };
}

async function postTimerLifecycle(jobData) {
  const rawBody = JSON.stringify({
    invoice_id: jobData.invoice_id,
    tenant_id: jobData.tenant_id,
    timer_key: jobData.timer_key,
    status: jobData.status,
    job_reference: jobData.job_reference || null,
    note: jobData.note || null,
    lifecycle_source: jobData.lifecycle_source || 'bullmq',
  });

  const response = await fetch(`${backendBaseUrl}/api/webhooks/workflow/timers/mark`, {
    method: 'POST',
    headers: buildSignedHeaders(rawBody),
    body: rawBody,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || payload.error || `Webhook failed with status ${response.status}`);
  }

  return payload;
}

const worker = new Worker(
  timerEventsQueue,
  async job => {
    const result = await postTimerLifecycle(job.data || {});
    console.log(`timer callback sent job=${job.id} invoice=${job.data?.invoice_id} status=${job.data?.status}`);
    return result;
  },
  { connection, concurrency: 4 }
);

worker.on('completed', job => {
  console.log(`timer worker completed job=${job.id}`);
});

worker.on('failed', (job, error) => {
  console.error(`timer worker failed job=${job?.id || 'unknown'}: ${error.message}`);
});

process.on('SIGINT', async () => {
  await worker.close();
  await connection.quit();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await worker.close();
  await connection.quit();
  process.exit(0);
});

console.log(`timer worker listening on queue ${timerEventsQueue}`);