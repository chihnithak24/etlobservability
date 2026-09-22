export default function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;

  // Build visible page numbers with ellipsis
  const getPages = () => {
    if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
    const result = [];
    result.push(1);
    if (page > 4) result.push('...');
    for (let p = Math.max(2, page - 2); p <= Math.min(pages - 1, page + 2); p++) result.push(p);
    if (page < pages - 3) result.push('...');
    result.push(pages);
    return result;
  };

  const btnStyle = (p) => ({
    padding: '4px 10px', fontSize: 13, borderRadius: 6, border: 'none',
    cursor: p === '...' ? 'default' : 'pointer',
    background: p === page ? '#6366f1' : '#2d3748',
    color: p === page ? 'white' : '#94a3b8'
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 13 }} disabled={page === 1} onClick={() => onPage(page - 1)}>Prev</button>
      {getPages().map((p, i) => (
        <button key={i} style={btnStyle(p)} onClick={() => p !== '...' && onPage(p)} disabled={p === '...'}>{p}</button>
      ))}
      <button className="btn-secondary" style={{ padding: '4px 10px', fontSize: 13 }} disabled={page === pages} onClick={() => onPage(page + 1)}>Next</button>
    </div>
  );
}
