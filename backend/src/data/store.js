// Shared in-memory store — imported by both jobController and analyticsController
let _jobs = null;

const getStore = () => {
  if (!_jobs) {
    try {
      const { seedJobs } = require('./seedData');
      _jobs = seedJobs();
    } catch {
      _jobs = [];
    }
  }
  return _jobs;
};

const setStore = (jobs) => { _jobs = jobs; };

module.exports = { getStore, setStore };
