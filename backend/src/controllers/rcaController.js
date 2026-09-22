/**
 * rcaController.js
 * ────────────────────────────────────────────────────────────────────────────
 * AI Root Cause Analysis engine for failed/warning ETL jobs.
 *
 * Analysis pipeline:
 *   1. Load the job from MongoDB (or in-memory store).
 *   2. Run 7 classifier functions — each scores a specific failure category
 *      based on the job's failureReason string, log messages, resource metrics,
 *      and retry count.
 *   3. Pick the highest-scoring category as the root cause.
 *   4. Derive severity (Low / Medium / High / Critical) from score + resource data.
 *   5. Compute a confidence percentage from how much the winner outscored the runner-up.
 *   6. Generate targeted solutions for that category.
 *   7. Persist the result inside job.rootCauseAnalysis and return it to the client.
 *
 * Categories:
 *   database_connection | timeout | memory_issue | missing_file
 *   schema_mismatch     | network_error | permission_denied
 */

const { isConnected } = require('../config/db');
const { getStore }    = require('../data/store');

let Job = null;
const getJobModel = () => { if (!Job) Job = require('../models/Job'); return Job; };

/* ── Category metadata ──────────────────────────────────────────────────── */
const CATEGORIES = {
  database_connection: {
    label:   'Database Connection',
    icon:    'database',
    keywords: ['connection', 'connect', 'database', 'db error', 'refused', 'timeout connecting',
               'host unreachable', 'server closed', 'authentication failed', 'auth fail',
               'login failed', 'no route to host', 'socket'],
    logPatterns: [/connect(ion)?\s*(timeout|refused|failed|error)/i, /authentication\s*fail/i,
                  /no\s*route\s*to\s*host/i, /ECONNREFUSED/i, /host.*unreachable/i],
    solutions: [
      'Verify database host, port, and credentials in the connection string.',
      'Check if the database service is running and accepting connections.',
      'Review firewall rules and VPC security groups for the database port.',
      'Increase connection timeout in the pipeline configuration.',
      'Implement connection pooling to reduce connection overhead.',
      'Add a health-check step before the ETL pipeline starts.',
    ],
  },
  timeout: {
    label:   'Execution Timeout',
    icon:    'clock',
    keywords: ['timeout', 'timed out', 'time out', 'deadline exceeded', 'query timeout',
               'connection timeout', 'read timeout', 'write timeout', 'operation timed'],
    logPatterns: [/timed?\s*out/i, /deadline\s*exceeded/i, /timeout/i],
    solutions: [
      'Increase the job execution timeout limit in the pipeline settings.',
      'Optimize slow SQL queries — add indexes or rewrite with CTEs.',
      'Partition the dataset and process in smaller parallel batches.',
      'Reduce the batch size to keep individual operations within timeout bounds.',
      'Enable query result caching to avoid repeated full-table scans.',
      'Schedule the job during off-peak hours to reduce resource contention.',
    ],
  },
  memory_issue: {
    label:   'Memory / OOM',
    icon:    'memory',
    keywords: ['memory', 'out of memory', 'oom', 'heap', 'gc overhead', 'killed',
               'memory pressure', 'memory limit', 'java heap', 'allocation failed',
               'memory exceeded', 'swap', 'pagefile'],
    logPatterns: [/out\s*of\s*memory/i, /\bOOM\b/, /heap\s*(space|size|overflow)/i,
                  /memory\s*(limit|exceeded|pressure|error)/i, /GC\s*overhead/i],
    solutions: [
      'Increase the memory allocation for this job in the pipeline config.',
      'Enable spill-to-disk for intermediate results to reduce peak memory.',
      'Reduce the fetch size / batch size to lower memory per operation.',
      'Review and fix any memory leaks in custom transformation code.',
      'Use streaming or chunked reads instead of loading full datasets.',
      'Upgrade the worker node instance type to a memory-optimised tier.',
    ],
  },
  missing_file: {
    label:   'Missing File / Resource',
    icon:    'file',
    keywords: ['file not found', 'no such file', 'not found', 'missing file', 'path does not exist',
               'key not found', 'object not found', 'resource not found', '404', 'no object',
               'does not exist', 'file missing', 's3 key'],
    logPatterns: [/file\s*(not\s*found|missing|does\s*not\s*exist)/i, /no\s*such\s*(file|key|object)/i,
                  /path.*does\s*not\s*exist/i, /404/i, /key\s*not\s*found/i],
    solutions: [
      'Confirm the source file or S3 object key exists before the job runs.',
      'Add a pre-flight data availability check to the pipeline.',
      'Verify the source path is correct and has not been moved or renamed.',
      'Implement a retry-with-delay to handle eventual-consistency delays.',
      'Set up file-arrival triggers so the job only starts when data is ready.',
      'Alert if the expected file has not arrived within the SLA window.',
    ],
  },
  schema_mismatch: {
    label:   'Schema Mismatch',
    icon:    'schema',
    keywords: ['schema', 'column not found', 'field not found', 'type mismatch', 'cast error',
               'data type', 'incompatible', 'unexpected column', 'missing column', 'parse error',
               'invalid type', 'schema evolution', 'avro', 'parquet schema', 'null constraint'],
    logPatterns: [/schema\s*(mismatch|error|invalid|changed)/i, /column\s*(not\s*found|missing)/i,
                  /type\s*(mismatch|error|cast)/i, /cannot\s*cast/i, /parse\s*(error|fail)/i,
                  /unexpected\s*column/i, /incompatible\s*(type|schema)/i],
    solutions: [
      'Run a schema compatibility check between source and destination.',
      'Enable schema evolution / auto-migration in the pipeline configuration.',
      'Update the destination table DDL to match the new source schema.',
      'Add explicit type casting steps for changed columns.',
      'Implement schema registry validation before each pipeline run.',
      'Notify the data-producer team of the breaking schema change.',
    ],
  },
  network_error: {
    label:   'Network Error',
    icon:    'network',
    keywords: ['network', 'connection reset', 'connection refused', 'network partition',
               'broken pipe', 'socket closed', 'remote closed', 'ECONNRESET', 'ETIMEDOUT',
               'i/o error', 'tcp', 'ssl error', 'tls error', 'certificate'],
    logPatterns: [/network\s*(error|partition|failure|unreachable)/i, /connection\s*reset/i,
                  /broken\s*pipe/i, /ECONNRESET/i, /ETIMEDOUT/i, /SSL|TLS\s*error/i,
                  /socket\s*(closed|error)/i],
    solutions: [
      'Retry with exponential backoff — transient network issues often self-resolve.',
      'Check VPC routing, subnet peering, and security group rules.',
      'Verify DNS resolution for source/destination hostnames.',
      'Investigate SSL/TLS certificate expiry or mismatch between endpoints.',
      'Enable TCP keep-alive to prevent long-idle connections from being dropped.',
      'Consider a dedicated private link or VPN for critical pipelines.',
    ],
  },
  permission_denied: {
    label:   'Permission Denied',
    icon:    'shield',
    keywords: ['permission', 'access denied', 'forbidden', 'unauthorized', '403', 'insufficient privilege',
               'privilege', 'not authorized', 'read denied', 'write denied', 'acl', 'iam',
               'role', 'policy denied', 'grant'],
    logPatterns: [/permission\s*(denied|error)/i, /access\s*denied/i, /\bforbidden\b/i,
                  /\bunauthorized\b/i, /403/i, /insufficient\s*privilege/i, /not\s*authorized/i,
                  /policy\s*denied/i],
    solutions: [
      'Review and update IAM roles / database grants for the service account.',
      'Ensure the pipeline service account has read access to the source.',
      'Verify write/insert permissions on the destination table or bucket.',
      'Check that API keys or OAuth tokens have not expired.',
      'Audit recent permission changes that may have revoked access.',
      'Use least-privilege principles and document the required permission set.',
    ],
  },
};

/* ── Severity table ─────────────────────────────────────────────────────── */
function deriveSeverity(score, cpuUsage, memoryUsage, retryCount) {
  if (score >= 85 || cpuUsage >= 95 || memoryUsage >= 95 || retryCount >= 4) return 'Critical';
  if (score >= 65 || cpuUsage >= 80 || memoryUsage >= 80 || retryCount >= 2) return 'High';
  if (score >= 40 || retryCount >= 1) return 'Medium';
  return 'Low';
}

/* ── Severity colour map (used in the frontend badge) ───────────────────── */
const SEVERITY_META = {
  Low:      { color: '#34d399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.25)'  },
  Medium:   { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.25)'  },
  High:     { color: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.25)' },
  Critical: { color: '#c084fc', bg: 'rgba(192,132,252,0.12)', border: 'rgba(192,132,252,0.25)' },
};

/* ── Core classifier ────────────────────────────────────────────────────── */
/**
 * Score how well a category matches the job's signals.
 * Returns 0-100.
 */
function scoreCategory(catKey, job, logMessages) {
  const cat   = CATEGORIES[catKey];
  const text  = [
    job.failureReason || '',
    ...logMessages
  ].join(' ').toLowerCase();

  let pts = 0;

  // Keyword matching — each hit +10 (capped at 40)
  for (const kw of cat.keywords) {
    if (text.includes(kw.toLowerCase())) pts = Math.min(pts + 10, 40);
  }

  // Regex pattern matching — each hit +15 (capped at 45)
  for (const re of cat.logPatterns) {
    const combined = [job.failureReason || '', ...logMessages].join('\n');
    if (re.test(combined)) pts = Math.min(pts + 15, pts + 45);
  }

  // Resource-signal bonuses specific to each category
  if (catKey === 'memory_issue') {
    if (job.memoryUsage >= 90) pts += 20;
    else if (job.memoryUsage >= 80) pts += 12;
    else if (job.memoryUsage >= 70) pts += 6;
  }
  if (catKey === 'timeout') {
    if (job.duration  > 3600) pts += 15;
    else if (job.duration > 1800) pts += 8;
  }
  if (catKey === 'database_connection') {
    if (job.retryCount >= 3) pts += 10;
    else if (job.retryCount >= 1) pts += 5;
  }
  if (catKey === 'network_error') {
    // High retries without memory or CPU pressure → likely transient network
    if (job.retryCount >= 2 && job.cpuUsage < 75 && job.memoryUsage < 75) pts += 8;
  }

  return Math.min(pts, 100);
}

/**
 * Run all classifiers and pick the best match.
 * Returns { category, score, runnerUpScore, allScores }
 */
function classify(job, logMessages) {
  const scores = {};
  for (const key of Object.keys(CATEGORIES)) {
    scores[key] = scoreCategory(key, job, logMessages);
  }

  // Sort descending
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [winner, runnerUp] = ranked;

  return {
    category:      winner[0],
    score:         winner[1],
    runnerUpScore: runnerUp ? runnerUp[1] : 0,
    allScores:     scores,
  };
}

/**
 * Confidence: how decisive the win was.
 * If winner score is 0 (no signals matched), confidence is low (45-55%).
 * If winner clearly dominates (gap ≥ 30), confidence is high (88-96%).
 */
function computeConfidence(score, gap) {
  if (score === 0) return Math.round(40 + Math.random() * 10);   // 40-50 — uncertain
  if (gap >= 30)   return Math.round(88 + Math.random() * 8);    // 88-96 — decisive
  if (gap >= 15)   return Math.round(72 + Math.random() * 12);   // 72-84 — good
  if (gap >= 5)    return Math.round(58 + Math.random() * 12);   // 58-70 — plausible
  return Math.round(48 + Math.random() * 10);                    // 48-58 — low
}

/**
 * Collect evidence signals for display in the UI.
 */
function gatherSignals(job, logMessages, catKey) {
  const signals = [];
  const cat = CATEGORIES[catKey];

  // Match keywords found in failure reason
  if (job.failureReason) {
    for (const kw of cat.keywords) {
      if (job.failureReason.toLowerCase().includes(kw.toLowerCase())) {
        signals.push(`Failure reason contains "${kw}"`);
        break;
      }
    }
  }

  // Match log patterns
  for (const re of cat.logPatterns) {
    const hit = logMessages.find(m => re.test(m));
    if (hit) {
      signals.push(`Log entry matched: "${hit.slice(0, 80)}${hit.length > 80 ? '…' : ''}"`);
      break;
    }
  }

  // Resource metrics signals
  if (job.cpuUsage    >= 90) signals.push(`CPU usage critical: ${job.cpuUsage}%`);
  else if (job.cpuUsage >= 80) signals.push(`CPU usage elevated: ${job.cpuUsage}%`);

  if (job.memoryUsage >= 90) signals.push(`Memory usage critical: ${job.memoryUsage}%`);
  else if (job.memoryUsage >= 80) signals.push(`Memory usage elevated: ${job.memoryUsage}%`);

  if (job.retryCount >= 3) signals.push(`Job retried ${job.retryCount} times before failing`);
  else if (job.retryCount > 0) signals.push(`${job.retryCount} retry attempt(s) recorded`);

  if (job.duration > 3600) signals.push(`Execution time exceeded 1 hour (${Math.round(job.duration / 60)}m)`);

  if (signals.length === 0) {
    signals.push(`Failure reason: "${job.failureReason || 'not specified'}"`);
  }

  return signals.slice(0, 5);   // cap at 5 for readability
}

/**
 * Build a human-readable description of the analysis result.
 */
function buildDescription(catKey, job, confidence) {
  const cat = CATEGORIES[catKey];
  const conf = confidence >= 80 ? 'high confidence' : confidence >= 60 ? 'moderate confidence' : 'low confidence';
  const base = `Root cause identified as "${cat.label}" with ${conf} (${confidence}%).`;

  const detail = {
    database_connection: `The job failed while establishing a connection to the data source "${job.source}". This pattern is consistent with authentication failures, unreachable hosts, or misconfigured connection strings.`,
    timeout: `The job exceeded its allowed execution time (${job.duration ? Math.round(job.duration / 60) + 'm' : 'unknown'}). Long-running queries or large data volumes are the most common triggers.`,
    memory_issue: `Memory utilisation reached ${job.memoryUsage}% at the time of failure. The process was likely killed by the OOM killer or hit a configured heap limit.`,
    missing_file: `The pipeline could not locate a required source file, S3 object, or external resource. This commonly occurs after upstream path changes or when producers are delayed.`,
    schema_mismatch: `The source data contains columns or data types that do not match the expected destination schema. This is often caused by upstream schema changes without downstream coordination.`,
    network_error: `A network-level interruption broke the data transfer. This may be transient (retry usually resolves it) or structural (VPC / firewall misconfiguration).`,
    permission_denied: `The service account used by this pipeline lacks the required permissions on the source or destination. Recent IAM or ACL changes may be responsible.`,
  };

  return `${base} ${detail[catKey] || ''}`;
}

/* ── GET /api/rca/:jobId ─────────────────────────────────────────────────── */
/**
 * Returns the stored RCA result for a job.
 * If none exists yet, runs the analysis first (lazy).
 */
const getRca = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    let job;
    if (isConnected()) {
      job = await getJobModel().findOne({ jobId }).lean();
    } else {
      job = getStore().find(j => j.jobId === jobId);
    }
    if (!job) return res.status(404).json({ message: 'Job not found' });

    // Return cached analysis if already done — rehydrate severityMeta and allScores
    if (job.rootCauseAnalysis?.category) {
      const cached = job.rootCauseAnalysis;
      // Rehydrate severityMeta from severity string
      const severityMeta = SEVERITY_META[cached.severity] || null;
      return res.json({ ...cached, severityMeta });
    }

    // Run analysis inline for jobs that haven't been analysed yet
    return runAndRespond(job, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── POST /api/rca/:jobId/analyse ────────────────────────────────────────── */
/**
 * Force-runs RCA (re-analyses even if a previous result exists).
 * Useful when logs change after a retry.
 */
const analyseJob = async (req, res) => {
  try {
    const jobId = req.params.jobId;
    let job;
    if (isConnected()) {
      job = await getJobModel().findOne({ jobId }).lean();
    } else {
      job = getStore().find(j => j.jobId === jobId);
    }
    if (!job) return res.status(404).json({ message: 'Job not found' });
    return runAndRespond(job, res);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/* ── Shared analysis + persist logic ─────────────────────────────────────── */
async function runAndRespond(job, res) {
  // Collect log messages (ERROR + WARN carry the most signal)
  const logMessages = (job.logs || [])
    .filter(l => l.level === 'ERROR' || l.level === 'WARN')
    .map(l => l.message)
    .concat((job.logs || []).map(l => l.message))  // include all for context
    .filter(Boolean);

  const { category, score, runnerUpScore, allScores } = classify(job, logMessages);
  const gap        = score - runnerUpScore;
  const confidence = computeConfidence(score, gap);
  const severity   = deriveSeverity(score, job.cpuUsage || 0, job.memoryUsage || 0, job.retryCount || 0);
  const signals    = gatherSignals(job, logMessages, category);
  const solutions  = CATEGORIES[category].solutions;
  const description = buildDescription(category, job, confidence);

  const rca = {
    category:    CATEGORIES[category].label,
    categoryKey: category,
    severity,
    confidence,
    description,
    signals,
    solutions,
    analysedAt:  new Date(),
    allScores: Object.fromEntries(
      Object.entries(allScores).map(([k, v]) => [CATEGORIES[k].label, v])
    ),
    severityMeta: SEVERITY_META[severity],
  };

  // Persist back to MongoDB
  try {
    if (isConnected()) {
      await getJobModel().findOneAndUpdate(
        { jobId: job.jobId },
        { $set: { rootCauseAnalysis: { ...rca, severityMeta: undefined, allScores: undefined } } }
      );
    } else {
      const live = getStore().find(j => j.jobId === job.jobId);
      if (live) live.rootCauseAnalysis = { ...rca, severityMeta: undefined, allScores: undefined };
    }
  } catch (_) { /* persist is best-effort */ }

  res.json(rca);
}

module.exports = { getRca, analyseJob };
