'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { formatPrice, formatDate } from '@/lib/formatters';

interface PriceHistoryChartProps {
  data: Array<{
    price: number;
    recordedAt: string;
  }>;
  currentPrice: number | null;
}

export function PriceHistoryChart({ data, currentPrice }: PriceHistoryChartProps) {
  if (data.length === 0) return null;

  const chartData = [...data]
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map(d => ({
      date: formatDate(d.recordedAt),
      price: d.price,
    }));

  // Add current price as last point if different
  if (currentPrice && chartData.length > 0 && chartData[chartData.length - 1].price !== currentPrice) {
    chartData.push({ date: 'Current', price: currentPrice });
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            formatter={(value) => [formatPrice(value as number), 'Price']}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
