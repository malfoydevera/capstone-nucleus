/**
 * Simple load test for GET /api/research/published
 * Usage: API_BASE=http://localhost:5000/api node scripts/load-test/browse-published.js
 */

const API_BASE = (process.env.API_BASE || 'http://localhost:5000/api').replace(/\/$/, '');
const CONCURRENCY = Number.parseInt(process.env.CONCURRENCY || '10', 10);
const ITERATIONS = Number.parseInt(process.env.ITERATIONS || '50', 10);

const QUERIES = ['', '?q=research', '?q=capstone&sort=newest', '?page=2&limit=12'];

async function fetchOnce(index) {
  const suffix = QUERIES[index % QUERIES.length];
  const url = `${API_BASE}/research/published${suffix}`;
  const start = Date.now();
  const res = await fetch(url);
  const ms = Date.now() - start;
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${res.status} ${url} — ${body.slice(0, 200)}`);
  }
  await res.json();
  return ms;
}

async function runBatch(startIndex, size) {
  const tasks = Array.from({ length: size }, (_, i) => fetchOnce(startIndex + i));
  return Promise.all(tasks);
}

async function main() {
  console.log(`Load test: ${ITERATIONS} requests, concurrency ${CONCURRENCY}`);
  console.log(`Target: ${API_BASE}/research/published`);

  const latencies = [];
  let completed = 0;

  while (completed < ITERATIONS) {
    const batchSize = Math.min(CONCURRENCY, ITERATIONS - completed);
    const batch = await runBatch(completed, batchSize);
    latencies.push(...batch);
    completed += batchSize;
    process.stdout.write(`\r${completed}/${ITERATIONS}`);
  }

  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;

  console.log('\n--- results ---');
  console.log(`ok: ${latencies.length}`);
  console.log(`avg ms: ${Math.round(sum / latencies.length)}`);
  console.log(`p95 ms: ${p95}`);
  console.log(`min ms: ${latencies[0]}`);
  console.log(`max ms: ${latencies[latencies.length - 1]}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
