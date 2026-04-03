function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4);
}

function computeLocalSimilarityScore(title, abstract) {
  const tokens = tokenize(`${title || ''} ${abstract || ''}`);
  if (tokens.length === 0) {
    return 0;
  }

  const frequency = new Map();
  tokens.forEach((token) => {
    frequency.set(token, (frequency.get(token) || 0) + 1);
  });

  const repeatedTokens = Array.from(frequency.values()).filter((count) => count > 1);
  const repetitionRatio = repeatedTokens.length / Math.max(frequency.size, 1);
  const baseScore = Math.min(95, Math.round(repetitionRatio * 100));

  // Keep local stub score in a conservative, realistic band.
  return Math.max(5, Math.min(92, baseScore));
}

function buildRiskBand(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

function buildLocalStubResult({ title, abstract }) {
  const score = computeLocalSimilarityScore(title, abstract);
  const riskBand = buildRiskBand(score);

  return {
    provider: 'local_stub',
    score,
    riskBand,
    summary: `Stub plagiarism scan complete. Similarity score is ${score}% (${riskBand} risk).`,
    report: {
      mode: 'stub',
      note: 'No external plagiarism provider configured. This is an internal heuristic estimate.',
      generatedAt: new Date().toISOString(),
      metrics: {
        score,
        riskBand,
      },
    },
  };
}

function normalizeExternalResult(result, defaultProvider) {
  const scoreRaw = Number(result?.score);
  const boundedScore = Number.isFinite(scoreRaw)
    ? Math.max(0, Math.min(100, Math.round(scoreRaw)))
    : 0;
  const riskBand = result?.riskBand || buildRiskBand(boundedScore);

  return {
    provider: result?.provider || defaultProvider,
    score: boundedScore,
    riskBand,
    summary:
      result?.summary ||
      `Plagiarism scan complete. Similarity score is ${boundedScore}% (${riskBand} risk).`,
    report: {
      mode: 'external',
      generatedAt: new Date().toISOString(),
      ...(result?.report || {}),
    },
  };
}

async function runWebhookProviderScan({ title, abstract }) {
  const webhookUrl = process.env.PLAGIARISM_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('PLAGIARISM_WEBHOOK_URL is not configured');
  }

  const timeoutMs = Number.parseInt(process.env.PLAGIARISM_WEBHOOK_TIMEOUT_MS || '12000', 10);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.PLAGIARISM_WEBHOOK_TOKEN
          ? { Authorization: `Bearer ${process.env.PLAGIARISM_WEBHOOK_TOKEN}` }
          : {}),
      },
      body: JSON.stringify({ title, abstract }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Webhook provider failed with status ${response.status}`);
    }

    const data = await response.json();
    return normalizeExternalResult(data, process.env.PLAGIARISM_PROVIDER || 'webhook');
  } finally {
    clearTimeout(timeout);
  }
}

async function runPlagiarismCheck({ title, abstract }) {
  const provider = (process.env.PLAGIARISM_PROVIDER || 'local_stub').toLowerCase();

  if (provider === 'webhook') {
    try {
      return await runWebhookProviderScan({ title, abstract });
    } catch (error) {
      console.warn(`[Plagiarism] External provider unavailable, falling back to local stub: ${error.message}`);
      return buildLocalStubResult({ title, abstract });
    }
  }

  return buildLocalStubResult({ title, abstract });
}

module.exports = {
  runPlagiarismCheck,
  computeLocalSimilarityScore,
  buildRiskBand,
};
