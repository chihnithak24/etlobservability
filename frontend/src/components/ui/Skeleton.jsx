export default function Skeleton({ width = '100%', height = 20, style = {} }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid #111a2c' }}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} style={{ padding: '13px 16px' }}>
              <Skeleton height={14} width={j === 0 ? 80 : j === cols - 1 ? 60 : '70%'} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
