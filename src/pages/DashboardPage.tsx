import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Brain, Building2, CheckCircle2, ClipboardCheck, ShieldCheck } from 'lucide-react';
import { LocationPerformanceTable } from '../components/LocationPerformanceTable';
import { MetricCard } from '../components/MetricCard';
import { AIInsightCard } from '../components/AIInsightCard';
import { aiInsights, correctiveActions, incidents, locations, tasks } from '../data/mockData';
import { supabase, useMockData } from '../lib/supabase';
import type { AIInsight, DashboardMetrics, Severity } from '../lib/types';

interface DashboardPageProps {
  metrics: DashboardMetrics;
}

type AuditSummary = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  brand_name: string | null;
  audit_report_id: string;
  checklist_name: string;
  score_percentage: number | null;
  score_earned: number | null;
  score_total: number | null;
  instance_status: string | null;
  completed_at: string | null;
  submitted_by_name: string | null;
};

type CompletionSummary = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  lists_completed_pct: number | null;
  lists_missed_pct: number | null;
  items_completed_pct: number | null;
  items_missed_pct: number | null;
};

type FailureSummary = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  failed_item_count: number | null;
  critical_failed_item_count: number | null;
  cross_contamination_failures: number | null;
  temperature_control_failures: number | null;
  labeling_failures: number | null;
};

type MlScore = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  risk_score: number | null;
  health_score: number | null;
  predicted_risk_level: Severity | null;
  confidence: number | null;
  scored_at: string | null;
};

const sampleOrgId = '10000000-0000-0000-0000-000000000001';
const emptyOrgId = '00000000-0000-0000-0000-000000000001';
const envOrganizationId = import.meta.env.VITE_ORGANIZATION_ID as string | undefined;
const organizationId = !envOrganizationId || envOrganizationId === emptyOrgId ? sampleOrgId : envOrganizationId;

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function mapInsight(row: Record<string, unknown>): AIInsight {
  return {
    id: String(row.insight_id),
    module: (row.module as AIInsight['module']) || 'compliance',
    title: String(row.title ?? 'Report insight'),
    summary: String(row.summary ?? ''),
    recommendation: String(row.recommendation ?? ''),
    severity: (row.severity as Severity) || 'medium',
    confidence: Number(row.confidence ?? 0.7),
    status: (row.status as AIInsight['status']) || 'new',
    locationId: row.location_id ? String(row.location_id) : undefined,
    locationName: row.entity_reference ? String(row.entity_reference) : undefined,
    evidence: [],
    generatedAt: String(row.generated_at ?? row.created_at ?? new Date().toISOString())
  };
}

export function DashboardPage({ metrics }: DashboardPageProps) {
  const [auditRows, setAuditRows] = useState<AuditSummary[]>([]);
  const [completionRows, setCompletionRows] = useState<CompletionSummary[]>([]);
  const [failureRows, setFailureRows] = useState<FailureSummary[]>([]);
  const [scoreRows, setScoreRows] = useState<MlScore[]>([]);
  const [liveInsights, setLiveInsights] = useState<AIInsight[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadLiveDashboard() {
      if (useMockData || !supabase) return;

      const [audits, completions, failures, scores, insightsResult] = await Promise.all([
        supabase.from('v_latest_audit_report_summary').select('*').eq('organization_id', organizationId).limit(20),
        supabase.from('v_latest_completion_rate_summary').select('*').eq('organization_id', organizationId).limit(20),
        supabase.from('v_location_compliance_failure_summary').select('*').eq('organization_id', organizationId).limit(20),
        supabase.from('v_latest_ml_report_scores').select('*').eq('organization_id', organizationId).order('risk_score', { ascending: false }).limit(20),
        supabase.from('ai_insights').select('insight_id,module,title,summary,recommendation,severity,confidence,status,location_id,entity_reference,generated_at,created_at').eq('organization_id', organizationId).order('generated_at', { ascending: false }).limit(3)
      ]);

      const firstError = audits.error || completions.error || failures.error || scores.error || insightsResult.error;
      if (firstError) {
        setNotice(`Live dashboard could not load report tables: ${firstError.message}. Run the report-import SQL in Supabase.`);
        return;
      }

      setAuditRows((audits.data ?? []) as AuditSummary[]);
      setCompletionRows((completions.data ?? []) as CompletionSummary[]);
      setFailureRows((failures.data ?? []) as FailureSummary[]);
      setScoreRows((scores.data ?? []) as MlScore[]);
      setLiveInsights((insightsResult.data ?? []).map((row) => mapInsight(row as Record<string, unknown>)));

      if (!(audits.data?.length || completions.data?.length || scores.data?.length)) {
        setNotice(`Supabase is connected, but no report data was found for organization ${organizationId}. Confirm the report SQL seed was executed.`);
      } else {
        setNotice(null);
      }
    }

    void loadLiveDashboard();
  }, []);

  const avgAuditScore = useMemo(() => {
    if (!auditRows.length) return null;
    return auditRows.reduce((sum, row) => sum + Number(row.score_percentage ?? 0), 0) / auditRows.length;
  }, [auditRows]);

  const avgListsCompleted = useMemo(() => {
    if (!completionRows.length) return null;
    return completionRows.reduce((sum, row) => sum + Number(row.lists_completed_pct ?? 0), 0) / completionRows.length;
  }, [completionRows]);

  const avgItemsCompleted = useMemo(() => {
    if (!completionRows.length) return null;
    return completionRows.reduce((sum, row) => sum + Number(row.items_completed_pct ?? 0), 0) / completionRows.length;
  }, [completionRows]);

  const criticalFailures = failureRows.reduce((sum, row) => sum + Number(row.critical_failed_item_count ?? 0), 0);
  const failedItems = failureRows.reduce((sum, row) => sum + Number(row.failed_item_count ?? 0), 0);
  const highestRiskScore = scoreRows.length ? Number(scoreRows[0]?.risk_score ?? 0) : null;
  const priorityInsights = useMockData ? aiInsights.slice(0, 2) : liveInsights;

  if (useMockData) {
    return (
      <div className="page-stack">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Mock prototype mode</p>
            <h2>AI-powered operations execution for every location.</h2>
            <p>Set Supabase variables in Vercel and redeploy to show the uploaded report data.</p>
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
          <MetricCard title="Overdue actions" value={metrics.overdueActions} hint={`${correctiveActions.length} corrective actions`} icon={<BarChart3 />} tone="danger" />
          <MetricCard title="Critical AI insights" value={metrics.criticalInsights} hint="Need management attention" icon={<Brain />} tone="danger" />
        </section>
        <div className="two-column">
          <LocationPerformanceTable locations={locations} />
          <section className="card">
            <div className="section-header">
              <div><p className="eyebrow">Priority AI insights</p><h2>What needs attention</h2></div>
              <CheckCircle2 size={20} />
            </div>
            <div className="compact-list">
              {priorityInsights.map((insight) => <AIInsightCard key={insight.id} insight={insight} />)}
            </div>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Live report dashboard</p>
          <h2>Dashboard based on uploaded audit and completion-rate reports.</h2>
          <p>
            This dashboard reads Supabase report-import tables, including Food Safety Audit summaries, critical failures, completion-rate reports, and internal ML risk scores.
          </p>
        </div>
        <div className="hero-stats">
          <strong>{formatPct(avgAuditScore)}</strong>
          <span>Average audit score</span>
        </div>
      </section>

      {notice && <section className="notice-card">{notice}</section>}

      <section className="metric-grid">
        <MetricCard title="Report locations" value={new Set([...auditRows, ...completionRows, ...scoreRows].map((row) => row.location_id)).size} hint="From report imports" icon={<Building2 />} tone="neutral" />
        <MetricCard title="Audit score" value={formatPct(avgAuditScore)} hint="Napoletana / MET sample audits" icon={<ShieldCheck />} tone="success" />
        <MetricCard title="Lists completed" value={formatPct(avgListsCompleted)} hint="Completion-rate report" icon={<ClipboardCheck />} tone="success" />
        <MetricCard title="Items completed" value={formatPct(avgItemsCompleted)} hint="Completion-rate report" icon={<BarChart3 />} tone="warning" />
        <MetricCard title="Failed items" value={failedItems} hint={`${criticalFailures} critical`} icon={<AlertTriangle />} tone="danger" />
        <MetricCard title="Highest ML risk" value={highestRiskScore === null ? '—' : `${formatScore(highestRiskScore)}/100`} hint="Internal report ML" icon={<Brain />} tone="danger" />
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Food safety audit reports</p>
            <h2>Latest imported audit scores</h2>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Location</th>
                <th>Checklist</th>
                <th>Score</th>
                <th>Status</th>
                <th>Submitted By</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {auditRows.map((row) => (
                <tr key={row.audit_report_id}>
                  <td><strong>{row.location_name ?? row.brand_name ?? '—'}</strong><span>{row.brand_name ?? ''}</span></td>
                  <td>{row.checklist_name}</td>
                  <td><strong>{formatPct(row.score_percentage)}</strong><span>{formatScore(row.score_earned)} / {formatScore(row.score_total)}</span></td>
                  <td>{row.instance_status ?? '—'}</td>
                  <td>{row.submitted_by_name ?? '—'}</td>
                  <td>{row.completed_at?.slice(0, 10) ?? '—'}</td>
                </tr>
              ))}
              {!auditRows.length && <tr><td colSpan={6}>No audit reports found for this organization.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <div className="two-column">
        <section className="card">
          <div className="section-header">
            <div><p className="eyebrow">Critical findings</p><h2>Failure drivers</h2></div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Location</th><th>Failed</th><th>Critical</th><th>Cross</th><th>Temp</th><th>Labeling</th></tr>
              </thead>
              <tbody>
                {failureRows.map((row) => (
                  <tr key={row.location_id}>
                    <td><strong>{row.location_name ?? '—'}</strong></td>
                    <td>{row.failed_item_count ?? 0}</td>
                    <td>{row.critical_failed_item_count ?? 0}</td>
                    <td>{row.cross_contamination_failures ?? 0}</td>
                    <td>{row.temperature_control_failures ?? 0}</td>
                    <td>{row.labeling_failures ?? 0}</td>
                  </tr>
                ))}
                {!failureRows.length && <tr><td colSpan={6}>No failure rows found.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div><p className="eyebrow">Priority AI insights</p><h2>What needs attention</h2></div>
            <CheckCircle2 size={20} />
          </div>
          <div className="compact-list">
            {priorityInsights.map((insight) => <AIInsightCard key={insight.id} insight={insight} />)}
            {!priorityInsights.length && <span className="muted-text">No insights yet. Go to AI Analytics and click Run Report ML.</span>}
          </div>
        </section>
      </div>
    </div>
  );
}
