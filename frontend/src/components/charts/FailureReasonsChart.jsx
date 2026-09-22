import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function FailureReasonsChart({ data = [] }) {
  const { theme } = useTheme();

  const isSoft = theme === 'soft-light';

  const textColor = '#475569';
  const gridColor = isSoft ? '#cfc8de' : '#e2e8f0';
  const tooltipBg = isSoft ? '#f6f3f9' : '#ffffff';
  const tooltipBorder = isSoft ? '#cfc8de' : '#cbd5e1';
  const tooltipTitle = '#1e293b';
  const tooltipBody = '#475569';

  const COLORS = ['#dc2626','#ea580c','#d97706','#7c3aed','#DDA0DD','#16a34a'];

  const chartData = {
    labels: data.map(d => d.reason.length > 24 ? d.reason.slice(0, 24) + '…' : d.reason),
    datasets: [{
      label: 'Occurrences',
      data: data.map(d => d.count),
      backgroundColor: data.map((_, i) => COLORS[i % COLORS.length]),
      borderColor:     data.map((_, i) => COLORS[i % COLORS.length]),
      borderWidth: 1,
      borderRadius: 4,
      borderSkipped: false,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tooltipBg,
        borderColor: tooltipBorder,
        borderWidth: 1,
        titleColor: tooltipTitle,
        bodyColor: tooltipBody,
        padding: 12,
        cornerRadius: 6,
      },
    },
    scales: {
      x: {
        grid: { color: gridColor, drawBorder: false },
        ticks: { color: textColor, font: { size: 11 } },
        border: { display: false },
        beginAtZero: true,
      },
      y: {
        grid: { display: false },
        ticks: { color: textColor, font: { size: 11 } },
        border: { display: false },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}

