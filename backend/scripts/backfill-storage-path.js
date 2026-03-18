require('dotenv').config();

const supabase = require('../src/config/supabase');
const { extractStoragePathFromUrl } = require('../src/utils/fileAccess');

async function backfillStoragePath() {
  const pageSize = 200;
  let offset = 0;
  let totalUpdated = 0;

  console.log('Starting backfill for research_papers.file_storage_path...');

  while (true) {
    const { data: papers, error } = await supabase
      .from('research_papers')
      .select('id, file_url, file_storage_path')
      .is('file_storage_path', null)
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Failed to fetch papers batch:', error.message);
      process.exit(1);
    }

    if (!papers || papers.length === 0) {
      break;
    }

    for (const paper of papers) {
      const storagePath = extractStoragePathFromUrl(paper.file_url);
      if (!storagePath) {
        continue;
      }

      const { error: updateError } = await supabase
        .from('research_papers')
        .update({ file_storage_path: storagePath })
        .eq('id', paper.id);

      if (updateError) {
        console.error(`Failed to update paper ${paper.id}:`, updateError.message);
        continue;
      }

      totalUpdated += 1;
    }

    offset += pageSize;
  }

  console.log(`Backfill complete. Updated rows: ${totalUpdated}`);
}

backfillStoragePath().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
