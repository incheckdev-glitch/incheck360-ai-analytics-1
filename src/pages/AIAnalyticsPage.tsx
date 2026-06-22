import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, BarChart3, Brain, ClipboardCheck, Database, Layers, ListChecks, Search, Sparkles, Target } from 'lucide-react';
import { AIInsightCard } from '../components/AIInsightCard';
import { MetricCard } from '../components/MetricCard';
import { aiInsights as seedInsights, correctiveActions, incidents, locations, tasks } from '../data/mockData';
import { generateInternalMlInsights } from '../lib/internalMl';
import { invokeAIGenerateInsights, supabase, useMockData } from '../lib/supabase';
import type { AIInsight, Severity } from '../lib/types';

const defaultOrganizationId = '10000000-0000-0000-0000-000000000001';
const emptyOrganizationId = '00000000-0000-0000-0000-000000000001';
const envOrganizationId = import.meta.env.VITE_ORGANIZATION_ID as string | undefined;
const organizationId = !envOrganizationId || envOrganizationId === emptyOrganizationId ? defaultOrganizationId : envOrganizationId;
const reportPeriodStart = (import.meta.env.VITE_REPORT_PERIOD_START as string | undefined) || '2026-02-01';
const reportPeriodEnd = (import.meta.env.VITE_REPORT_PERIOD_END as string | undefined) || '2026-02-28';

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'locations', label: 'Location Risk' },
  { id: 'categories', label: 'Category Analysis' },
  { id: 'sections', label: 'Section Details' },
  { id: 'failed', label: 'Failed Items' },
  { id: 'repeated', label: 'Repeated Issues' },
  { id: 'actions', label: 'Action Plan' },
  { id: 'trends', label: 'Trend Analysis' },
  { id: 'insights', label: 'Insights' },
  { id: 'raw', label: 'Raw Imported Data' }
] as const;

type TabId = (typeof tabs)[number]['id'];

type AdvancedLocation = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  audit_report_count: number | null;
  completion_report_count: number | null;
  avg_audit_score_pct: number | null;
  min_audit_score_pct: number | null;
  latest_audit_score_pct: number | null;
  avg_lists_completed_pct: number | null;
  avg_lists_missed_pct: number | null;
  avg_lists_partially_done_pct: number | null;
  avg_items_completed_pct: number | null;
  avg_items_missed_pct: number | null;
  failed_item_count: number | null;
  critical_failed_item_count: number | null;
  repeated_issue_count: number | null;
  cross_contamination_failures: number | null;
  temperature_control_failures: number | null;
  labeling_failures: number | null;
  monitoring_record_failures: number | null;
  risk_score: number | null;
  health_score: number | null;
  risk_level: Severity | string | null;
  confidence: number | null;
  feature_json?: Record<string, unknown> | null;
  latest_activity_at?: string | null;
};

type CategoryRow = {
  organization_id: string;
  location_id: string | null;
  location_name: string | null;
  risk_category: string | null;
  failed_item_count: number | null;
  critical_failed_item_count: number | null;
  affected_audit_count: number | null;
  affected_section_count: number | null;
  avg_item_score_pct: number | null;
  latest_failure_at: string | null;
  category_risk_level: Severity | string | null;
};

type SectionRow = {
  organization_id: string;
  location_id: string | null;
  location_name: string | null;
  checklist_name: string | null;
  section_name: string | null;
  audit_report_count: number | null;
  avg_section_score_pct: number | null;
  min_section_score_pct: number | null;
  failed_item_count: number | null;
  critical_failed_item_count: number | null;
  latest_section_at: string | null;
  section_risk_level: Severity | string | null;
};

type FailedItemRow = {
  organization_id: string;
  location_id: string | null;
  location_name: string | null;
  audit_report_id: string;
  audit_item_id: string;
  checklist_name: string | null;
  section_name: string | null;
  item_text: string;
  result_value: string | null;
  score_earned: number | null;
  score_total: number | null;
  score_percentage: number | null;
  completed_by_name: string | null;
  completed_at: string | null;
  comment_text: string | null;
  risk_category: string | null;
  is_critical: boolean | null;
  severity: Severity | string | null;
  recommended_action: string | null;
  due_in_days: number | null;
};

type RepeatedIssueRow = {
  organization_id: string;
  location_id: string | null;
  location_name: string | null;
  normalized_item_text: string;
  example_item_text: string | null;
  risk_category: string | null;
  repeat_count: number | null;
  critical_repeat_count: number | null;
  affected_audit_count: number | null;
  latest_failure_at: string | null;
  affected_sections: string[] | null;
  repeated_issue_level: Severity | string | null;
};

type ActionRow = {
  organization_id: string;
  location_id: string | null;
  location_name: string | null;
  action_reference: string;
  severity: Severity | string | null;
  priority_rank: number | null;
  risk_category: string | null;
  section_name: string | null;
  action_title: string;
  finding_comment: string | null;
  recommended_action: string | null;
  assigned_from_audit_user: string | null;
  suggested_due_at: string | null;
  evidence_required: boolean | null;
  checklist_name: string | null;
  finding_at: string | null;
};

type TrendRow = {
  organization_id: string;
  location_id: string | null;
  location_name: string | null;
  trend_date: string | null;
  audit_count: number | null;
  avg_audit_score_pct: number | null;
  failed_item_count: number | null;
  critical_failed_item_count: number | null;
};

type RawAuditRow = {
  audit_report_id: string;
  checklist_name: string;
  location_name_text: string | null;
  score_percentage: number | null;
  score_earned: number | null;
  score_total: number | null;
  instance_status: string | null;
  completed_at: string | null;
  submitted_by_name: string | null;
};

type RawCompletionRow = {
  completion_report_id: string;
  location_name_text: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  lists_completed_pct: number | null;
  lists_missed_pct: number | null;
  items_completed_pct: number | null;
  items_missed_pct: number | null;
};

function toEvidenceStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => typeof item === 'string' ? item : JSON.stringify(item));
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

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function num(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function date(value: string | null | undefined) {
  if (!value) return '—';
  return value.slice(0, 10);
}

function severityClass(value: string | null | undefined) {
  return ['critical', 'high', 'medium', 'low'].includes(value ?? '') ? value : 'low';
}

export function AIAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [searchText, setSearchText] = useState('');
  const [locationsMl, setLocationsMl] = useState<AdvancedLocation[]>([]);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [sectionRows, setSectionRows] = useState<SectionRow[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItemRow[]>([]);
  const [repeatedIssues, setRepeatedIssues] = useState<RepeatedIssueRow[]>([]);
  const [actionRows, setActionRows] = useState<ActionRow[]>([]);
  const [trendRows, setTrendRows] = useState<TrendRow[]>([]);
  const [rawAudits, setRawAudits] = useState<RawAuditRow[]>([]);
  const [rawCompletions, setRawCompletions] = useState<RawCompletionRow[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>(useMockData ? seedInsights : []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAdvancedAnalytics() {
    if (useMockData || !supabase) return;
    setIsLoading(true);
    try {
      const [mlResult, categoryResult, sectionResult, failedResult, repeatedResult, actionResult, trendResult, auditsResult, completionResult, insightsResult] = await Promise.all([
        supabase.from('v_advanced_report_location_analytics').select('*').eq('organization_id', organizationId).order('risk_score', { ascending: false }).limit(100),
        supabase.from('v_advanced_report_category_analytics').select('*').eq('organization_id', organizationId).order('failed_item_count', { ascending: false }).limit(100),
        supabase.from('v_advanced_report_section_analytics').select('*').eq('organization_id', organizationId).order('avg_section_score_pct', { ascending: true }).limit(100),
        supabase.from('v_advanced_report_failed_items').select('*').eq('organization_id', organizationId).order('is_critical', { ascending: false }).order('completed_at', { ascending: false }).limit(250),
        supabase.from('v_advanced_report_repeated_issues').select('*').eq('organization_id', organizationId).order('repeat_count', { ascending: false }).limit(100),
        supabase.from('v_advanced_report_action_plan').select('*').eq('organization_id', organizationId).order('priority_rank', { ascending: true }).order('suggested_due_at', { ascending: true }).limit(150),
        supabase.from('v_advanced_report_trend_daily').select('*').eq('organization_id', organizationId).order('trend_date', { ascending: false }).limit(120),
        supabase.from('audit_reports').select('audit_report_id,checklist_name,location_name_text,score_percentage,score_earned,score_total,instance_status,completed_at,submitted_by_name').eq('organization_id', organizationId).order('completed_at', { ascending: false }).limit(50),
        supabase.from('completion_rate_reports').select('completion_report_id,location_name_text,date_range_start,date_range_end,lists_completed_pct,lists_missed_pct,items_completed_pct,items_missed_pct').eq('organization_id', organizationId).order('date_range_end', { ascending: false }).limit(50),
        supabase.from('ai_insights').select('insight_id,module,title,summary,recommendation,severity,confidence,status,location_id,entity_reference,evidence,generated_at,created_at').eq('organization_id', organizationId).order('generated_at', { ascending: false }).limit(50)
      ]);

      const firstError = mlResult.error || categoryResult.error || sectionResult.error || failedResult.error || repeatedResult.error || actionResult.error || trendResult.error || auditsResult.error || completionResult.error || insightsResult.error;
      if (firstError) {
        setMessage(`Advanced analytics tables are not ready: ${firstError.message}. Run advanced_report_ml_analytics_upgrade.sql in Supabase.`);
        return;
      }

      setLocationsMl((mlResult.data ?? []) as AdvancedLocation[]);
      setCategoryRows((categoryResult.data ?? []) as CategoryRow[]);
      setSectionRows((sectionResult.data ?? []) as SectionRow[]);
      setFailedItems((failedResult.data ?? []) as FailedItemRow[]);
      setRepeatedIssues((repeatedResult.data ?? []) as RepeatedIssueRow[]);
      setActionRows((actionResult.data ?? []) as ActionRow[]);
      setTrendRows((trendResult.data ?? []) as TrendRow[]);
      setRawAudits((auditsResult.data ?? []) as RawAuditRow[]);
      setRawCompletions((completionResult.data ?? []) as RawCompletionRow[]);
      setInsights((insightsResult.data ?? []).map((row) => mapSupabaseInsight(row as Record<string, unknown>)));

      const rowCount = (mlResult.data?.length ?? 0) + (auditsResult.data?.length ?? 0) + (completionResult.data?.length ?? 0);
      setMessage(rowCount ? null : `Supabase connected, but no imported report data was found for organization ${organizationId}. Run the sample seed or import report data.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Advanced analytics failed to load.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAdvancedAnalytics();
  }, []);

  async function runAdvancedMl() {
    setIsGenerating(true);
    setMessage(null);
    try {
      if (useMockData) {
        const generatedInsights = generateInternalMlInsights(locations, tasks, incidents, correctiveActions);
        setInsights(generatedInsights.length ? generatedInsights : seedInsights);
        setMessage(`Internal ML generated ${generatedInsights.length} local demo insight(s). No OpenAI API was used.`);
        return;
      }
      if (!supabase) throw new Error('Supabase is not configured.');

      const { data, error } = await supabase.rpc('run_advanced_report_ml', {
        p_organization_id: organizationId,
        p_period_start: reportPeriodStart,
        p_period_end: reportPeriodEnd
      });

      if (error) {
        const fallback = await supabase.rpc('run_internal_ml_from_imported_reports', {
          p_organization_id: organizationId,
          p_period_start: reportPeriodStart,
          p_period_end: reportPeriodEnd
        });
        if (fallback.error) {
          const edgeResult = await invokeAIGenerateInsights({ organization_id: organizationId, run_type: 'manual' });
          setMessage(`Fallback ML completed. Rows scored: ${edgeResult?.rows_scored ?? 0}. Insights created: ${edgeResult?.insights_created ?? 0}. Run the advanced SQL for full details.`);
        } else {
          setMessage(`Basic report ML completed. Rows scored: ${Array.isArray(fallback.data) ? fallback.data.length : 0}. Run advanced SQL for detailed analytics.`);
        }
      } else {
        setMessage(`Advanced report ML calculated ${Array.isArray(data) ? data.length : 0} location score(s) for ${reportPeriodStart} to ${reportPeriodEnd}.`);
      }
      await loadAdvancedAnalytics();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Advanced ML failed.');
    } finally {
      setIsGenerating(false);
    }
  }

  const filteredInsights = useMemo(
    () => severityFilter === 'all' ? insights : insights.filter((insight) => insight.severity === severityFilter),
    [severityFilter, insights]
  );

  const search = searchText.trim().toLowerCase();
  const filteredFailedItems = failedItems.filter((row) => !search || `${row.location_name} ${row.item_text} ${row.section_name} ${row.risk_category} ${row.comment_text}`.toLowerCase().includes(search));
  const filteredActions = actionRows.filter((row) => !search || `${row.location_name} ${row.action_title} ${row.risk_category} ${row.recommended_action}`.toLowerCase().includes(search));

  const avgRisk = locationsMl.length ? locationsMl.reduce((sum, row) => sum + Number(row.risk_score ?? 0), 0) / locationsMl.length : null;
  const avgHealth = locationsMl.length ? locationsMl.reduce((sum, row) => sum + Number(row.health_score ?? 0), 0) / locationsMl.length : null;
  const criticalLocations = locationsMl.filter((row) => row.risk_level === 'critical').length;
  const totalFailed = locationsMl.reduce((sum, row) => sum + Number(row.failed_item_count ?? 0), 0);
  const totalCritical = locationsMl.reduce((sum, row) => sum + Number(row.critical_failed_item_count ?? 0), 0);
  const topLocation = locationsMl[0];
  const topCategory = categoryRows[0];
  const weakestSection = sectionRows[0];

  return (
    <div className="page-stack">
      <section className="hero-card ai-hero">
        <div>
          <p className="eyebrow">Advanced internal ML analytics</p>
          <h2>Full report intelligence, root-cause analysis, and action planning.</h2>
          <p>
            This module reads imported audit and completion reports, classifies failures, detects repeated issues, scores location risk, and builds action plans without OpenAI or any external AI API.
          </p>
        </div>
        <button className="primary-button" onClick={runAdvancedMl} disabled={isGenerating}>
          <Sparkles size={17} /> {isGenerating ? 'Calculating...' : 'Run Advanced ML'}
        </button>
      </section>

      {message && <section className="notice-card">{message}</section>}
      {isLoading && <section className="notice-card">Loading advanced report analytics from Supabase...</section>}

      <section className="metric-grid three">
        <MetricCard title="Avg risk" value={avgRisk === null ? '—' : `${num(avgRisk)}/100`} hint="Internal ML risk" icon={<Brain />} tone="warning" />
        <MetricCard title="Avg health" value={avgHealth === null ? '—' : `${num(avgHealth)}/100`} hint="100 - risk score" icon={<Target />} tone="success" />
        <MetricCard title="Critical locations" value={criticalLocations} hint="Risk level critical" icon={<AlertTriangle />} tone="danger" />
      </section>

      <section className="metric-grid three">
        <MetricCard title="Failed items" value={totalFailed} hint={`${totalCritical} critical`} icon={<ClipboardCheck />} tone="danger" />
        <MetricCard title="Top risk category" value={topCategory?.risk_category ?? '—'} hint={`${topCategory?.failed_item_count ?? 0} failures`} icon={<Layers />} tone="warning" />
        <MetricCard title="Weakest section" value={weakestSection?.section_name ?? '—'} hint={pct(weakestSection?.avg_section_score_pct)} icon={<BarChart3 />} tone="warning" />
      </section>

      <section className="toolbar-card">
        <div className="row gap-sm wrap">
          {tabs.map((tab) => (
            <button key={tab.id} className={`filter-button ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="search-box">
          <Search size={18} />
          <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search details..." />
        </div>
      </section>

      {activeTab === 'overview' && (
        <div className="two-column">
          <section className="card">
            <div className="section-header"><div><p className="eyebrow">Executive summary</p><h2>What needs attention first</h2></div><Brain size={20} /></div>
            <div className="stack-list">
              <article className="list-card">
                <h3>Highest risk location</h3>
                <p>{topLocation?.location_name ?? 'No location data yet'}</p>
                <span className={`severity-badge ${severityClass(topLocation?.risk_level as string)}`}>{topLocation?.risk_level ?? '—'} · {num(topLocation?.risk_score)}/100 risk</span>
              </article>
              <article className="list-card">
                <h3>Main root cause</h3>
                <p>{topCategory ? `${topCategory.risk_category} has ${topCategory.failed_item_count} failed item(s), including ${topCategory.critical_failed_item_count} critical.` : 'No failed category data yet.'}</p>
              </article>
              <article className="list-card">
                <h3>Weakest operating section</h3>
                <p>{weakestSection ? `${weakestSection.section_name} in ${weakestSection.location_name} scored ${pct(weakestSection.avg_section_score_pct)}.` : 'No section score data yet.'}</p>
              </article>
            </div>
          </section>
          <section className="card">
            <div className="section-header"><div><p className="eyebrow">Immediate action plan</p><h2>Top priorities</h2></div><ListChecks size={20} /></div>
            <div className="stack-list">
              {actionRows.slice(0, 5).map((action) => (
                <article className="list-card" key={action.action_reference}>
                  <span className={`severity-badge ${severityClass(action.severity as string)}`}>{action.severity}</span>
                  <h3>{action.action_title}</h3>
                  <p>{action.recommended_action}</p>
                  <span className="muted-text">{action.location_name} · Due {date(action.suggested_due_at)}</span>
                </article>
              ))}
              {!actionRows.length && <span className="muted-text">No generated actions yet.</span>}
            </div>
          </section>
        </div>
      )}

      {activeTab === 'locations' && <DataTable rows={locationsMl} empty="No location ML rows found." columns={[
        ['Location', (r: AdvancedLocation) => <><strong>{r.location_name ?? '—'}</strong><span>{r.audit_report_count ?? 0} audit / {r.completion_report_count ?? 0} completion</span></>],
        ['Risk', (r) => <><span className={`severity-badge ${severityClass(r.risk_level as string)}`}>{r.risk_level ?? 'low'}</span><strong>{num(r.risk_score)}/100</strong></>],
        ['Health', (r) => `${num(r.health_score)}/100`],
        ['Audit', (r) => pct(r.avg_audit_score_pct)],
        ['Failed', (r) => `${r.failed_item_count ?? 0} (${r.critical_failed_item_count ?? 0} critical)`],
        ['Completion Missed', (r) => `Lists ${pct(r.avg_lists_missed_pct)} / Items ${pct(r.avg_items_missed_pct)}`],
        ['Confidence', (r) => pct(Number(r.confidence ?? 0) * 100)]
      ]} />}

      {activeTab === 'categories' && <DataTable rows={categoryRows} empty="No category analytics found." columns={[
        ['Category', (r: CategoryRow) => <><strong>{r.risk_category ?? 'general'}</strong><span>{r.location_name}</span></>],
        ['Risk', (r) => <span className={`severity-badge ${severityClass(r.category_risk_level as string)}`}>{r.category_risk_level ?? 'low'}</span>],
        ['Failures', (r) => `${r.failed_item_count ?? 0}`],
        ['Critical', (r) => `${r.critical_failed_item_count ?? 0}`],
        ['Audits', (r) => `${r.affected_audit_count ?? 0}`],
        ['Sections', (r) => `${r.affected_section_count ?? 0}`],
        ['Avg item score', (r) => pct(r.avg_item_score_pct)],
        ['Latest', (r) => date(r.latest_failure_at)]
      ]} />}

      {activeTab === 'sections' && <DataTable rows={sectionRows} empty="No section analytics found." columns={[
        ['Section', (r: SectionRow) => <><strong>{r.section_name ?? '—'}</strong><span>{r.checklist_name} · {r.location_name}</span></>],
        ['Risk', (r) => <span className={`severity-badge ${severityClass(r.section_risk_level as string)}`}>{r.section_risk_level ?? 'low'}</span>],
        ['Avg score', (r) => pct(r.avg_section_score_pct)],
        ['Min score', (r) => pct(r.min_section_score_pct)],
        ['Failed', (r) => `${r.failed_item_count ?? 0}`],
        ['Critical', (r) => `${r.critical_failed_item_count ?? 0}`],
        ['Latest', (r) => date(r.latest_section_at)]
      ]} />}

      {activeTab === 'failed' && <DataTable rows={filteredFailedItems} empty="No failed items found." columns={[
        ['Failed item', (r: FailedItemRow) => <><strong>{r.item_text}</strong><span>{r.section_name} · {r.location_name}</span></>],
        ['Severity', (r) => <span className={`severity-badge ${severityClass(r.severity as string)}`}>{r.severity}</span>],
        ['Category', (r) => r.risk_category ?? 'general'],
        ['Score', (r) => `${num(r.score_earned)} / ${num(r.score_total)}`],
        ['Comment', (r) => r.comment_text ?? '—'],
        ['Recommended action', (r) => r.recommended_action ?? '—'],
        ['Due days', (r) => `${r.due_in_days ?? 7}`]
      ]} />}

      {activeTab === 'repeated' && <DataTable rows={repeatedIssues} empty="No repeated issues found yet." columns={[
        ['Repeated issue', (r: RepeatedIssueRow) => <><strong>{r.example_item_text}</strong><span>{r.location_name}</span></>],
        ['Level', (r) => <span className={`severity-badge ${severityClass(r.repeated_issue_level as string)}`}>{r.repeated_issue_level}</span>],
        ['Category', (r) => r.risk_category ?? 'general'],
        ['Repeat count', (r) => `${r.repeat_count ?? 0}`],
        ['Critical repeats', (r) => `${r.critical_repeat_count ?? 0}`],
        ['Sections', (r) => (r.affected_sections ?? []).join(', ') || '—'],
        ['Latest', (r) => date(r.latest_failure_at)]
      ]} />}

      {activeTab === 'actions' && <DataTable rows={filteredActions} empty="No action plan rows found." columns={[
        ['Action', (r: ActionRow) => <><strong>{r.action_title}</strong><span>{r.action_reference} · {r.location_name}</span></>],
        ['Priority', (r) => <span className={`severity-badge ${severityClass(r.severity as string)}`}>{r.severity}</span>],
        ['Category', (r) => r.risk_category ?? 'general'],
        ['Section', (r) => r.section_name ?? '—'],
        ['Recommendation', (r) => r.recommended_action ?? '—'],
        ['Due', (r) => date(r.suggested_due_at)],
        ['Evidence', (r) => r.evidence_required ? 'Required' : 'Optional']
      ]} />}

      {activeTab === 'trends' && <DataTable rows={trendRows} empty="No trend rows found." columns={[
        ['Date', (r: TrendRow) => date(r.trend_date)],
        ['Location', (r) => r.location_name ?? '—'],
        ['Audits', (r) => `${r.audit_count ?? 0}`],
        ['Avg audit', (r) => pct(r.avg_audit_score_pct)],
        ['Failed', (r) => `${r.failed_item_count ?? 0}`],
        ['Critical', (r) => `${r.critical_failed_item_count ?? 0}`]
      ]} />}

      {activeTab === 'insights' && (
        <>
          <section className="toolbar-card"><div className="row gap-sm wrap">{(['all', 'critical', 'high', 'medium', 'low'] as Array<'all' | Severity>).map((severity) => <button key={severity} className={`filter-button ${severityFilter === severity ? 'active' : ''}`} onClick={() => setSeverityFilter(severity)}>{severity}</button>)}</div></section>
          <section className="insights-grid">
            {filteredInsights.map((insight) => <AIInsightCard key={insight.id} insight={insight} />)}
            {!filteredInsights.length && actionRows.slice(0, 6).map((action) => (
              <article className="insight-card high" key={action.action_reference}>
                <div className="insight-header"><span className={`severity-badge ${severityClass(action.severity as string)}`}>{action.severity}</span><span className="pill muted">deterministic ML</span></div>
                <h3>{action.action_title}</h3>
                <p>{action.finding_comment || 'Imported report finding requires action.'}</p>
                <div className="recommendation-box"><Sparkles size={15} /> {action.recommended_action}</div>
                <div className="insight-footer"><span>{action.location_name}</span><span>Due {date(action.suggested_due_at)}</span></div>
              </article>
            ))}
          </section>
        </>
      )}

      {activeTab === 'raw' && (
        <div className="two-column">
          <section className="card"><div className="section-header"><div><p className="eyebrow">Raw audit reports</p><h2>Imported audits</h2></div><Database size={20} /></div><SimpleRawAudit rows={rawAudits} /></section>
          <section className="card"><div className="section-header"><div><p className="eyebrow">Raw completion reports</p><h2>Imported completion</h2></div><Database size={20} /></div><SimpleRawCompletion rows={rawCompletions} /></section>
        </div>
      )}
    </div>
  );
}

function DataTable<T>({ rows, columns, empty }: { rows: T[]; columns: Array<[string, (row: T) => ReactNode]>; empty: string }) {
  return (
    <section className="card">
      <div className="table-wrap">
        <table>
          <thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, index) => <tr key={index}>{columns.map(([label, render]) => <td key={label}>{render(row)}</td>)}</tr>)}
            {!rows.length && <tr><td colSpan={columns.length}>{empty}</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SimpleRawAudit({ rows }: { rows: RawAuditRow[] }) {
  return <div className="stack-list">{rows.map((row) => <article className="list-card" key={row.audit_report_id}><h3>{row.checklist_name}</h3><p>{row.location_name_text} · {pct(row.score_percentage)} · {row.instance_status}</p><span className="muted-text">{num(row.score_earned)} / {num(row.score_total)} · {row.submitted_by_name ?? '—'} · {date(row.completed_at)}</span></article>)}{!rows.length && <span className="muted-text">No raw audit rows.</span>}</div>;
}

function SimpleRawCompletion({ rows }: { rows: RawCompletionRow[] }) {
  return <div className="stack-list">{rows.map((row) => <article className="list-card" key={row.completion_report_id}><h3>{row.location_name_text ?? 'Completion report'}</h3><p>{date(row.date_range_start)} → {date(row.date_range_end)}</p><span className="muted-text">Lists completed {pct(row.lists_completed_pct)} · Missed {pct(row.lists_missed_pct)} · Items completed {pct(row.items_completed_pct)} · Items missed {pct(row.items_missed_pct)}</span></article>)}{!rows.length && <span className="muted-text">No raw completion rows.</span>}</div>;
}
