const supabase = require('../config/supabase');
const { notifyUser } = require('./notify');

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const REMINDER_WINDOW_HOURS = toPositiveInt(process.env.REVIEW_DEADLINE_WINDOW_HOURS, 24);
const DEDUPE_HOURS = toPositiveInt(process.env.REVIEW_DEADLINE_DEDUPE_HOURS, 12);

const hasMissingColumn = (error, columnName) =>
  String(error?.message || '').includes(columnName);

const runReviewDeadlineReminderSweep = async () => {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_HOURS * 3600000);
  const dedupeSince = new Date(now.getTime() - DEDUPE_HOURS * 3600000);

  let papers = [];
  let hasReminderColumn = true;

  let result = await supabase
    .from('research_papers')
    .select('id, title, status, review_deadline_at, deadline_reminder_last_sent_at, dean_chair_id')
    .eq('status', 'pending_program_chair')
    .is('deleted_at', null)
    .not('review_deadline_at', 'is', null)
    .lte('review_deadline_at', windowEnd.toISOString());

  if (result.error && hasMissingColumn(result.error, 'deadline_reminder_last_sent_at')) {
    hasReminderColumn = false;
    result = await supabase
      .from('research_papers')
      .select('id, title, status, review_deadline_at, dean_chair_id')
      .eq('status', 'pending_program_chair')
      .is('deleted_at', null)
      .not('review_deadline_at', 'is', null)
      .lte('review_deadline_at', windowEnd.toISOString());
  }

  if (result.error) throw result.error;
  papers = result.data || [];
  if (!papers || papers.length === 0) {
    return { remindersSent: 0, candidateCount: 0 };
  }

  let remindersSent = 0;

  for (const paper of papers) {
    if (!paper.dean_chair_id) continue;

    if (hasReminderColumn) {
      if (paper.deadline_reminder_last_sent_at) {
        const lastSent = new Date(paper.deadline_reminder_last_sent_at);
        if (!Number.isNaN(lastSent.getTime()) && lastSent >= dedupeSince) {
          continue;
        }
      }
    } else {
      const { data: recentReminder, error: reminderLookupError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', paper.dean_chair_id)
        .eq('research_id', paper.id)
        .eq('type', 'review_deadline_reminder')
        .gte('created_at', dedupeSince.toISOString())
        .limit(1);

      if (reminderLookupError) throw reminderLookupError;
      if (recentReminder && recentReminder.length > 0) continue;
    }

    const deadline = new Date(paper.review_deadline_at);
    const hoursLeft = Math.ceil((deadline.getTime() - now.getTime()) / 3600000);
    const isOverdue = hoursLeft <= 0;
    const message = isOverdue
      ? `Review deadline passed for "${paper.title}". Please complete the Program Chair review as soon as possible.`
      : `Review deadline for "${paper.title}" is in ${hoursLeft} hour(s).`;

    const result = await notifyUser({
      userId: paper.dean_chair_id,
      researchId: paper.id,
      type: 'review_deadline_reminder',
      title: isOverdue ? 'Review Deadline Overdue' : 'Review Deadline Reminder',
      message,
    });
    if (result?.error) throw result.error;

    if (hasReminderColumn) {
      const { error: updateError } = await supabase
        .from('research_papers')
        .update({ deadline_reminder_last_sent_at: now.toISOString() })
        .eq('id', paper.id);

      if (updateError && !hasMissingColumn(updateError, 'deadline_reminder_last_sent_at')) {
        throw updateError;
      }
    }

    remindersSent += 1;
  }

  return { remindersSent, candidateCount: papers.length };
};

const startReviewDeadlineReminderScheduler = () => {
  const intervalMinutes = toPositiveInt(process.env.REVIEW_DEADLINE_SWEEP_INTERVAL_MINUTES, 60);
  const intervalMs = intervalMinutes * 60 * 1000;

  const run = async () => {
    try {
      const result = await runReviewDeadlineReminderSweep();
      if (result.remindersSent > 0) {
        console.log(
          `[ReviewDeadlineScheduler] Sent ${result.remindersSent} reminder(s) from ${result.candidateCount} candidate paper(s).`
        );
      }
    } catch (error) {
      console.error('[ReviewDeadlineScheduler] Sweep failed:', error.message);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  return timer;
};

module.exports = {
  runReviewDeadlineReminderSweep,
  startReviewDeadlineReminderScheduler,
};
