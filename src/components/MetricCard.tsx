import type { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  hint: string;
  icon: ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
}

export function MetricCard({ title, value, hint, icon, tone = 'neutral' }: MetricCardProps) {
  return (
    <section className={`metric-card ${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div>
        <p>{title}</p>
        <strong>{value}</strong>
        <span>{hint}</span>
      </div>
    </section>
  );
}
