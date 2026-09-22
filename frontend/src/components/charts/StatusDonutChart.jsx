import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function StatusDonutChart({ success = 0, failed = 0, running = 0, warning = 0 }) {
  const { theme } = useTheme();
  const total = success + failed + running + warning;

  const isSoft = theme === 'soft-light';

  const textColor = '#475569';
  const tooltipBg = isSoft ? '#f6f3f9' : '#ffffff';
  const tooltipBorder = isSoft ? '#cfc8de' : '#cbd5e1';
  const tooltipTitle = '#1e293b';
  const tooltipBody = '#475569';

  const data = {
    labels: ['Success', 'Failed', 'Running', 'Warning'],
    datasets: [{
      data: [success, failed, running, warning],
      backgroundColor: [
        '#16a34a',
        '#dc2626',
        '#DDA0DD',
        '#d97706',
      ],
      borderColor: isSoft ? '#f6f3f9' : '#ffffff',
      borderWidth: 2,
      hoverOffset: 4,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '72%',
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: textColor,
          padding: 16,
          font: { size: 11.5, family: 'Inter, system-ui, sans-serif' },
          usePointStyle: true,
          pointStyleWidth: 7,
        },
      },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        padding: 12,
        cornerRadius: 6,
        callbacks: {
          label: (ctx) => {
            const pct = total > 0 ? Math.round((ctx.parsed / total) * 100) : 0;
            return `  ${ctx.label}: ${ctx.parsed} (${pct}%)`;
          },
        },
      },
    },
  };

  return <Doughnut data={data} options={options} />;
}

