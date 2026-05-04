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
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: '#78716c' }}
            tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{ background: 'rgba(255,255,255,0.97)', border: '1px solid #e7e5e4', borderRadius: 12, fontSize: 12 }}
            formatter={(value) => [formatPrice(value as number), 'Price']}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="#4a6b4a"
            strokeWidth={2.5}
            dot={{ r: 4, fill: '#4a6b4a', strokeWidth: 0 }}
            activeDot={{ r: 6, fill: '#1a1a1a', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
