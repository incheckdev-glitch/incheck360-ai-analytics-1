import { AlertTriangle, Brain, Building2, CheckCircle2, ClipboardCheck, ListChecks, ShieldCheck } from 'lucide-react';
import { LocationPerformanceTable } from '../components/LocationPerformanceTable';
import { MetricCard } from '../components/MetricCard';
import { AIInsightCard } from '../components/AIInsightCard';
import { aiInsights, correctiveActions, incidents, locations, tasks } from '../data/mockData';
import type { DashboardMetrics } from '../lib/types';

interface DashboardPageProps {
  metrics: DashboardMetrics;
}

export function DashboardPage({ metrics }: DashboardPageProps) {
  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">New platform, not ERP</p>
          <h2>AI-powered operations execution for every location.</h2>
          <p>
            Track checklist completion, compliance issues, corrective actions, incidents, audits, and AI risk signals in one place.
          </p>
        </div>
        <div className="hero-stats">
          <strong>{metrics.complianceScore}%</strong>
          <span>Average compliance score</span>
        </div>
      </section>

      <section className="metric-grid">
        <MetricCard title="Locations" value={metrics.activeLocations} hint={`${metrics.locations} total`} icon={<Building2 />} tone="neutral" />
        <MetricCard title="Compliance" value={`${metrics.complianceScore}%`} hint="Average across active sites" icon={<ShieldCheck />} tone="success" />
        <MetricCard title="Task completion" value={`${metrics.taskCompletionRate}%`} hint={`${tasks.length} active tasks`} icon={<ClipboardCheck />} tone="success" />
        <MetricCard title="Open incidents" value={metrics.openIncidents} hint={`${incidents.length} total logged`} icon={<AlertTriangle />} tone="warning" />
        <MetricCard title="Overdue actions" value={metrics.overdueActions} hint={`${correctiveActions.length} corrective actions`} icon={<ListChecks />} tone="danger" />
        <MetricCard title="Critical AI insights" value={metrics.criticalInsights} hint="Need management attention" icon={<Brain />} tone="danger" />
      </section>

      <div className="two-column">
        <LocationPerformanceTable locations={locations} />
        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Priority AI insights</p>
              <h2>What needs attention</h2>
            </div>
            <CheckCircle2 size={20} />
          </div>
          <div className="compact-list">
            {aiInsights.slice(0, 2).map((insight) => <AIInsightCard key={insight.id} insight={insight} />)}
          </div>
        </section>
      </div>
    </div>
  );
}
