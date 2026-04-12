require('dotenv').config();

const supabase = require('../src/config/supabase');
const { extractStoragePathFromUrl } = require('../src/utils/fileAccess');

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'research-papers';
const STORAGE_PAGE_SIZE = 100;
const STORAGE_REMOVE_BATCH_SIZE = 100;

const TABLES_TO_CLEAR = [
  'research_authors',
  'research_comments',
  'faculty_reviews',
  'approval_workflow',
  'paper_views',
  'paper_downloads',
  'co_author_invitations',
  'author_invitations',
  'editorial_checklists',
  'faculty_conflict_declarations',
  'submission_drafts',
  'notifications',
  'research_papers',
];

function isMissingTableError(error) {
  const message = String(error?.message || '');
  return message.includes("Could not find the table 'public.") && message.includes("' in the schema cache");
}

function normalizeStoragePath(value) {
  if (!value || typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return extractStoragePathFromUrl(trimmed);
  }

  return trimmed
    .split('?')[0]
    .replace(/^\/+/, '')
    .replace(new RegExp(`^${STORAGE_BUCKET}/`), '') || null;
}

async function listAllBucketPaths(prefix = '') {
  let offset = 0;
  const paths = [];

  while (true) {
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .list(prefix, {
        limit: STORAGE_PAGE_SIZE,
        offset,
        sortBy: { column: 'name', order: 'asc' },
      });

    if (error) {
      throw new Error(`Failed to list storage objects at "${prefix || '/'}": ${error.message}`);
    }

    if (!data || data.length === 0) {
      break;
    }

    for (const entry of data) {
      if (!entry || !entry.name) continue;

      const entryPath = prefix ? `${prefix}/${entry.name}` : entry.name;
      const isFolder = entry.id == null;

      if (isFolder) {
        const nestedPaths = await listAllBucketPaths(entryPath);
        paths.push(...nestedPaths);
      } else {
        paths.push(entryPath);
      }
    }

    if (data.length < STORAGE_PAGE_SIZE) {
      break;
    }

    offset += STORAGE_PAGE_SIZE;
  }

  return paths;
}

async function getReferencedPaperPaths() {
  const pageSize = 500;
  let offset = 0;
  const paths = new Set();

  while (true) {
    const { data: papers, error } = await supabase
      .from('research_papers')
      .select('file_storage_path, file_url')
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(`Failed to fetch paper storage paths: ${error.message}`);
    }

    if (!papers || papers.length === 0) {
      break;
    }

    for (const paper of papers) {
      const path = normalizeStoragePath(paper.file_storage_path) || extractStoragePathFromUrl(paper.file_url);
      if (path) {
        paths.add(path);
      }
    }

    if (papers.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return Array.from(paths);
}

async function removeStorageObjects(paths) {
  if (!paths.length) {
    return 0;
  }

  let removed = 0;

  for (let index = 0; index < paths.length; index += STORAGE_REMOVE_BATCH_SIZE) {
    const batch = paths.slice(index, index + STORAGE_REMOVE_BATCH_SIZE);
    const { error } = await supabase.storage.from(STORAGE_BUCKET).remove(batch);

    if (error) {
      throw new Error(`Failed to remove storage objects: ${error.message}`);
    }

    removed += batch.length;
  }

  return removed;
}

async function clearTable(table) {
  const { error } = await supabase.from(table).delete().not('id', 'is', null);

  if (error) {
    if (isMissingTableError(error)) {
      return 'missing';
    }

    throw new Error(`Failed to clear ${table}: ${error.message}`);
  }

  return 'cleared';
}

async function main() {
  console.log(`Resetting paper data while preserving users. Bucket: ${STORAGE_BUCKET}`);

  const referencedPaths = await getReferencedPaperPaths();
  const bucketPaths = await listAllBucketPaths();
  const allPaths = Array.from(new Set([...referencedPaths, ...bucketPaths]));

  const removedFiles = await removeStorageObjects(allPaths);
  console.log(`Removed ${removedFiles} storage object(s).`);

  for (const table of TABLES_TO_CLEAR) {
    const status = await clearTable(table);
    if (status === 'missing') {
      console.log(`Skipped missing table: ${table}`);
    } else {
      console.log(`Cleared table: ${table}`);
    }
  }

  console.log('Paper data reset complete. User accounts were preserved.');
}

main().catch((error) => {
  console.error('Paper data reset failed:', error.message);
  process.exit(1);
});
