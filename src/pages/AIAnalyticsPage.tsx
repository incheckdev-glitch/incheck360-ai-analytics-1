import { useMemo, useState } from 'react';
import { Brain, Filter, Sparkles } from 'lucide-react';
import { AIInsightCard } from '../components/AIInsightCard';
import { MetricCard } from '../components/MetricCard';
import { aiInsights } from '../data/mockData';
import type { Severity } from '../lib/types';

const severities: Array<'all' | Severity> = ['all', 'critical', 'high', 'medium', 'low'];

export function AIAnalyticsPage() {
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const filteredInsights = useMemo(
    () => severityFilter === 'all' ? aiInsights : aiInsights.filter((insight) => insight.severity === severityFilter),
    [severityFilter]
  );

  const criticalCount = aiInsights.filter((insight) => insight.severity === 'critical').length;
  const highCount = aiInsights.filter((insight) => insight.severity === 'high').length;
  const openCount = aiInsights.filter((insight) => insight.status !== 'resolved').length;

  return (
    <div className="page-stack">
      <section className="hero-card ai-hero">
        <div>
          <p className="eyebrow">AI analytics engine</p>
          <h2>Turn operational data into risk signals and next actions.</h2>
          <p>
            The AI reads checklist execution, incidents, overdue actions, location trends, and SOP evidence, then creates structured recommendations for managers.
          </p>
        </div>
        <button className="primary-button"><Sparkles size={17} /> Generate Insights</button>
      </section>

      <section className="metric-grid three">
        <MetricCard title="Critical" value={criticalCount} hint="Needs escalation" icon={<Brain />} tone="danger" />
        <MetricCard title="High risk" value={highCount} hint="Manager review" icon={<Filter />} tone="warning" />
        <MetricCard title="Open insights" value={openCount} hint="Not resolved yet" icon={<Sparkles />} tone="neutral" />
      </section>

      <section className="toolbar-card">
        <div className="row gap-sm wrap">
          {severities.map((severity) => (
            <button
              key={severity}
              className={`filter-button ${severityFilter === severity ? 'active' : ''}`}
              onClick={() => setSeverityFilter(severity)}
            >
              {severity}
            </button>
          ))}
        </div>
      </section>

      <section className="insights-grid">
        {filteredInsights.map((insight) => <AIInsightCard key={insight.id} insight={insight} />)}
      </section>
    </div>
  );
}
