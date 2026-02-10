'use client';

import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

interface QualityScoreProps {
  composite: number;
  engagement: number;
  visibility: number;
  presentation: number;
  completeness: number;
  raw: {
    avgFavorites: number;
    pctPremium: number;
    avgImages: number;
    pctComplete: number;
  };
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#3b82f6';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

export function QualityScore({ composite, engagement, visibility, presentation, completeness, raw }: QualityScoreProps) {
  const gaugeData = [
    { name: 'score', value: composite, fill: getScoreColor(composite) },
  ];

  const subScores = [
    { label: 'Engagement', score: engagement, detail: `${raw.avgFavorites} avg favorites` },
    { label: 'Visibility', score: visibility, detail: `${raw.pctPremium}% premium/featured` },
    { label: 'Presentation', score: presentation, detail: `${raw.avgImages} avg images` },
    { label: 'Completeness', score: completeness, detail: `${raw.pctComplete}% with full specs` },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Gauge */}
      <div className="lg:col-span-1 bg-white rounded-lg border p-4 flex flex-col items-center">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Overall Score</h3>
        <div className="w-40 h-40 relative">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart
              innerRadius="70%"
              outerRadius="100%"
              data={gaugeData}
              startAngle={180}
              endAngle={0}
              barSize={14}
            >
              <RadialBar
                dataKey="value"
                cornerRadius={7}
                background={{ fill: '#f3f4f6' }}
              />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center" style={{ marginTop: '-10px' }}>
            <span className="text-3xl font-bold" style={{ color: getScoreColor(composite) }}>
              {composite}
            </span>
          </div>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {subScores.map(sub => (
          <div key={sub.label} className="bg-white rounded-lg border p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{sub.label}</p>
            <div className="flex items-end gap-2 mb-2">
              <span className="text-2xl font-bold" style={{ color: getScoreColor(sub.score) }}>
                {sub.score}
              </span>
              <span className="text-xs text-gray-400 pb-1">/100</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
              <div
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: `${sub.score}%`,
                  backgroundColor: getScoreColor(sub.score),
                }}
              />
            </div>
            <p className="text-xs text-gray-500">{sub.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
