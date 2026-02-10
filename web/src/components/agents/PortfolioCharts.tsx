'use client';

import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { PieLabelRenderProps } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

const CATEGORY_LABELS: Record<string, string> = {
  sale: 'For Sale',
  rental: 'For Rent',
  vacation: 'Vacation',
  new_project: 'New Projects',
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
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Category Pie */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Sale vs Rental</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                label={(props: PieLabelRenderProps) => `${props.name || ''} ${((Number(props.percent) || 0) * 100).toFixed(0)}%`}
              >
                {categoryData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subcategory Bar */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">By Property Type</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={subcategoryData} layout="vertical" margin={{ left: 60 }}>
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={55} />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Price Range Bar */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Price Distribution</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priceRanges} margin={{ bottom: 10 }}>
              <XAxis dataKey="range" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
