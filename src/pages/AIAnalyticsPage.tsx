import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, BarChart3, Brain, Building2, ClipboardCheck, Database, Download, FileText, GitCompare, Layers, ListChecks, Search, Sparkles, Target, TrendingUp } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { supabase, useMockData } from '../lib/supabase';

const defaultOrg = '10000000-0000-0000-0000-000000000001';
const emptyOrg = '00000000-0000-0000-0000-000000000001';
const envOrg = import.meta.env.VITE_ORGANIZATION_ID as string | undefined;
const organizationId = !envOrg || envOrg === emptyOrg ? defaultOrg : envOrg;
const periodStart = (import.meta.env.VITE_REPORT_PERIOD_START as string | undefined) || '2026-02-01';
const periodEnd = (import.meta.env.VITE_REPORT_PERIOD_END as string | undefined) || '2026-02-28';

type Row = Record<string, any>;

type TabId =
  | 'overview'
  | 'client'
  | 'locations'
  | 'explanation'
  | 'predictive'
  | 'benchmarking'
  | 'categories'
  | 'sections'
  | 'failed'
  | 'repeated'
  | 'actions'
  | 'management'
  | 'raw'
  | 'lineage';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'client', label: 'Client Dashboard' },
  { id: 'locations', label: 'Location Risk' },
  { id: 'explanation', label: 'ML Explanation' },
  { id: 'predictive', label: 'Predictive Risk' },
  { id: 'benchmarking', label: 'Benchmarking' },
  { id: 'categories', label: 'Category Analysis' },
  { id: 'sections', label: 'Section Details' },
  { id: 'failed', label: 'Failed Items' },
  { id: 'repeated', label: 'Repeated Issues' },
  { id: 'actions', label: 'Action Plan' },
  { id: 'management', label: 'PDF Export' },
  { id: 'raw', label: 'Raw Imported Data' },
  { id: 'lineage', label: 'Data Lineage' }
];

function safe(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

function num(value: unknown) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function pct(value: unknown) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function date(value: unknown) {
  return value ? String(value).slice(0, 10) : '—';
}

function severityClass(value: unknown) {
  const severity = String(value ?? '').toLowerCase();
  return ['critical', 'high', 'medium', 'low'].includes(severity) ? severity : 'low';
}

function makePdf(lines: string[]) {
  const esc = (text: string) => safe(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((page, i) => {
    const body = ['BT', '/F1 10 Tf', '14 TL', '48 790 Td', ...page.flatMap((line, index) => [index === 0 && i === 0 ? '/F1 20 Tf' : '/F1 10 Tf', `(${esc(line)}) Tj`, 'T*']), 'ET'].join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

async function fetchRows(table: string, query: any): Promise<{ data: Row[]; error?: string }> {
  const result = await query;
  if (result.error) return { data: [], error: `${table}: ${result.error.message}` };
  return { data: result.data ?? [] };
}

export function AIAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [searchText, setSearchText] = useState('');
  const [summary, setSummary] = useState<Row | null>(null);
  const [clientRows, setClientRows] = useState<Row[]>([]);
  const [locations, setLocations] = useState<Row[]>([]);
  const [explanations, setExplanations] = useState<Row[]>([]);
  const [predictions, setPredictions] = useState<Row[]>([]);
  const [locationBenchmarks, setLocationBenchmarks] = useState<Row[]>([]);
  const [categoryBenchmarks, setCategoryBenchmarks] = useState<Row[]>([]);
  const [sectionBenchmarks, setSectionBenchmarks] = useState<Row[]>([]);
  const [categories, setCategories] = useState<Row[]>([]);
  const [sections, setSections] = useState<Row[]>([]);
  const [failedItems, setFailedItems] = useState<Row[]>([]);
  const [repeatedIssues, setRepeatedIssues] = useState<Row[]>([]);
  const [actions, setActions] = useState<Row[]>([]);
  const [rawAudits, setRawAudits] = useState<Row[]>([]);
  const [rawCompletions, setRawCompletions] = useState<Row[]>([]);
  const [insights, setInsights] = useState<Row[]>([]);
  const [lineage, setLineage] = useState<Row[]>([]);
  const [runs, setRuns] = useState<Row[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  async function load() {
    if (useMockData || !supabase) return;
    setLoading(true);
    const errors: string[] = [];
    try {
      const results = await Promise.all([
        fetchRows('v_client_company_dashboard', supabase.from('v_client_company_dashboard').select('*').eq('organization_id', organizationId).limit(20)),
        fetchRows('v_advanced_report_location_analytics', supabase.from('v_advanced_report_location_analytics').select('*').eq('organization_id', organizationId).order('risk_score', { ascending: false }).limit(100)),
        fetchRows('v_ml_explanation_driver_breakdown', supabase.from('v_ml_explanation_driver_breakdown').select('*').eq('organization_id', organizationId).order('impact_points', { ascending: false }).limit(300)),
        fetchRows('v_predictive_location_risk', supabase.from('v_predictive_location_risk').select('*').eq('organization_id', organizationId).order('predicted_next_risk_score', { ascending: false }).limit(100)),
        fetchRows('v_location_benchmarking', supabase.from('v_location_benchmarking').select('*').eq('organization_id', organizationId).order('risk_rank_high_to_low', { ascending: true }).limit(100)),
        fetchRows('v_category_benchmarking', supabase.from('v_category_benchmarking').select('*').eq('organization_id', organizationId).order('category_failure_rank', { ascending: true }).limit(100)),
        fetchRows('v_section_benchmarking', supabase.from('v_section_benchmarking').select('*').eq('organization_id', organizationId).order('weakest_section_rank', { ascending: true }).limit(100)),
        fetchRows('v_advanced_report_category_analytics', supabase.from('v_advanced_report_category_analytics').select('*').eq('organization_id', organizationId).order('failed_item_count', { ascending: false }).limit(100)),
        fetchRows('v_advanced_report_section_analytics', supabase.from('v_advanced_report_section_analytics').select('*').eq('organization_id', organizationId).order('avg_section_score_pct', { ascending: true }).limit(100)),
        fetchRows('v_advanced_report_failed_items', supabase.from('v_advanced_report_failed_items').select('*').eq('organization_id', organizationId).order('is_critical', { ascending: false }).order('completed_at', { ascending: false }).limit(250)),
        fetchRows('v_advanced_report_repeated_issues', supabase.from('v_advanced_report_repeated_issues').select('*').eq('organization_id', organizationId).order('repeat_count', { ascending: false }).limit(100)),
        fetchRows('v_advanced_report_action_plan', supabase.from('v_advanced_report_action_plan').select('*').eq('organization_id', organizationId).order('priority_rank', { ascending: true }).limit(150)),
        fetchRows('audit_reports', supabase.from('audit_reports').select('audit_report_id,checklist_name,location_name_text,score_percentage,score_earned,score_total,instance_status,completed_at,submitted_by_name').eq('organization_id', organizationId).order('completed_at', { ascending: false }).limit(80)),
        fetchRows('completion_rate_reports', supabase.from('completion_rate_reports').select('completion_report_id,location_name_text,date_range_start,date_range_end,lists_completed_pct,lists_missed_pct,items_completed_pct,items_missed_pct').eq('organization_id', organizationId).order('date_range_end', { ascending: false }).limit(80)),
        fetchRows('ai_insights', supabase.from('ai_insights').select('insight_id,title,summary,recommendation,severity,confidence,status,entity_reference,generated_at').eq('organization_id', organizationId).order('generated_at', { ascending: false }).limit(80)),
        fetchRows('v_analytics_data_lineage', supabase.from('v_analytics_data_lineage').select('*').eq('organization_id', organizationId).order('sort_order', { ascending: true })),
        fetchRows('analytics_generation_runs', supabase.from('analytics_generation_runs').select('*').eq('organization_id', organizationId).order('started_at', { ascending: false }).limit(20))
      ]);

      results.forEach((result) => {
        if (result.error) errors.push(result.error);
      });

      setClientRows(results[0].data);
      setSummary(results[0].data[0] ?? null);
      setLocations(results[1].data);
      setExplanations(results[2].data);
      setPredictions(results[3].data);
      setLocationBenchmarks(results[4].data);
      setCategoryBenchmarks(results[5].data);
      setSectionBenchmarks(results[6].data);
      setCategories(results[7].data);
      setSections(results[8].data);
      setFailedItems(results[9].data);
      setRepeatedIssues(results[10].data);
      setActions(results[11].data);
      setRawAudits(results[12].data);
      setRawCompletions(results[13].data);
      setInsights(results[14].data);
      setLineage(results[15].data);
      setRuns(results[16].data);
      setWarnings(errors);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function runMl() {
    if (!supabase) return;
    setRunning(true);
    setMessage(null);
    try {
      const attempts = [
        () => supabase.rpc('run_advanced_report_ml_v3', { p_organization_id: organizationId, p_period_start: periodStart, p_period_end: periodEnd, p_triggered_by: 'frontend:AIAnalyticsPage' }),
        () => supabase.rpc('run_advanced_report_ml_v2', { p_organization_id: organizationId, p_period_start: periodStart, p_period_end: periodEnd }),
        () => supabase.rpc('run_advanced_report_ml', { p_organization_id: organizationId, p_period_start: periodStart, p_period_end: periodEnd }),
        () => supabase.rpc('run_internal_ml_from_imported_reports', { p_organization_id: organizationId, p_period_start: periodStart, p_period_end: periodEnd })
      ];
      let lastError = '';
      for (const attempt of attempts) {
        const { data, error } = await attempt();
        if (!error) {
          const row = Array.isArray(data) && data.length ? data[0] : {};
          setMessage(`ML finished. Raw rows: ${row.raw_rows_scanned ?? '—'}. Features: ${row.generated_feature_rows ?? Array.isArray(data) ? data.length : '—'}. Refreshing dashboard...`);
          await load();
          return;
        }
        lastError = error.message;
      }
      throw new Error(lastError || 'No ML function succeeded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ML failed.');
    } finally {
      setRunning(false);
    }
  }

  function downloadPdf() {
    const lines = [
      'InCheck360 Management Report',
      'Advanced Internal ML - Full Analytics Report',
      `Organization: ${organizationId}`,
      `Period: ${periodStart} to ${periodEnd}`,
      '',
      'EXECUTIVE SUMMARY',
      `Locations: ${safe(summary?.location_count ?? locations.length)} | Avg risk: ${safe(summary?.avg_risk_score ?? avgRisk)}/100 | Avg health: ${safe(summary?.avg_health_score ?? avgHealth)}/100`,
      `Failed items: ${safe(summary?.total_failed_items ?? totalFailed)} | Critical failures: ${safe(summary?.total_critical_failures ?? totalCritical)} | Actions: ${safe(summary?.open_action_count ?? actions.length)}`,
      '',
      'DATA LINEAGE',
      ...lineage.map((row) => `${safe(row.layer)} | ${safe(row.table_name)} | rows ${safe(row.row_count)} | generated_by ${safe(row.generated_by ?? 'not generated')} | run ${safe(row.calculation_run_id)}`),
      '',
      'PREDICTIVE RISK',
      ...predictions.slice(0, 20).map((row, index) => `${index + 1}. ${safe(row.location_name)} - current ${safe(row.current_risk_score)}/100, predicted ${safe(row.predicted_next_risk_score)}/100 (${safe(row.predicted_risk_level)})`),
      '',
      'ACTION PLAN',
      ...actions.slice(0, 35).map((row, index) => `${index + 1}. [${safe(row.severity)}] ${safe(row.location_name)} - ${safe(row.action_title)}. ${safe(row.recommended_action)}`)
    ];
    const blob = makePdf(lines);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `incheck360-management-report-${organizationId}-${periodStart}-${periodEnd}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const search = searchText.trim().toLowerCase();
  const filterRows = (rows: Row[]) => rows.filter((row) => !search || JSON.stringify(row).toLowerCase().includes(search));

  const avgRisk = summary?.avg_risk_score ?? (locations.length ? locations.reduce((sum, row) => sum + Number(row.risk_score ?? row.calculated_risk_score ?? 0), 0) / locations.length : null);
  const avgHealth = summary?.avg_health_score ?? (avgRisk === null ? null : 100 - Number(avgRisk));
  const totalFailed = summary?.total_failed_items ?? locations.reduce((sum, row) => sum + Number(row.failed_item_count ?? 0), 0);
  const totalCritical = summary?.total_critical_failures ?? locations.reduce((sum, row) => sum + Number(row.critical_failed_item_count ?? 0), 0);
  const topLocation = locations[0];
  const topPrediction = predictions[0];
  const topDriver = explanations[0];
  const lastRun = runs[0];

  return (
    <div className="page-stack">
      <section className="hero-card ai-hero">
        <div>
          <p className="eyebrow">Advanced internal ML analytics</p>
          <h2>Full analytics dashboard with data lineage proof.</h2>
          <p>All operational analytics are generated from imported raw audit and completion reports. The lineage tab proves what is raw and what is generated.</p>
        </div>
        <button className="primary-button" onClick={runMl} disabled={running}><Sparkles size={17} /> {running ? 'Analyzing...' : 'Run Advanced ML'}</button>
      </section>

      {message && <section className="notice-card">{message}</section>}
      {loading && <section className="notice-card">Loading full analytics...</section>}
      {!!warnings.length && <section className="notice-card">Some optional analytics views are missing or not ready. Available data is still shown. First warning: {warnings[0]}</section>}

      <section className="metric-grid three">
        <MetricCard title="Average risk" value={avgRisk === null ? '—' : `${num(avgRisk)}/100`} hint="Generated ML risk" icon={<Brain />} tone="warning" />
        <MetricCard title="Average health" value={avgHealth === null ? '—' : `${num(avgHealth)}/100`} hint="100 - risk" icon={<Target />} tone="success" />
        <MetricCard title="Critical failures" value={totalCritical ?? '—'} hint={`${safe(totalFailed)} total failed items`} icon={<AlertTriangle />} tone="danger" />
      </section>
      <section className="metric-grid three">
        <MetricCard title="Top risk location" value={topLocation?.location_name ?? topLocation?.location_name_text ?? '—'} hint={`${num(topLocation?.risk_score ?? topLocation?.calculated_risk_score)}/100 risk`} icon={<Building2 />} tone="danger" />
        <MetricCard title="Predicted top risk" value={topPrediction?.location_name ?? '—'} hint={`${num(topPrediction?.predicted_next_risk_score)}/100 predicted`} icon={<TrendingUp />} tone="warning" />
        <MetricCard title="Last ML run" value={lastRun?.status ?? '—'} hint={lastRun?.calculation_run_id ?? 'No run'} icon={<Database />} tone="success" />
      </section>

      <section className="toolbar-card">
        <div className="row gap-sm wrap">{tabs.map((tab) => <button key={tab.id} className={`filter-button ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div>
        <div className="search-box"><Search size={18} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search all details..." /></div>
      </section>

      {activeTab === 'overview' && <Overview topLocation={topLocation} topPrediction={topPrediction} topDriver={topDriver} actions={actions} />}
      {activeTab === 'client' && <DataTable rows={filterRows(clientRows)} empty="No client dashboard rows found." columns={[["Company", (r) => <><strong>{r.company_name ?? r.organization_id}</strong><span>{r.organization_id}</span></>], ["Reports", (r) => `${r.audit_report_count ?? 0} audits / ${r.completion_report_count ?? 0} completion`], ["Avg risk", (r) => `${num(r.avg_risk_score)}/100`], ["Avg health", (r) => `${num(r.avg_health_score)}/100`], ["Risk locations", (r) => `${r.critical_location_count ?? 0} critical / ${r.high_risk_location_count ?? 0} high`], ["Failures", (r) => `${r.total_failed_items ?? 0} failed / ${r.total_critical_failures ?? 0} critical`], ["Top category", (r) => r.top_risk_category ?? '—'], ["Actions", (r) => r.open_action_count ?? '—']]} />}
      {activeTab === 'locations' && <DataTable rows={filterRows(locations)} empty="No location ML rows found. Run Advanced ML." columns={[["Location", (r) => <><strong>{r.location_name ?? '—'}</strong><span>{r.audit_report_count ?? 0} audit / {r.completion_report_count ?? 0} completion</span></>], ["Risk", (r) => <><span className={`severity-badge ${severityClass(r.risk_level ?? r.predicted_risk_level)}`}>{r.risk_level ?? r.predicted_risk_level ?? '—'}</span><strong>{num(r.risk_score ?? r.calculated_risk_score)}/100</strong></>], ["Health", (r) => `${num(r.health_score)}/100`], ["Audit", (r) => pct(r.avg_audit_score_pct ?? r.avg_audit_score_percentage)], ["Failed", (r) => `${r.failed_item_count ?? 0} (${r.critical_failed_item_count ?? 0} critical)`], ["Missed", (r) => `Lists ${pct(r.avg_lists_missed_pct)} / Items ${pct(r.avg_items_missed_pct)}`], ["Confidence", (r) => pct(Number(r.confidence ?? 0) * 100)]]} />}
      {activeTab === 'explanation' && <DataTable rows={filterRows(explanations)} empty="No ML explanations found." columns={[["Location", (r) => <><strong>{r.location_name ?? '—'}</strong><span>Risk {num(r.risk_score)}/100</span></>], ["Driver", (r) => <><strong>{r.driver_label}</strong><span>{r.driver_group}</span></>], ["Actual", (r) => num(r.actual_value)], ["Impact", (r) => <strong>{num(r.impact_points)} pts</strong>], ["Rank", (r) => `#${r.driver_rank ?? '—'}`], ["Explanation", (r) => r.explanation ?? '—']]} />}
      {activeTab === 'predictive' && <DataTable rows={filterRows(predictions)} empty="No predictive risk rows found." columns={[["Location", (r) => <><strong>{r.location_name ?? '—'}</strong><span>{r.trend_direction ?? 'stable'}</span></>], ["Current", (r) => `${num(r.current_risk_score)}/100`], ["Predicted", (r) => <><span className={`severity-badge ${severityClass(r.predicted_risk_level)}`}>{r.predicted_risk_level ?? '—'}</span><strong>{num(r.predicted_next_risk_score)}/100</strong></>], ["Audit forecast", (r) => pct(r.predicted_next_audit_score)], ["Delta", (r) => num(r.risk_delta)], ["Visit", (r) => r.recommended_visit_window ?? '—'], ["Reason", (r) => r.prediction_reason ?? '—']]} />}
      {activeTab === 'benchmarking' && <div className="page-stack"><DataTable rows={filterRows(locationBenchmarks)} empty="No location benchmark rows found." columns={[["Location", (r) => <><strong>{r.location_name ?? '—'}</strong><span>Risk rank #{r.risk_rank_high_to_low ?? '—'}</span></>], ["Risk", (r) => `${num(r.risk_score)}/100`], ["Company avg", (r) => `${num(r.company_avg_risk_score)}/100`], ["Vs avg", (r) => num(r.risk_vs_company_avg)], ["Percentile", (r) => pct(r.risk_percentile)], ["Health rank", (r) => `#${r.health_rank_best_to_worst ?? '—'}`]]} /><DataTable rows={filterRows(categoryBenchmarks)} empty="No category benchmark rows found." columns={[["Category", (r) => <strong>{r.risk_category ?? 'general'}</strong>], ["Rank", (r) => `#${r.category_failure_rank ?? '—'}`], ["Failed", (r) => r.total_failed_items ?? 0], ["Critical", (r) => r.total_critical_failed_items ?? 0], ["Locations", (r) => r.affected_location_count ?? 0], ["Avg score", (r) => pct(r.avg_item_score_pct)]]} /><DataTable rows={filterRows(sectionBenchmarks)} empty="No section benchmark rows found." columns={[["Section", (r) => <strong>{r.section_name ?? '—'}</strong>], ["Weak rank", (r) => `#${r.weakest_section_rank ?? '—'}`], ["Avg score", (r) => pct(r.avg_section_score_pct)], ["Min score", (r) => pct(r.min_section_score_pct)], ["Failed", (r) => r.failed_item_count ?? 0], ["Critical", (r) => r.critical_failed_item_count ?? 0], ["Locations", (r) => r.affected_location_count ?? 0]]} /></div>}
      {activeTab === 'categories' && <DataTable rows={filterRows(categories)} empty="No category analytics found." columns={[["Category", (r) => <><strong>{r.risk_category ?? 'general'}</strong><span>{r.location_name}</span></>], ["Risk", (r) => <span className={`severity-badge ${severityClass(r.category_risk_level)}`}>{r.category_risk_level ?? '—'}</span>], ["Failures", (r) => r.failed_item_count ?? 0], ["Critical", (r) => r.critical_failed_item_count ?? 0], ["Audits", (r) => r.affected_audit_count ?? 0], ["Sections", (r) => r.affected_section_count ?? 0], ["Avg item score", (r) => pct(r.avg_item_score_pct)], ["Latest", (r) => date(r.latest_failure_at)]]} />}
      {activeTab === 'sections' && <DataTable rows={filterRows(sections)} empty="No section analytics found." columns={[["Section", (r) => <><strong>{r.section_name ?? '—'}</strong><span>{r.checklist_name} · {r.location_name}</span></>], ["Risk", (r) => <span className={`severity-badge ${severityClass(r.section_risk_level)}`}>{r.section_risk_level ?? '—'}</span>], ["Avg score", (r) => pct(r.avg_section_score_pct)], ["Min score", (r) => pct(r.min_section_score_pct)], ["Failed", (r) => r.failed_item_count ?? 0], ["Critical", (r) => r.critical_failed_item_count ?? 0], ["Latest", (r) => date(r.latest_section_at)]]} />}
      {activeTab === 'failed' && <DataTable rows={filterRows(failedItems)} empty="No failed item rows found." columns={[["Failed item", (r) => <><strong>{r.item_text}</strong><span>{r.section_name} · {r.location_name}</span></>], ["Severity", (r) => <span className={`severity-badge ${severityClass(r.severity)}`}>{r.severity ?? '—'}</span>], ["Category", (r) => r.risk_category ?? 'general'], ["Score", (r) => `${num(r.score_earned)} / ${num(r.score_total)}`], ["Comment", (r) => r.comment_text ?? '—'], ["Action", (r) => r.recommended_action ?? '—'], ["Due days", (r) => r.due_in_days ?? '—']]} />}
      {activeTab === 'repeated' && <DataTable rows={filterRows(repeatedIssues)} empty="No repeated issues found." columns={[["Repeated issue", (r) => <><strong>{r.example_item_text ?? r.normalized_item_text}</strong><span>{r.location_name}</span></>], ["Level", (r) => <span className={`severity-badge ${severityClass(r.repeated_issue_level)}`}>{r.repeated_issue_level ?? '—'}</span>], ["Category", (r) => r.risk_category ?? 'general'], ["Repeat", (r) => r.repeat_count ?? 0], ["Critical repeats", (r) => r.critical_repeat_count ?? 0], ["Sections", (r) => Array.isArray(r.affected_sections) ? r.affected_sections.join(', ') : '—'], ["Latest", (r) => date(r.latest_failure_at)]]} />}
      {activeTab === 'actions' && <DataTable rows={filterRows(actions)} empty="No action plan rows found." columns={[["Action", (r) => <><strong>{r.action_title}</strong><span>{r.action_reference} · {r.location_name}</span></>], ["Priority", (r) => <span className={`severity-badge ${severityClass(r.severity)}`}>{r.severity ?? '—'}</span>], ["Category", (r) => r.risk_category ?? 'general'], ["Section", (r) => r.section_name ?? '—'], ["Recommendation", (r) => r.recommended_action ?? '—'], ["Due", (r) => date(r.suggested_due_at)], ["Evidence", (r) => r.evidence_required ? 'Required' : 'Optional']]} />}
      {activeTab === 'management' && <section className="card"><div className="section-header"><div><p className="eyebrow">Management PDF export</p><h2>Professional report output</h2></div><button className="primary-button" onClick={downloadPdf}><Download size={17} /> Download PDF</button></div><p className="muted-text">Includes executive summary, data lineage proof, predictive risk, and corrective action plan.</p><div className="mini-grid"><span><FileText size={15} /> PDF ready</span><span><Building2 size={15} /> {summary?.location_count ?? locations.length} locations</span><span><AlertTriangle size={15} /> {totalCritical} critical failures</span><span><ListChecks size={15} /> {actions.length} actions</span><span><GitCompare size={15} /> Benchmarking included</span></div></section>}
      {activeTab === 'raw' && <div className="two-column"><section className="card"><div className="section-header"><div><p className="eyebrow">Raw audit reports</p><h2>Imported audits</h2></div><Database size={20} /></div><RawAuditList rows={filterRows(rawAudits)} /></section><section className="card"><div className="section-header"><div><p className="eyebrow">Raw completion reports</p><h2>Imported completion</h2></div><Database size={20} /></div><RawCompletionList rows={filterRows(rawCompletions)} /></section></div>}
      {activeTab === 'lineage' && <div className="page-stack"><DataTable rows={filterRows(lineage)} empty="No lineage rows found. Run final safe ML v3 SQL." columns={[["Layer", (r) => <strong>{r.layer}</strong>], ["Table", (r) => r.table_name], ["Rows", (r) => r.row_count], ["Source", (r) => r.source_type], ["Generated by", (r) => r.generated_by ?? 'not generated'], ["Model", (r) => r.model_version ?? '—'], ["Run ID", (r) => r.calculation_run_id ?? '—'], ["Activity", (r) => date(r.last_activity_at)]]} /><DataTable rows={runs} empty="No generation run logs yet." columns={[["Status", (r) => <span className={`severity-badge ${r.status === 'failed' ? 'critical' : r.status === 'completed' ? 'low' : 'medium'}`}>{r.status}</span>], ["Run ID", (r) => r.calculation_run_id], ["Period", (r) => `${date(r.period_start)} → ${date(r.period_end)}`], ["Raw rows", (r) => r.raw_rows_scanned], ["Features", (r) => r.generated_feature_rows], ["Insights", (r) => r.generated_insight_rows], ["Triggered by", (r) => r.triggered_by ?? '—'], ["Started", (r) => date(r.started_at)]]} /></div>}
    </div>
  );
}

function Overview({ topLocation, topPrediction, topDriver, actions }: { topLocation?: Row; topPrediction?: Row; topDriver?: Row; actions: Row[] }) {
  return (
    <div className="two-column">
      <section className="card">
        <div className="section-header"><div><p className="eyebrow">Executive summary</p><h2>Where management should focus</h2></div><Brain size={20} /></div>
        <div className="stack-list">
          <article className="list-card"><h3>Highest current risk</h3><p>{topLocation?.location_name ?? 'No location data yet'}</p><span className={`severity-badge ${severityClass(topLocation?.risk_level ?? topLocation?.predicted_risk_level)}`}>{topLocation?.risk_level ?? topLocation?.predicted_risk_level ?? '—'} · {num(topLocation?.risk_score ?? topLocation?.calculated_risk_score)}/100</span></article>
          <article className="list-card"><h3>Highest predicted risk</h3><p>{topPrediction?.location_name ?? 'No prediction yet'}</p><span className={`severity-badge ${severityClass(topPrediction?.predicted_risk_level)}`}>{topPrediction?.predicted_risk_level ?? '—'} · {topPrediction?.recommended_visit_window ?? '—'}</span></article>
          <article className="list-card"><h3>Main ML driver</h3><p>{topDriver ? `${topDriver.driver_label}: ${topDriver.explanation}` : 'Run Advanced ML after installing SQL.'}</p><span className="muted-text">Impact: {num(topDriver?.impact_points)} points</span></article>
        </div>
      </section>
      <section className="card">
        <div className="section-header"><div><p className="eyebrow">Priority actions</p><h2>Top action plan</h2></div><ListChecks size={20} /></div>
        <div className="stack-list">{actions.slice(0, 6).map((action, index) => <article className="list-card" key={action.action_reference ?? index}><span className={`severity-badge ${severityClass(action.severity)}`}>{action.severity}</span><h3>{action.action_title}</h3><p>{action.recommended_action}</p><span className="muted-text">{action.location_name} · Due {date(action.suggested_due_at)}</span></article>)}{!actions.length && <span className="muted-text">No action plan generated yet.</span>}</div>
      </section>
    </div>
  );
}

function DataTable({ rows, columns, empty }: { rows: Row[]; columns: Array<[string, (row: Row, index: number) => ReactNode]>; empty: string }) {
  return <section className="card"><div className="table-wrap"><table><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id ?? row.audit_item_id ?? row.action_reference ?? row.calculation_run_id ?? index}>{columns.map(([label, render]) => <td key={label}>{render(row, index)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={columns.length}>{empty}</td></tr>}</tbody></table></div></section>;
}

function RawAuditList({ rows }: { rows: Row[] }) {
  return <div className="stack-list">{rows.map((row) => <article className="list-card" key={row.audit_report_id}><h3>{row.checklist_name}</h3><p>{row.location_name_text} · {pct(row.score_percentage)} · {row.instance_status}</p><span className="muted-text">{num(row.score_earned)} / {num(row.score_total)} · {row.submitted_by_name ?? '—'} · {date(row.completed_at)}</span></article>)}{!rows.length && <span className="muted-text">No raw audit rows.</span>}</div>;
}

function RawCompletionList({ rows }: { rows: Row[] }) {
  return <div className="stack-list">{rows.map((row) => <article className="list-card" key={row.completion_report_id}><h3>{row.location_name_text ?? 'Completion report'}</h3><p>{date(row.date_range_start)} → {date(row.date_range_end)}</p><span className="muted-text">Lists completed {pct(row.lists_completed_pct)} · Missed {pct(row.lists_missed_pct)} · Items completed {pct(row.items_completed_pct)} · Items missed {pct(row.items_missed_pct)}</span></article>)}{!rows.length && <span className="muted-text">No raw completion rows.</span>}</div>;
}
