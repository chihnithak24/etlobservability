import { getStatusBadge } from '../../utils/helpers';

const LABELS = { running: 'Running', success: 'Success', failed: 'Failed', warning: 'Warning', pending: 'Pending' };

export default function StatusBadge({ status }) {
  const cls = getStatusBadge(status);
  const label = LABELS[status] || (status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown');
  return (
    <span className={`badge-base ${cls}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}
