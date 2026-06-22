import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Brain, ClipboardCheck, Filter, Sparkles } from 'lucide-react';
import { AIInsightCard } from '../components/AIInsightCard';
import { MetricCard } from '../components/MetricCard';
import { aiInsights as seedInsights, correctiveActions, incidents, locations, tasks } from '../data/mockData';
import { generateInternalMlInsights } from '../lib/internalMl';
import { invokeAIGenerateInsights, supabase, useMockData } from '../lib/supabase';
import type { AIInsight, Severity } from '../lib/types';

const severities: Array<'all' | Severity> = ['all', 'critical', 'high', 'medium', 'low'];

// Default is the uploaded Boubess sample organization from the report-import SQL.
const defaultOrganizationId = '10000000-0000-0000-0000-000000000001';
const organizationId = (import.meta.env.VITE_ORGANIZATION_ID as string | undefined) || defaultOrganizationId;
const reportPeriodStart = (import.meta.env.VITE_REPORT_PERIOD_START as string | undefined) || '2026-02-01';
const reportPeriodEnd = (import.meta.env.VITE_REPORT_PERIOD_END as string | undefined) || '2026-02-28';

type AuditSummary = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  brand_name: string | null;
  audit_report_id: string;
  checklist_name: string;
  report_date: string | null;
  completed_at: string | null;
  score_earned: number | null;
  score_total: number | null;
  score_percentage: number | null;
  instance_status: string | null;
  submitted_by_name: string | null;
  manager_on_duty: string | null;
  auditor_name: string | null;
};

type CompletionSummary = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  completion_report_id: string;
  date_range_start: string | null;
  date_range_end: string | null;
  duration_label: string | null;
  lists_completed_pct: number | null;
  lists_done_on_time_count: number | null;
  lists_partially_done_count: number | null;
  lists_missed_count: number | null;
  lists_missed_pct: number | null;
  items_completed_pct: number | null;
  items_done_on_time_count: number | null;
  items_missed_count: number | null;
  items_missed_pct: number | null;
};

type FailureSummary = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  failed_item_count: number | null;
  critical_failed_item_count: number | null;
  temperature_control_failures: number | null;
  labeling_failures: number | null;
  cross_contamination_failures: number | null;
  cleanliness_failures: number | null;
  equipment_condition_failures: number | null;
  personal_hygiene_failures: number | null;
  monitoring_record_failures: number | null;
  latest_failure_at: string | null;
};

type MlScore = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  run_id: string;
  risk_score: number | null;
  health_score: number | null;
  predicted_risk_level: Severity | null;
  confidence: number | null;
  features: Record<string, unknown> | null;
  top_drivers: Record<string, unknown> | null;
  scored_at: string | null;
};

function toEvidenceStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return item;
    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  });
}

function mapSupabaseInsight(row: Record<string, unknown>): AIInsight {
  return {
    id: String(row.insight_id),
    module: (row.module as AIInsight['module']) || 'compliance',
    title: String(row.title ?? 'AI insight'),
    summary: String(row.summary ?? ''),
    recommendation: String(row.recommendation ?? ''),
    severity: (row.severity as Severity) || 'medium',
    confidence: Number(row.confidence ?? 0.7),
    status: (row.status as AIInsight['status']) || 'new',
    locationId: row.location_id ? String(row.location_id) : undefined,
    locationName: row.entity_reference ? String(row.entity_reference) : undefined,
    evidence: toEvidenceStrings(row.evidence),
    generatedAt: String(row.generated_at ?? row.created_at ?? new Date().toISOString())
  };
}

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  return value.slice(0, 10);
}

export function AIAnalyticsPage() {
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [insights, setInsights] = useState<AIInsight[]>(useMockData ? seedInsights : []);
  const [auditSummaries, setAuditSummaries] = useState<AuditSummary[]>([]);
  const [completionSummaries, setCompletionSummaries] = useState<CompletionSummary[]>([]);
  const [failureSummaries, setFailureSummaries] = useState<FailureSummary[]>([]);
  const [mlScores, setMlScores] = useState<MlScore[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingReports, setIsLoadingReports] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);

  async function loadLiveReportData() {
    if (useMockData || !supabase) return;

    setIsLoadingReports(true);

    try {
      const [insightsResult, auditsResult, completionResult, failuresResult, scoresResult] = await Promise.all([
        supabase
          .from('ai_insights')
          .select('insight_id,module,title,summary,recommendation,severity,confidence,status,location_id,entity_reference,evidence,generated_at,created_at')
          .eq('organization_id', organizationId)
          .order('generated_at', { ascending: false })
          .limit(50),
        supabase
          .from('v_latest_audit_report_summary')
          .select('*')
          .eq('organization_id', organizationId)
          .order('completed_at', { ascending: false })
          .limit(20),
        supabase
          .from('v_latest_completion_rate_summary')
          .select('*')
          .eq('organization_id', organizationId)
          .order('date_range_end', { ascending: false })
          .limit(20),
        supabase
          .from('v_location_compliance_failure_summary')
          .select('*')
          .eq('organization_id', organizationId)
          .order('critical_failed_item_count', { ascending: false })
          .limit(20),
        supabase
          .from('v_latest_ml_report_scores')
          .select('*')
          .eq('organization_id', organizationId)
          .order('risk_score', { ascending: false })
          .limit(20)
      ]);

      if (insightsResult.error) throw insightsResult.error;
      if (auditsResult.error) throw auditsResult.error;
      if (completionResult.error) throw completionResult.error;
      if (failuresResult.error) throw failuresResult.error;
      if (scoresResult.error) throw scoresResult.error;

      setInsights((insightsResult.data ?? []).map((row) => mapSupabaseInsight(row as Record<string, unknown>)));
      setAuditSummaries((auditsResult.data ?? []) as AuditSummary[]);
      setCompletionSummaries((completionResult.data ?? []) as CompletionSummary[]);
      setFailureSummaries((failuresResult.data ?? []) as FailureSummary[]);
      setMlScores((scoresResult.data ?? []) as MlScore[]);

      const hasReportData = (auditsResult.data?.length ?? 0) + (completionResult.data?.length ?? 0) > 0;
      if (!hasReportData) {
        setGenerationMessage(
          `Supabase connected, but no report-import data was found for organization ${organizationId}. Run the report-import SQL and confirm VITE_ORGANIZATION_ID.`
        );
      } else {
        setGenerationMessage(null);
      }
    } catch (error) {
      setGenerationMessage(
        error instanceof Error
          ? `Supabase connected, but report tables/views could not load: ${error.message}. Make sure you ran the report-import SQL.`
          : 'Supabase connected, but report tables/views could not load. Make sure you ran the report-import SQL.'
      );
    } finally {
      setIsLoadingReports(false);
    }
  }

  useEffect(() => {
    void loadLiveReportData();
  }, []);

  const filteredInsights = useMemo(
    () => severityFilter === 'all' ? insights : insights.filter((insight) => insight.severity === severityFilter),
    [severityFilter, insights]
  );

  const criticalCount = insights.filter((insight) => insight.severity === 'critical').length;
  const highCount = insights.filter((insight) => insight.severity === 'high').length;
  const openCount = insights.filter((insight) => insight.status !== 'resolved').length;

  const latestAvgAuditScore = auditSummaries.length
    ? auditSummaries.reduce((sum, item) => sum + Number(item.score_percentage ?? 0), 0) / auditSummaries.length
    : null;

  const totalCriticalFailures = failureSummaries.reduce(
    (sum, item) => sum + Number(item.critical_failed_item_count ?? 0),
    0
  );

  const highestRiskScore = mlScores.length ? Number(mlScores[0]?.risk_score ?? 0) : null;
  const avgMissedLists = completionSummaries.length
    ? completionSummaries.reduce((sum, item) => sum + Number(item.lists_missed_pct ?? 0), 0) / completionSummaries.length
    : null;

  async function handleGenerateInsights() {
    setIsGenerating(true);
    setGenerationMessage(null);

    try {
      if (useMockData) {
        const generatedInsights = generateInternalMlInsights(locations, tasks, incidents, correctiveActions);
        setInsights(generatedInsights.length ? generatedInsights : seedInsights);
        setGenerationMessage(`Internal ML generated ${generatedInsights.length} insight(s) from local demo data. No OpenAI API was used.`);
        return;
      }

      if (!supabase) throw new Error('Supabase is not configured.');

      // Prefer the new report-import ML function because it matches the uploaded PDF reports.
      const { data, error } = await supabase.rpc('run_internal_ml_from_imported_reports', {
        p_organization_id: organizationId,
        p_period_start: reportPeriodStart,
        p_period_end: reportPeriodEnd
      });

      if (error) {
        // Fallback to the original Edge Function if the report-import SQL was not installed yet.
        const result = await invokeAIGenerateInsights({ organization_id: organizationId, run_type: 'manual' });
        setGenerationMessage(
          `Fallback internal ML run completed. Rows scored: ${result?.rows_scored ?? 0}. Insights created: ${result?.insights_created ?? 0}. To use report data, run the report-import SQL.`
        );
      } else {
        setGenerationMessage(
          `Report Internal ML completed for ${reportPeriodStart} to ${reportPeriodEnd}. Rows scored: ${Array.isArray(data) ? data.length : 0}.`
        );
      }

      await loadLiveReportData();
    } catch (error) {
      setGenerationMessage(error instanceof Error ? error.message : 'Internal ML generation failed.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-card ai-hero">
        <div>
          <p className="eyebrow">Internal ML report analytics</p>
          <h2>Food safety audits, completion rate reports, and risk scoring.</h2>
          <p>
            Live mode reads the imported report tables from Supabase: audit scores, failed items, critical failures, completion rates, and ML risk scores. No OpenAI API is used.
          </p>
        </div>
        <button className="primary-button" onClick={handleGenerateInsights} disabled={isGenerating}>
          <Sparkles size={17} /> {isGenerating ? 'Generating...' : 'Run Report ML'}
        </button>
      </section>

      {generationMessage && <section className="notice-card">{generationMessage}</section>}
      {isLoadingReports && <section className="notice-card">Loading live report data from Supabase...</section>}

      <section className="metric-grid three">
        <MetricCard title="Avg audit score" value={latestAvgAuditScore === null ? '—' : formatPct(latestAvgAuditScore)} hint="Latest imported audits" icon={<ClipboardCheck />} tone="success" />
        <MetricCard title="Critical failures" value={totalCriticalFailures} hint="Food safety failures" icon={<AlertTriangle />} tone="danger" />
        <MetricCard title="Highest risk" value={highestRiskScore === null ? '—' : formatNumber(highestRiskScore)} hint="Internal ML score /100" icon={<Brain />} tone="warning" />
      </section>

      <section className="metric-grid three">
        <MetricCard title="Missed lists" value={avgMissedLists === null ? '—' : formatPct(avgMissedLists)} hint="Completion-rate reports" icon={<BarChart3 />} tone="warning" />
        <MetricCard title="High risk insights" value={highCount} hint="Manager review" icon={<Filter />} tone="warning" />
        <MetricCard title="Open insights" value={openCount} hint="Not resolved yet" icon={<Sparkles />} tone="neutral" />
      </section>

      {!useMockData && (
        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Imported audit reports</p>
              <h2>Food Safety Audit Summary</h2>
            </div>
            <span className="pill muted">Org: {organizationId.slice(0, 8)}...</span>
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
                  <th>Manager</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {auditSummaries.map((row) => (
                  <tr key={row.audit_report_id}>
                    <td><strong>{row.location_name ?? row.brand_name ?? '—'}</strong><span>{row.brand_name ?? ''}</span></td>
                    <td>{row.checklist_name}</td>
                    <td><strong>{formatPct(row.score_percentage)}</strong><span>{formatNumber(row.score_earned)} / {formatNumber(row.score_total)}</span></td>
                    <td>{row.instance_status ?? '—'}</td>
                    <td>{row.submitted_by_name ?? row.auditor_name ?? '—'}</td>
                    <td>{row.manager_on_duty ?? '—'}</td>
                    <td>{formatDate(row.completed_at ?? row.report_date)}</td>
                  </tr>
                ))}
                {!auditSummaries.length && (
                  <tr><td colSpan={7}>No audit report rows found. Run the report-import SQL and set VITE_ORGANIZATION_ID to the report organization.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!useMockData && (
        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Failure drivers</p>
              <h2>Critical Report Findings</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Failed Items</th>
                  <th>Critical</th>
                  <th>Cross Contamination</th>
                  <th>Temperature</th>
                  <th>Labeling</th>
                  <th>Monitoring</th>
                </tr>
              </thead>
              <tbody>
                {failureSummaries.map((row) => (
                  <tr key={row.location_id}>
                    <td><strong>{row.location_name ?? '—'}</strong></td>
                    <td>{row.failed_item_count ?? 0}</td>
                    <td>{row.critical_failed_item_count ?? 0}</td>
                    <td>{row.cross_contamination_failures ?? 0}</td>
                    <td>{row.temperature_control_failures ?? 0}</td>
                    <td>{row.labeling_failures ?? 0}</td>
                    <td>{row.monitoring_record_failures ?? 0}</td>
                  </tr>
                ))}
                {!failureSummaries.length && (
                  <tr><td colSpan={7}>No failure summary found yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!useMockData && (
        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Completion rate reports</p>
              <h2>Execution Discipline Summary</h2>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Period</th>
                  <th>Lists Completed</th>
                  <th>Lists Missed</th>
                  <th>Items Completed</th>
                  <th>Items Missed</th>
                </tr>
              </thead>
              <tbody>
                {completionSummaries.map((row) => (
                  <tr key={row.completion_report_id}>
                    <td><strong>{row.location_name ?? '—'}</strong><span>{row.duration_label ?? ''}</span></td>
                    <td>{formatDate(row.date_range_start)} → {formatDate(row.date_range_end)}</td>
                    <td><strong>{formatPct(row.lists_completed_pct)}</strong><span>On time: {row.lists_done_on_time_count ?? 0}</span></td>
                    <td><strong>{formatPct(row.lists_missed_pct)}</strong><span>Missed: {row.lists_missed_count ?? 0}</span></td>
                    <td><strong>{formatPct(row.items_completed_pct)}</strong><span>On time: {row.items_done_on_time_count ?? 0}</span></td>
                    <td><strong>{formatPct(row.items_missed_pct)}</strong><span>Missed: {row.items_missed_count ?? 0}</span></td>
                  </tr>
                ))}
                {!completionSummaries.length && (
                  <tr><td colSpan={6}>No completion-rate report rows found for this organization.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!useMockData && (
        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Internal ML scores</p>
              <h2>Location Risk Scores</h2>
            </div>
            <span className="pill muted">Period: {reportPeriodStart} → {reportPeriodEnd}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Risk Score</th>
                  <th>Health Score</th>
                  <th>Risk Level</th>
                  <th>Confidence</th>
                  <th>Scored At</th>
                </tr>
              </thead>
              <tbody>
                {mlScores.map((row) => (
                  <tr key={`${row.run_id}-${row.location_id}`}>
                    <td><strong>{row.location_name ?? '—'}</strong></td>
                    <td><strong>{formatNumber(row.risk_score)} / 100</strong></td>
                    <td>{formatNumber(row.health_score)} / 100</td>
                    <td><span className={`severity-badge ${row.predicted_risk_level ?? 'low'}`}>{row.predicted_risk_level ?? 'low'}</span></td>
                    <td>{row.confidence === null || row.confidence === undefined ? '—' : `${Math.round(Number(row.confidence) * 100)}%`}</td>
                    <td>{formatDate(row.scored_at)}</td>
                  </tr>
                ))}
                {!mlScores.length && (
                  <tr><td colSpan={6}>No ML score rows yet. Click Run Report ML after importing the report SQL seed data.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
        {!filteredInsights.length && !useMockData && (
          <section className="notice-card">No generated insights yet. Click Run Report ML to generate report-based insights.</section>
        )}
      </section>
    </div>
  );
}
