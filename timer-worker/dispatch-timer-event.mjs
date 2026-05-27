import { Queue } from 'bullmq';
import IORedis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://redis:6379/0';
const timerEventsQueue = process.env.TIMER_EVENTS_QUEUE || 'workflow-timer-events';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--')) continue;
    args[key.slice(2)] = value;
  }
  return args;
}

const args = parseArgs(process.argv);
const required = ['invoice-id', 'tenant-id', 'timer-key', 'status'];
for (const key of required) {
  if (!args[key]) {
    console.error(`missing required argument --${key}`);
    process.exit(1);
  }
}

const queue = new Queue(timerEventsQueue, { connection });

const job = await queue.add('workflow.timer.lifecycle', {
  invoice_id: args['invoice-id'],
  tenant_id: args['tenant-id'],
  timer_key: args['timer-key'],
  status: args.status,
  lifecycle_source: args['lifecycle-source'] || 'bullmq',
  job_reference: args['job-reference'] || null,
  note: args.note || null,
});

console.log(JSON.stringify({ ok: true, queue: timerEventsQueue, jobId: job.id }));

await queue.close();
await connection.quit();