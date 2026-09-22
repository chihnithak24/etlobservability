import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function FailureTrendChart({ data = [] }) {
  const { theme } = useTheme();

  const isSoft = theme === 'soft-light';

  const textColor = '#475569';
  const gridColor = isSoft ? '#cfc8de' : '#e2e8f0';
  const tooltipBg = isSoft ? '#f6f3f9' : '#ffffff';
  const tooltipBorder = isSoft ? '#cfc8de' : '#cbd5e1';
  const tooltipTitle = '#1e293b';
  const tooltipBody = '#475569';
  const pointBorder = '#ffffff';

  const chartData = {
    labels: data.map(d => d.date),
    datasets: [
      {
        label: 'Failed',
        data: data.map(d => d.failed),
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220, 38, 38, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointBackgroundColor: '#dc2626',
        pointBorderColor: pointBorder,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#dc2626',
      },
      {
        label: 'Success',
        data: data.map(d => d.success),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.08)',
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointBackgroundColor: '#16a34a',
        pointBorderColor: pointBorder,
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointHoverBackgroundColor: '#16a34a',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        labels: {
          color: textColor,
          font: { size: 12, family: 'Inter, system-ui, sans-serif' },
          usePointStyle: true,
          pointStyleWidth: 8,
          padding: 20,
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
        displayColors: true,
        boxWidth: 8,
        boxHeight: 8,
        boxPadding: 4,
      },
    },
    scales: {
      x: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: textColor, font: { size: 11 } },
        border: { display: false },
      },
      y: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: textColor, font: { size: 11 } },
        border: { display: false },
        beginAtZero: true,
      },
    },
  };

  return <Line data={chartData} options={options} />;
}

