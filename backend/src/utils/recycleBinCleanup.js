const supabase = require('../config/supabase');
const { extractStoragePathFromUrl } = require('./fileAccess');
const logger = require('./logger');

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'research-papers';
const RETENTION_DAYS = toPositiveInt(process.env.RECYCLE_BIN_RETENTION_DAYS, 30);

const normalizeStoragePath = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return extractStoragePathFromUrl(trimmed);
  }

  return trimmed
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${STORAGE_BUCKET}/`), '')
    .split('?')[0] || null;
};

const purgeExpiredRecycleBinItems = async () => {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);

  const { data: expiredRows, error: fetchError } = await supabase
    .from('research_papers')
    .select('id, title, file_storage_path, file_url, deleted_at')
    .not('deleted_at', 'is', null)
    .lt('deleted_at', cutoff.toISOString())
    .limit(200);

  if (fetchError) throw fetchError;
  if (!expiredRows || expiredRows.length === 0) return { purged: 0, candidates: 0 };

  for (const paper of expiredRows) {
    const storagePath = normalizeStoragePath(paper.file_storage_path) || extractStoragePathFromUrl(paper.file_url);

    if (storagePath) {
      try {
        await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
      } catch (error) {
        console.error('[RecycleBinCleanup] Failed to remove storage object:', error.message, { paperId: paper.id, storagePath });
      }
    }
  }

  const paperIds = expiredRows.map((paper) => paper.id);
  const { error: deleteError } = await supabase
    .from('research_papers')
    .delete()
    .in('id', paperIds);

  if (deleteError) throw deleteError;

  return { purged: paperIds.length, candidates: expiredRows.length };
};

const startRecycleBinCleanupScheduler = () => {
  const intervalMinutes = toPositiveInt(process.env.RECYCLE_BIN_SWEEP_INTERVAL_MINUTES, 360);
  const intervalMs = intervalMinutes * 60 * 1000;

  const run = async () => {
    try {
      const result = await purgeExpiredRecycleBinItems();
      if (result.purged > 0) {
        logger.info({ purged: result.purged }, 'Recycle bin cleanup completed');
      }
    } catch (error) {
      logger.error({ err: error.message }, 'Recycle bin sweep failed');
    }
  };

  run();
  return setInterval(run, intervalMs);
};

module.exports = {
  purgeExpiredRecycleBinItems,
  startRecycleBinCleanupScheduler,
};
