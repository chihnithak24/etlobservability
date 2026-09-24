const { isConnected } = require('../config/db');

const sources      = ['S3', 'Redshift', 'MySQL', 'PostgreSQL', 'Kafka', 'DynamoDB', 'Oracle', 'Snowflake'];
const destinations = ['Redshift', 'S3', 'BigQuery', 'Snowflake', 'PostgreSQL', 'ElasticSearch', 'MongoDB'];
const jobNames = [
  'Customer Data Sync', 'Sales Pipeline ETL', 'Inventory Aggregation', 'Log Ingestion',
  'User Events Pipeline', 'Financial Reports ETL', 'Product Catalog Sync', 'Order Processing',
  'Analytics Warehouse Load', 'ML Feature Pipeline', 'Compliance Data Export', 'Real-time CDC'
];
const failureReasons = [
  'Connection timeout', 'Schema mismatch', 'Out of memory', 'Disk quota exceeded',
  'Authentication failed', 'Data validation error', 'Network partition', 'Source unavailable',
  null, null, null, null
];

const randomBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFrom    = (arr) => arr[Math.floor(Math.random() * arr.length)];

const generateLogs = (status, startTime = new Date()) => {
  const logs = [
    { timestamp: new Date(startTime.getTime() - 40 * 60 * 1000), level: 'INFO', message: 'Job initialized' },
    { timestamp: new Date(startTime.getTime() - 35 * 60 * 1000), level: 'INFO', message: 'Connecting to source' },
    { timestamp: new Date(startTime.getTime() - 30 * 60 * 1000), level: 'INFO', message: 'Source connection established' },
    { timestamp: new Date(startTime.getTime() - 25 * 60 * 1000), level: 'INFO', message: 'Starting data extraction' },
  ];

  if (status === 'failed') {
    logs.push({ timestamp: new Date(startTime.getTime() - 20 * 60 * 1000), level: 'WARN', message: 'High memory usage detected' });
    logs.push({ timestamp: new Date(startTime.getTime() - 15 * 60 * 1000), level: 'ERROR', message: 'Job failed: ' + randomFrom(failureReasons.filter(Boolean)) });
  } else if (status === 'success') {
    logs.push({ timestamp: new Date(startTime.getTime() - 20 * 60 * 1000), level: 'INFO', message: 'Data transformation complete' });
    logs.push({ timestamp: new Date(startTime.getTime() - 15 * 60 * 1000), level: 'INFO', message: 'Job completed successfully' });
  } else if (status === 'warning') {
    logs.push({ timestamp: new Date(startTime.getTime() - 20 * 60 * 1000), level: 'WARN', message: 'Slow processing detected' });
  }

  return logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
};

const generateJob = (index, statusOverride) => {
  const statuses = ['success', 'success', 'success', 'failed', 'running', 'warning'];
  const status   = statusOverride || randomFrom(statuses);
  const startTime = new Date(Date.now() - randomBetween(1, 72) * 3600000);
  const duration  = randomBetween(30, 3600);
  const endTime   = status !== 'running' ? new Date(startTime.getTime() + duration * 1000) : null;
  const failureReason = (status === 'failed' || status === 'warning') ? randomFrom(failureReasons.filter(Boolean)) : null;
  const aiRiskScore   = status === 'failed' ? randomBetween(70, 99) : status === 'warning' ? randomBetween(40, 69) : randomBetween(5, 39);

  return {
    jobId: `JOB-${String(index + 1).padStart(4, '0')}`,
    jobName: jobNames[index % jobNames.length],
    source: randomFrom(sources),
    destination: randomFrom(destinations),
    status, startTime, endTime, duration,
    cpuUsage: randomBetween(10, 95),
    memoryUsage: randomBetween(20, 90),
    recordsProcessed: randomBetween(1000, 5000000),
    failureReason,
    retryCount: status === 'failed' ? randomBetween(0, 3) : 0,
    aiRiskScore,
    predictedStatus: aiRiskScore > 70 ? 'likely_fail' : aiRiskScore > 40 ? 'at_risk' : 'stable',
    logs: generateLogs(status, startTime),
    recoveryActions: status === 'failed' ? ['Increase memory allocation', 'Retry with backoff', 'Check source connectivity'] : [],
    anomalies: aiRiskScore > 60 ? ['High CPU spike detected', 'Unusual record count'] : []
  };
};

// Returns 40 sample job objects — used by seedDB and the local in-memory fallback
const seedJobs = () => {
  const jobs = [];
  for (let i = 0; i < 40; i++) jobs.push(generateJob(i));
  jobs[0] = { ...jobs[0], ...generateJob(0, 'running') };
  jobs[1] = { ...jobs[1], ...generateJob(1, 'running') };
  jobs[2] = { ...jobs[2], ...generateJob(2, 'failed') };
  jobs[3] = { ...jobs[3], ...generateJob(3, 'warning') };
  return jobs;
};

// Inserts seed data into MongoDB only when the collection is empty (idempotent)
const seedDB = async () => {
  if (!isConnected()) return;
  try {
    const Job   = require('../models/Job');
    const User  = require('../models/User');
    const bcrypt = require('bcryptjs');

    try {
      await Job.syncIndexes();
    } catch (e) {
      console.warn('[Seed] Index sync note:', e.message);
    }

    const userCount = await User.countDocuments();
    if (userCount === 0) {
      await User.insertMany([
        { name: 'Admin User',  email: 'admin@etl.com',  password: bcrypt.hashSync('Admin@123',  10), role: 'admin',  isFirstLogin: true },
        { name: 'Viewer User', email: 'viewer@etl.com', password: bcrypt.hashSync('Viewer@123', 10), role: 'viewer', isFirstLogin: true }
      ]);
      console.log('[Seed] Seeded default admin & viewer users into MongoDB.');
    }

    const count = await Job.countDocuments();
    if (count > 0) {
      console.log(`MongoDB already has ${count} jobs — skipping job seed.`);
      return;
    }
    const jobs = seedJobs();
    await Job.insertMany(jobs);
    console.log(`Seeded ${jobs.length} jobs into MongoDB.`);
  } catch (err) {
    console.error('Seed error:', err.message);
  }
};

module.exports = { seedJobs, seedDB };

