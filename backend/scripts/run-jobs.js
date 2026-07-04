#!/usr/bin/env node
/**
 * Background job runner for PaaS cron workers.
 * Usage: node scripts/run-jobs.js --job=all|escalation|recycle|deadlines
 */
require('dotenv').config();

const { runEscalationAlertSweep } = require('../src/utils/escalationAlerts');
const { purgeExpiredRecycleBinItems } = require('../src/utils/recycleBinCleanup');
const { runReviewDeadlineReminderSweep } = require('../src/utils/reviewDeadlineReminders');

const job = process.argv.find((arg) => arg.startsWith('--job='))?.split('=')[1] || 'all';

async function main() {
  const results = {};

  if (job === 'all' || job === 'escalation') {
    results.escalation = await runEscalationAlertSweep();
    console.log('[run-jobs] escalation:', results.escalation);
  }

  if (job === 'all' || job === 'recycle') {
    results.recycle = await purgeExpiredRecycleBinItems();
    console.log('[run-jobs] recycle:', results.recycle);
  }

  if (job === 'all' || job === 'deadlines') {
    results.deadlines = await runReviewDeadlineReminderSweep();
    console.log('[run-jobs] deadlines:', results.deadlines);
  }

  if (!['all', 'escalation', 'recycle', 'deadlines'].includes(job)) {
    console.error(`Unknown job: ${job}. Use --job=all|escalation|recycle|deadlines`);
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('[run-jobs] Fatal:', err.message);
  process.exit(1);
});
