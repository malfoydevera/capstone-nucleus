const { runPlagiarismCheck, computeLocalSimilarityScore, buildRiskBand } = require('../../utils/plagiarism');

describe('plagiarism util', () => {
  const envBackup = { ...process.env };

  beforeEach(() => {
    process.env = { ...envBackup };
    delete process.env.PLAGIARISM_PROVIDER;
    delete process.env.PLAGIARISM_WEBHOOK_URL;
    delete process.env.PLAGIARISM_WEBHOOK_TOKEN;
    delete process.env.PLAGIARISM_WEBHOOK_TIMEOUT_MS;
  });

  afterAll(() => {
    process.env = envBackup;
  });

  test('buildRiskBand maps score ranges', () => {
    expect(buildRiskBand(10)).toBe('low');
    expect(buildRiskBand(45)).toBe('medium');
    expect(buildRiskBand(85)).toBe('high');
  });

  test('computeLocalSimilarityScore returns bounded score', () => {
    const score = computeLocalSimilarityScore('A Study', 'method method method results results');
    expect(score).toBeGreaterThanOrEqual(5);
    expect(score).toBeLessThanOrEqual(92);
  });

  test('runPlagiarismCheck uses local stub by default', async () => {
    const result = await runPlagiarismCheck({
      title: 'Paper Title',
      abstract: 'This abstract repeats method method and analysis analysis.',
    });

    expect(result.provider).toBe('local_stub');
    expect(result.report.mode).toBe('stub');
    expect(typeof result.score).toBe('number');
  });

  test('runPlagiarismCheck falls back to local stub when webhook is misconfigured', async () => {
    process.env.PLAGIARISM_PROVIDER = 'webhook';

    const result = await runPlagiarismCheck({
      title: 'Paper Title',
      abstract: 'Some abstract text',
    });

    expect(result.provider).toBe('local_stub');
    expect(result.report.mode).toBe('stub');
  });
});
