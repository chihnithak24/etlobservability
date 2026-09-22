export const formatDuration = (seconds) => {
  if (!seconds) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export const formatDate = (date) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatNumber = (n) => {
  if (!n) return '0';
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
};

export const getRiskColor = (score) => {
  if (score >= 70) return '#f87171';
  if (score >= 40) return '#fbbf24';
  return '#34d399';
};

export const getStatusBadge = (status) => {
  const map = { running: 'badge-running', success: 'badge-success', failed: 'badge-failed', warning: 'badge-warning', pending: 'badge-pending' };
  return map[status] || 'badge-pending';
};
