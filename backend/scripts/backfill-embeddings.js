require('dotenv').config();

const supabase = require('../src/config/supabase');
const {
  buildEmbeddingInput,
  contentHash,
  embedDocument,
  hasApiKey,
} = require('../src/utils/embeddings');

/**
 * Backfill semantic-search embeddings for existing research_papers.
 *
 * Generates a Gemini embedding from Title + Abstract + Keywords for every paper
 * whose embeddable content has no up-to-date embedding (missing vector or a
 * changed source hash). Idempotent and safe to re-run.
 *
 * Usage:
 *   npm run backfill:embeddings
 *   FORCE=1 npm run backfill:embeddings   # re-embed even if hash matches
 *
 * Requires GOOGLE_API_KEY and an applied add_semantic_search.sql migration.
 */
const PAGE_SIZE = 100;
// Gentle pacing to stay under Gemini rate limits during bulk backfill.
const DELAY_BETWEEN_CALLS_MS = 250;
const FORCE = process.env.FORCE === '1' || process.env.FORCE === 'true';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function backfillEmbeddings() {
  if (!hasApiKey()) {
    console.error('GOOGLE_API_KEY is not set — cannot generate embeddings.');
    process.exit(1);
  }

  console.log(`Starting embedding backfill (force=${FORCE})...`);

  let offset = 0;
  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  // Paginate over published/approved papers (the only ones surfaced by search).
  // We page by created_at to keep a stable order while rows are being updated.
  while (true) {
    const { data: papers, error } = await supabase
      .from('research_papers')
      .select('id, title, abstract, keywords, embedding_source_hash')
      .in('status', ['approved', 'published'])
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('Failed to fetch papers batch:', error.message);
      process.exit(1);
    }

    if (!papers || papers.length === 0) break;

    for (const paper of papers) {
      processed += 1;

      const input = buildEmbeddingInput(paper);
      const nextHash = contentHash(input);

      if (!nextHash) {
        skipped += 1;
        continue;
      }

      if (!FORCE && paper.embedding_source_hash === nextHash) {
        skipped += 1;
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const vector = await embedDocument(input);
      if (!vector) {
        failed += 1;
        console.warn(`  ! Embedding failed for paper ${paper.id}`);
        // eslint-disable-next-line no-await-in-loop
        await sleep(DELAY_BETWEEN_CALLS_MS);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const { error: updateError } = await supabase
        .from('research_papers')
        .update({
          embedding: JSON.stringify(vector),
          embedding_model: 'gemini-embedding-001',
          embedding_source_hash: nextHash,
          embedding_generated_at: new Date().toISOString(),
        })
        .eq('id', paper.id);

      if (updateError) {
        failed += 1;
        console.warn(`  ! Failed to store embedding for ${paper.id}:`, updateError.message);
      } else {
        updated += 1;
        if (updated % 25 === 0) console.log(`  ...embedded ${updated} papers so far`);
      }

      // eslint-disable-next-line no-await-in-loop
      await sleep(DELAY_BETWEEN_CALLS_MS);
    }

    offset += PAGE_SIZE;
  }

  console.log('Embedding backfill complete.');
  console.log(`  processed=${processed} updated=${updated} skipped=${skipped} failed=${failed}`);
  process.exit(failed > 0 ? 2 : 0);
}

backfillEmbeddings().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
