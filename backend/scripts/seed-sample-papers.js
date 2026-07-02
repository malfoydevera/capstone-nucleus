/**
 * seed-sample-papers.js
 *
 * Bulk-seed the repository with sample research papers (real PDF files) across
 * multiple categories — no manual UI uploads required.
 *
 * Usage:
 *   npm run seed:sample-papers
 *   npm run seed:sample-papers -- --count 3          # 3 papers per category
 *   npm run seed:sample-papers -- --pdf-dir ./pdfs   # use your own PDF files
 *
 * Requires: backend/.env with SUPABASE_* and GOOGLE_API_KEY (for embeddings).
 * Uses the smoke student account as author (bootstrap with npm run smoke:bootstrap-users).
 */
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const supabase = require('../src/config/supabase');
const {
  buildEmbeddingInput,
  contentHash,
  embedDocument,
} = require('../src/utils/embeddings');

const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'research-papers';
const SMOKE_STUDENT_EMAIL = process.env.SMOKE_STUDENT_EMAIL || 'smoke.student@nucleus.local';

const SAMPLE_LIBRARY = [
  {
    title: 'Deep Learning for Early Disease Detection in Medical Imaging',
    abstract:
      'This study evaluates convolutional neural networks for detecting early-stage diseases from chest X-rays and MRI scans, comparing accuracy against traditional radiologist review workflows.',
    keywords: ['deep learning', 'medical imaging', 'disease detection', 'healthcare AI'],
    categoryHint: 'Medical',
  },
  {
    title: 'Adaptive Learning Platforms and Student Engagement in Higher Education',
    abstract:
      'We analyze how adaptive learning systems personalize instruction and measure their impact on student motivation, retention, and academic performance in university settings.',
    keywords: ['adaptive learning', 'student engagement', 'higher education', 'EdTech'],
    categoryHint: 'Education',
  },
  {
    title: 'Graph Neural Networks for Social Network Community Detection',
    abstract:
      'A novel graph neural network architecture is proposed to identify communities and influential nodes in large-scale social networks with improved scalability.',
    keywords: ['graph neural networks', 'social networks', 'community detection', 'machine learning'],
    categoryHint: 'Computer Science',
  },
  {
    title: 'Sustainable Concrete Mix Design Using Recycled Aggregates',
    abstract:
      'This engineering research tests compressive strength and durability of concrete mixes incorporating recycled aggregates for sustainable construction applications.',
    keywords: ['sustainable construction', 'recycled aggregates', 'concrete', 'civil engineering'],
    categoryHint: 'Engineering',
  },
  {
    title: 'Bayesian Methods for Financial Risk Forecasting Under Market Volatility',
    abstract:
      'Bayesian hierarchical models are applied to forecast portfolio risk during volatile market conditions, with backtesting on historical equity data.',
    keywords: ['Bayesian statistics', 'financial risk', 'forecasting', 'volatility'],
    categoryHint: 'Business',
  },
  {
    title: 'Topological Data Analysis of High-Dimensional Biological Signals',
    abstract:
      'Persistent homology techniques are used to extract structural features from high-dimensional biological time series, enabling robust classification of experimental conditions.',
    keywords: ['topology', 'persistent homology', 'mathematics', 'bioinformatics'],
    categoryHint: 'Mathematics',
  },
  {
    title: 'Microplastic Pollution in Coastal Ecosystems of the Philippines',
    abstract:
      'Field sampling and spectroscopy quantify microplastic concentrations in coastal waters and assess ecological impacts on marine biodiversity.',
    keywords: ['microplastics', 'marine ecology', 'environmental science', 'pollution'],
    categoryHint: 'Natural Sciences',
  },
  {
    title: 'Digital Citizenship and Youth Political Participation in Southeast Asia',
    abstract:
      'A mixed-methods study examines how social media literacy shapes civic engagement and political participation among university students in Southeast Asia.',
    keywords: ['digital citizenship', 'political participation', 'social media', 'youth'],
    categoryHint: 'Social Sciences',
  },
];

function parseArgs(argv) {
  const args = { count: 1, pdfDir: null };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === '--count' && argv[i + 1]) {
      args.count = Math.max(1, Number.parseInt(argv[i + 1], 10) || 1);
      i += 1;
    } else if (argv[i] === '--pdf-dir' && argv[i + 1]) {
      args.pdfDir = path.resolve(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}

function buildPdfBuffer({ title, abstract, keywords }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(18).text(title, { align: 'left' });
    doc.moveDown();
    doc.fontSize(12).fillColor('#333333').text('Abstract', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(11).fillColor('#000000').text(abstract, { align: 'justify' });
    doc.moveDown();
    doc.fontSize(12).text(`Keywords: ${keywords.join(', ')}`);
    doc.moveDown();
    doc.fontSize(10).fillColor('#666666').text(
      'Sample research paper generated for NUCLEUS repository testing.',
      { align: 'left' }
    );
    doc.end();
  });
}

function listPdfFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .map((name) => path.join(dir, name));
}

function pickCategoryId(categories, hint) {
  if (!hint) return categories[0]?.id;
  const match = categories.find((c) => c.name.toLowerCase().includes(hint.toLowerCase()));
  return match?.id || categories[0]?.id;
}

async function getSmokeStudent() {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, department_id, program_id, department')
    .eq('email', SMOKE_STUDENT_EMAIL.toLowerCase())
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(
      `Smoke student not found (${SMOKE_STUDENT_EMAIL}). Run: npm run smoke:bootstrap-users`
    );
  }
  return data;
}

async function uploadPdf(authorId, buffer, fileName) {
  const storagePath = `${authorId}/${uuidv4()}.pdf`;
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, buffer, { contentType: 'application/pdf', upsert: true });

  if (error) throw error;

  const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
  return {
    file_url: urlData?.publicUrl || '',
    file_storage_path: storagePath,
    file_name: fileName,
    file_size: buffer.length,
  };
}

async function persistEmbedding(paper) {
  const input = buildEmbeddingInput(paper);
  const hash = contentHash(input);
  if (!hash) return;

  const vector = await embedDocument(input);
  if (!vector) {
    console.warn(`  ! Embedding skipped for "${paper.title}"`);
    return;
  }

  await supabase
    .from('research_papers')
    .update({
      embedding: JSON.stringify(vector),
      embedding_model: 'gemini-embedding-001',
      embedding_source_hash: hash,
      embedding_generated_at: new Date().toISOString(),
    })
    .eq('id', paper.id);
}

async function insertPublishedPaper(author, sample, categoryId, fileMeta) {
  const now = new Date().toISOString();
  const payload = {
    title: sample.title,
    abstract: sample.abstract,
    keywords: sample.keywords,
    author_id: author.id,
    category: categoryId,
    department_id: author.department_id || null,
    program_id: author.program_id || null,
    department: author.department || null,
    status: 'published',
    submission_date: now,
    published_date: now,
    view_count: Math.floor(Math.random() * 120),
    download_count: Math.floor(Math.random() * 40),
    ...fileMeta,
  };

  const { data, error } = await supabase.from('research_papers').insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function seedFromGenerated(categories, author, perCategory) {
  let created = 0;
  for (let i = 0; i < perCategory; i += 1) {
    for (const sample of SAMPLE_LIBRARY) {
      const categoryId = pickCategoryId(categories, sample.categoryHint);
      const suffix = perCategory > 1 ? ` (Set ${i + 1})` : '';
      const enriched = {
        ...sample,
        title: `${sample.title}${suffix}`,
      };

      console.log(`Creating: ${enriched.title}`);
      const pdfBuffer = await buildPdfBuffer(enriched);
      const fileMeta = await uploadPdf(author.id, pdfBuffer, `${enriched.title.slice(0, 80)}.pdf`);
      const paper = await insertPublishedPaper(author, enriched, categoryId, fileMeta);
      await persistEmbedding(paper);
      created += 1;
    }
  }
  return created;
}

async function seedFromPdfDir(pdfDir, categories, author) {
  const files = listPdfFiles(pdfDir);
  if (files.length === 0) {
    throw new Error(`No PDF files found in ${pdfDir}`);
  }

  let created = 0;
  for (let i = 0; i < files.length; i += 1) {
    const filePath = files[i];
    const baseName = path.basename(filePath, '.pdf');
    const sample = SAMPLE_LIBRARY[i % SAMPLE_LIBRARY.length];
    const categoryId = pickCategoryId(categories, sample.categoryHint);

    const enriched = {
      title: baseName.replace(/[-_]/g, ' '),
      abstract: sample.abstract,
      keywords: sample.keywords,
    };

    console.log(`Uploading PDF: ${path.basename(filePath)} → ${enriched.title}`);
    const pdfBuffer = fs.readFileSync(filePath);
    const fileMeta = await uploadPdf(author.id, pdfBuffer, path.basename(filePath));
    const paper = await insertPublishedPaper(author, enriched, categoryId, fileMeta);
    await persistEmbedding(paper);
    created += 1;
  }
  return created;
}

async function main() {
  const args = parseArgs(process.argv);

  const { data: categories, error: catError } = await supabase
    .from('research_categories')
    .select('id, name')
    .order('name');

  if (catError) throw catError;
  if (!categories?.length) {
    throw new Error('No research_categories found. Apply migrations / seed categories first.');
  }

  const author = await getSmokeStudent();
  console.log(`Author: ${author.email} (${author.id})`);
  console.log(`Categories: ${categories.map((c) => c.name).join(', ')}`);

  let created = 0;
  if (args.pdfDir) {
    console.log(`\nSeeding from PDF directory: ${args.pdfDir}`);
    created = await seedFromPdfDir(args.pdfDir, categories, author);
  } else {
    console.log(`\nSeeding ${SAMPLE_LIBRARY.length} sample papers × ${args.count} set(s) with generated PDFs...`);
    created = await seedFromGenerated(categories, author, args.count);
  }

  console.log(`\nDone. Created ${created} published paper(s) with PDFs and embeddings.`);
  console.log('Open the Repository page and try AI search (e.g. "machine learning healthcare").');
}

main().catch((error) => {
  console.error('Seed failed:', error.message || error);
  process.exit(1);
});
