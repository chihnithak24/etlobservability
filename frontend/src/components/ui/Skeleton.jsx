export default function Skeleton({ width = '100%', height = 20, style = {} }) {
  return <div className="skeleton" style={{ width, height, ...style }} />;
}

export function TableSkeleton({ rows = 5, cols = 6 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="table-row">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="table-td">
              <Skeleton height={14} width={j === 0 ? 80 : j === cols - 1 ? 60 : '70%'} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
