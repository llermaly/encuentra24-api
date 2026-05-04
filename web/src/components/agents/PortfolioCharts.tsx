'use client';

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

const COLORS = ['#4a6b4a', '#c9b896', '#94a3b8', '#c8dcc7', '#1a1a1a', '#ebe4cd', '#cfd8e3', '#78716c'];

const CATEGORY_LABELS: Record<string, string> = {
  sale: 'For sale',
  rental: 'For rent',
  vacation: 'Vacation',
  new_project: 'New projects',
};

const SUBCATEGORY_LABELS: Record<string, string> = {
  casas: 'Houses',
  apartamentos: 'Apartments',
  'lotes-y-terrenos': 'Land',
  comercios: 'Commercial',
  oficinas: 'Offices',
  edificios: 'Buildings',
  fincas: 'Farms',
  'casas-y-terrenos-de-playas': 'Beach',
  negocios: 'Businesses',
  cuartos: 'Rooms',
  'apartamentos-amueblados': 'Furnished',
};

interface PortfolioChartsProps {
  categorySplit: { name: string; value: number }[];
  subcategorySplit: { name: string; value: number }[];
  priceRanges: { range: string; count: number }[];
}

const TOOLTIP_STYLE = {
  background: 'rgba(255,255,255,0.97)',
  border: '1px solid #e7e5e4',
  borderRadius: 12,
  fontSize: 12,
};

export function PortfolioCharts({ categorySplit, subcategorySplit, priceRanges }: PortfolioChartsProps) {
  const categoryData = categorySplit.map(d => ({
    ...d,
    name: CATEGORY_LABELS[d.name] || d.name,
  }));

  const subcategoryData = subcategorySplit.map(d => ({
    ...d,
    name: SUBCATEGORY_LABELS[d.name] || d.name,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <ChartCard title="Sale vs rental">
        <ResponsiveContainer width="100%" height={200}>
          <PieChart margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
            <Pie
              data={categoryData}
              cx="50%"
              cy="50%"
              innerRadius="48%"
              outerRadius="80%"
              paddingAngle={3}
              dataKey="value"
              label={(props: PieLabelRenderProps) => `${props.name || ''} ${((Number(props.percent) || 0) * 100).toFixed(0)}%`}
            >
              {categoryData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="By property type">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={subcategoryData} layout="vertical" margin={{ left: 60 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#44403c' }} width={55} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(107, 142, 107, 0.08)' }} />
            <Bar dataKey="value" fill="#6b8e6b" radius={[0, 6, 6, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Price distribution">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={priceRanges} margin={{ bottom: 10 }}>
            <XAxis dataKey="range" tick={{ fontSize: 10, fill: '#78716c' }} angle={-20} textAnchor="end" axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#78716c' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(201, 184, 150, 0.15)' }} />
            <Bar dataKey="count" fill="#c9b896" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="aurora-surface rounded-2xl p-4">
      <h3 className="text-[11px] uppercase tracking-wider text-stone-500 font-medium mb-2">{title}</h3>
      {children}
    </div>
  );
}
