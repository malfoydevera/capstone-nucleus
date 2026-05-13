const supabase = require('../config/supabase');
const { notifyUser } = require('./notify');

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const STALE_DAYS = toPositiveInt(process.env.ESCALATION_STALE_DAYS, 3);
const DEDUPE_HOURS = toPositiveInt(process.env.ESCALATION_DEDUPE_HOURS, 24);

const runEscalationAlertSweep = async () => {
  const now = new Date();
  const staleBefore = new Date(now);
  staleBefore.setDate(staleBefore.getDate() - STALE_DAYS);

  const dedupeSince = new Date(now);
  dedupeSince.setHours(dedupeSince.getHours() - DEDUPE_HOURS);

  const { data: stalePapers, error: papersError } = await supabase
    .from('research_papers')
    .select('id, title, updated_at, created_at, status, dean_chair_id, deleted_at')
    .eq('status', 'pending_program_chair')
    .is('deleted_at', null)
    .lt('updated_at', staleBefore.toISOString());

  if (papersError) throw papersError;
  if (!stalePapers || stalePapers.length === 0) return { alertsCreated: 0, staleCount: 0 };

  const { data: deanUsers, error: deansError } = await supabase
    .from('users')
    .select('id, is_active, suspended_at')
    .eq('role', 'dean');

  if (deansError) throw deansError;

  const recipients = (deanUsers || []).filter((u) => u.is_active !== false && !u.suspended_at).map((u) => u.id);
  if (recipients.length === 0) return { alertsCreated: 0, staleCount: stalePapers.length };

  let alertsCreated = 0;

  for (const paper of stalePapers) {
    const daysStale = Math.ceil((now.getTime() - new Date(paper.updated_at || paper.created_at).getTime()) / 86400000);

    for (const deanId of recipients) {
      const { data: existing, error: existingError } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', deanId)
        .eq('research_id', paper.id)
        .eq('type', 'escalation_alert')
        .gte('created_at', dedupeSince.toISOString())
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;
      if (existing?.id) continue;

      const result = await notifyUser({
        userId: deanId,
        researchId: paper.id,
        type: 'escalation_alert',
        title: 'Escalation: Program Chair Delay',
        message: `"${paper.title}" has been pending program chair review for ${daysStale} day(s).`,
      });
      if (result?.error) throw result.error;
      if (!result?.skipped) alertsCreated += 1;
    }
  }

  return { alertsCreated, staleCount: stalePapers.length };
};

const startEscalationScheduler = () => {
  const intervalMinutes = toPositiveInt(process.env.ESCALATION_SWEEP_INTERVAL_MINUTES, 60);
  const intervalMs = intervalMinutes * 60 * 1000;

  const run = async () => {
    try {
      const result = await runEscalationAlertSweep();
      if (result.alertsCreated > 0) {
        console.log(
          `[EscalationScheduler] Created ${result.alertsCreated} alert(s) from ${result.staleCount} stale paper(s).`
        );
      }
    } catch (error) {
      console.error('[EscalationScheduler] Sweep failed:', error.message);
    }
  };

  run();
  const timer = setInterval(run, intervalMs);
  return timer;
};

module.exports = {
  runEscalationAlertSweep,
  startEscalationScheduler,
};
