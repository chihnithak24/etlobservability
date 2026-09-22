const nodemailer = require('nodemailer');

/* ── transporter ─────────────────────────────────────────────────────────── */
// Reads SMTP config from env. If SMTP_HOST is absent the service logs a
// warning and skips sending — the rest of the app is unaffected.

let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;

  if (!process.env.SMTP_HOST) {
    console.warn('[Email] SMTP_HOST not set — email notifications disabled');
    return null;
  }

  transporter = nodemailer.createTransport({
    host:   process.env.SMTP_HOST,
    port:   parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',   // true for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
};

const FROM    = process.env.EMAIL_FROM    || '"ETL Predict AI" <noreply@etl-predict.local>';
const TO      = process.env.EMAIL_TO      || 'admin@etl.com';
const RISK_THRESHOLD = parseInt(process.env.EMAIL_RISK_THRESHOLD || '70', 10);

/* ── shared send helper ──────────────────────────────────────── */
const send = async (mailOptions) => {
  const t = getTransporter();
  if (!t) return;
  try {
    const info = await t.sendMail(mailOptions);
    console.log(`[Email] Sent "${mailOptions.subject}" → messageId=${info.messageId}`);
    // Ethereal preview URL (only present when using Ethereal test accounts)
    if (info.previewUrl || nodemailer.getTestMessageUrl?.(info)) {
      console.log(`[Email] Preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error(`[Email] Failed to send "${mailOptions.subject}":`, err.message);
  }
};

/* ── Job Failure Notification ────────────────────────────────── */
const sendJobFailureEmail = async ({ jobId, jobName, source, destination, failureReason, retryCount, cpuUsage, memoryUsage, aiRiskScore }) => {
  const subject = `🔴 ETL Job Failed: ${jobName} (${jobId})`;
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#7f1d1d;padding:20px 24px">
        <h2 style="margin:0;color:#fca5a5;font-size:18px">⚠ ETL Job Failure Alert</h2>
      </div>
      <div style="padding:24px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#94a3b8;width:160px">Job ID</td><td style="color:#818cf8;font-weight:600">${jobId}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Job Name</td><td>${jobName}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Source → Dest</td><td>${source} → ${destination}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Failure Reason</td><td style="color:#f87171">${failureReason || 'Unknown'}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Retry Count</td><td>${retryCount ?? 0}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">CPU Usage</td><td>${cpuUsage ?? '-'}%</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Memory Usage</td><td>${memoryUsage ?? '-'}%</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">AI Risk Score</td><td style="color:${(aiRiskScore ?? 0) >= 70 ? '#f87171' : '#fbbf24'}">${aiRiskScore ?? '-'} / 100</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Timestamp</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <div style="margin-top:20px;padding:12px 16px;background:#1e293b;border-radius:6px;font-size:13px;color:#94a3b8">
          Log in to the ETL Predict AI dashboard to view full logs and trigger auto-recovery.
        </div>
      </div>
    </div>`;

  await send({ from: FROM, to: TO, subject, html });
};

/* ── High AI Risk Score Notification ────────────────────────── */
const sendHighRiskEmail = async ({ jobId, jobName, source, destination, aiRiskScore, predictedStatus, cpuUsage, memoryUsage }) => {
  if ((aiRiskScore ?? 0) < RISK_THRESHOLD) return;   // guard — only send when truly high

  const subject = `🟠 High AI Risk Score: ${jobName} (${jobId}) — Score ${aiRiskScore}`;
  const statusLabel = predictedStatus === 'likely_fail' ? 'Likely to Fail'
                    : predictedStatus === 'at_risk'     ? 'At Risk'
                    : 'Stable';
  const html = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0f172a;color:#e2e8f0;border-radius:8px;overflow:hidden">
      <div style="background:#78350f;padding:20px 24px">
        <h2 style="margin:0;color:#fcd34d;font-size:18px">🤖 AI High Risk Alert</h2>
      </div>
      <div style="padding:24px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <tr><td style="padding:8px 0;color:#94a3b8;width:160px">Job ID</td><td style="color:#818cf8;font-weight:600">${jobId}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Job Name</td><td>${jobName}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Source → Dest</td><td>${source} → ${destination}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">AI Risk Score</td><td style="color:#f87171;font-weight:700;font-size:16px">${aiRiskScore} / 100</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Predicted Status</td><td style="color:#fbbf24">${statusLabel}</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">CPU Usage</td><td>${cpuUsage ?? '-'}%</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Memory Usage</td><td>${memoryUsage ?? '-'}%</td></tr>
          <tr><td style="padding:8px 0;color:#94a3b8">Timestamp</td><td>${new Date().toLocaleString()}</td></tr>
        </table>
        <div style="margin-top:20px;padding:12px 16px;background:#1e293b;border-radius:6px;font-size:13px;color:#94a3b8">
          The AI model predicts this job is at elevated risk of failure. Review the job in the ETL Predict AI dashboard and consider taking preventive action.
        </div>
      </div>
    </div>`;

  await send({ from: FROM, to: TO, subject, html });
};

module.exports = { sendJobFailureEmail, sendHighRiskEmail };
