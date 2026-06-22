import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Brain, Building2, Database, Download, FileText, Filter, GitCompare, ListChecks, Search, Sparkles, Target, TrendingUp, X } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { invokeAIGenerateInsights, supabase, useMockData } from '../lib/supabase';

const defaultOrg = '10000000-0000-0000-0000-000000000001';
const emptyOrg = '00000000-0000-0000-0000-000000000001';
const envOrg = import.meta.env.VITE_ORGANIZATION_ID as string | undefined;
const organizationId = !envOrg || envOrg === emptyOrg ? defaultOrg : envOrg;
const periodStart = (import.meta.env.VITE_REPORT_PERIOD_START as string | undefined) || '2026-06-01';
const periodEnd = (import.meta.env.VITE_REPORT_PERIOD_END as string | undefined) || '2026-06-22';

type Row = Record<string, any>;
type TabId = 'overview' | 'client' | 'locations' | 'explanation' | 'predictive' | 'benchmarking' | 'categories' | 'sections' | 'failed' | 'repeated' | 'actions' | 'management' | 'raw' | 'lineage';

type Filters = {
  location: string;
  checklist: string;
  severity: string;
  dateFrom: string;
  dateTo: string;
  search: string;
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'client', label: 'Client Dashboard' },
  { id: 'locations', label: 'Location Risk' },
  { id: 'explanation', label: 'AI Explanation' },
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

function rowLocation(row: Row) {
  return safe(row.location_name ?? row.location_name_text ?? row.entity_reference ?? row.company_name ?? '');
}

function rowChecklist(row: Row) {
  return safe(row.checklist_name ?? row.checklists_filter ?? row.title ?? '');
}

function rowSeverity(row: Row) {
  return safe(row.severity ?? row.risk_level ?? row.predicted_risk_level ?? row.category_risk_level ?? row.section_risk_level ?? row.repeated_issue_level ?? row.status ?? '');
}

function rowDate(row: Row) {
  return String(row.completed_at ?? row.audit_completed_at ?? row.finding_at ?? row.report_date ?? row.date_range_end ?? row.date_range_start ?? row.generated_at ?? row.created_at ?? '').slice(0, 10);
}

function matchesFilters(row: Row, filters: Filters) {
  const search = filters.search.trim().toLowerCase();
  const location = filters.location.toLowerCase();
  const checklist = filters.checklist.toLowerCase();
  const severity = filters.severity.toLowerCase();
  const rowDateValue = rowDate(row);

  if (location && rowLocation(row).toLowerCase() !== location) return false;
  if (checklist && rowChecklist(row).toLowerCase() !== checklist) return false;
  if (severity && rowSeverity(row).toLowerCase() !== severity) return false;
  if (filters.dateFrom && rowDateValue && rowDateValue < filters.dateFrom) return false;
  if (filters.dateTo && rowDateValue && rowDateValue > filters.dateTo) return false;
  if (search && !JSON.stringify(row).toLowerCase().includes(search)) return false;
  return true;
}

function uniqueOptions(rows: Row[], getter: (row: Row) => string) {
  return Array.from(new Set(rows.map(getter).filter((value) => value && value !== '—'))).sort((a, b) => a.localeCompare(b));
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
  const [filters, setFilters] = useState<Filters>({ location: '', checklist: '', severity: '', dateFrom: periodStart, dateTo: periodEnd, search: '' });
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
  const [rawCompletionChecklists, setRawCompletionChecklists] = useState<Row[]>([]);
  const [insights, setInsights] = useState<Row[]>([]);
  const [lineage, setLineage] = useState<Row[]>([]);
  const [runs, setRuns] = useState<Row[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  async function load() {
    const db = supabase;
    if (useMockData || !db) return;
    setLoading(true);
    const errors: string[] = [];
    try {
      const results = await Promise.all([
        fetchRows('v_client_company_dashboard', db.from('v_client_company_dashboard').select('*').eq('organization_id', organizationId).limit(20)),
        fetchRows('v_advanced_report_location_analytics', db.from('v_advanced_report_location_analytics').select('*').eq('organization_id', organizationId).order('risk_score', { ascending: false }).limit(200)),
        fetchRows('v_ml_explanation_driver_breakdown', db.from('v_ml_explanation_driver_breakdown').select('*').eq('organization_id', organizationId).order('impact_points', { ascending: false }).limit(500)),
        fetchRows('v_predictive_location_risk', db.from('v_predictive_location_risk').select('*').eq('organization_id', organizationId).order('predicted_next_risk_score', { ascending: false }).limit(200)),
        fetchRows('v_location_benchmarking', db.from('v_location_benchmarking').select('*').eq('organization_id', organizationId).order('risk_rank_high_to_low', { ascending: true }).limit(200)),
        fetchRows('v_category_benchmarking', db.from('v_category_benchmarking').select('*').eq('organization_id', organizationId).order('category_failure_rank', { ascending: true }).limit(200)),
        fetchRows('v_section_benchmarking', db.from('v_section_benchmarking').select('*').eq('organization_id', organizationId).order('weakest_section_rank', { ascending: true }).limit(200)),
        fetchRows('v_advanced_report_category_analytics', db.from('v_advanced_report_category_analytics').select('*').eq('organization_id', organizationId).order('failed_item_count', { ascending: false }).limit(200)),
        fetchRows('v_advanced_report_section_analytics', db.from('v_advanced_report_section_analytics').select('*').eq('organization_id', organizationId).order('avg_section_score_pct', { ascending: true }).limit(200)),
        fetchRows('v_advanced_report_failed_items', db.from('v_advanced_report_failed_items').select('*').eq('organization_id', organizationId).order('is_critical', { ascending: false }).order('completed_at', { ascending: false }).limit(500)),
        fetchRows('v_advanced_report_repeated_issues', db.from('v_advanced_report_repeated_issues').select('*').eq('organization_id', organizationId).order('repeat_count', { ascending: false }).limit(200)),
        fetchRows('v_advanced_report_action_plan', db.from('v_advanced_report_action_plan').select('*').eq('organization_id', organizationId).order('priority_rank', { ascending: true }).limit(500)),
        fetchRows('audit_reports', db.from('audit_reports').select('audit_report_id,client_name,group_modes,checklist_name,location_name_text,report_date,date_range_start,date_range_end,score_percentage,instance_status,completed_at,submitted_by_name,source_file_name').eq('organization_id', organizationId).order('completed_at', { ascending: false }).limit(200)),
        fetchRows('completion_rate_reports', db.from('completion_rate_reports').select('completion_report_id,client_name,group_modes,location_name_text,date_range_start,date_range_end,lists_completed_pct,lists_missed_pct,items_completed_pct,items_missed_pct,source_file_name').eq('organization_id', organizationId).order('date_range_end', { ascending: false }).limit(200)),
        fetchRows('completion_rate_checklists', db.from('completion_rate_checklists').select('completion_checklist_id,checklist_name,done_on_time_count,done_on_time_pct,done_late_count,done_late_pct,partially_done_count,partially_done_pct,missed_count,missed_pct,created_at').eq('organization_id', organizationId).order('missed_pct', { ascending: false }).limit(500)),
        fetchRows('ai_insights', db.from('ai_insights').select('insight_id,title,summary,recommendation,severity,confidence,status,entity_reference,generated_at').eq('organization_id', organizationId).order('generated_at', { ascending: false }).limit(100)),
        fetchRows('v_analytics_data_lineage', db.from('v_analytics_data_lineage').select('*').eq('organization_id', organizationId).order('sort_order', { ascending: true })),
        fetchRows('analytics_generation_runs', db.from('analytics_generation_runs').select('*').eq('organization_id', organizationId).order('started_at', { ascending: false }).limit(30))
      ]);

      results.forEach((result) => { if (result.error) errors.push(result.error); });
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
      setRawCompletionChecklists(results[14].data);
      setInsights(results[15].data);
      setLineage(results[16].data);
      setRuns(results[17].data);
      setWarnings(errors);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function runAiEngine() {
    const db = supabase;
    if (!db) return;
    setRunning(true);
    setMessage(null);
    try {
      try {
        await invokeAIGenerateInsights({ organization_id: organizationId, period_start: filters.dateFrom || periodStart, period_end: filters.dateTo || periodEnd, run_type: 'manual' });
        setMessage('AI engine completed through Edge Function. Refreshing dashboard...');
        await load();
        return;
      } catch {
        // Fallback to direct RPC if the Edge Function is not deployed yet.
      }
      const attempts = [
        () => db.rpc('run_ai_engine_v2', { p_organization_id: organizationId, p_period_start: filters.dateFrom || periodStart, p_period_end: filters.dateTo || periodEnd, p_triggered_by: 'frontend:AIAnalyticsPage' }),
        () => db.rpc('run_ai_analytics_engine_v1', { p_organization_id: organizationId, p_period_start: filters.dateFrom || periodStart, p_period_end: filters.dateTo || periodEnd, p_triggered_by: 'frontend:AIAnalyticsPage' }),
        () => db.rpc('run_advanced_report_ml_v3', { p_organization_id: organizationId, p_period_start: filters.dateFrom || periodStart, p_period_end: filters.dateTo || periodEnd, p_triggered_by: 'frontend:AIAnalyticsPage' })
      ];
      let lastError = '';
      for (const attempt of attempts) {
        const { data, error } = await attempt();
        if (!error) {
          const row = Array.isArray(data) && data.length ? data[0] : {};
          setMessage(`AI engine completed. Raw rows: ${row.raw_rows_scanned ?? '—'}. Refreshing dashboard...`);
          await load();
          return;
        }
        lastError = error.message;
      }
      throw new Error(lastError || 'No AI engine function succeeded.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'AI engine failed.');
    } finally {
      setRunning(false);
    }
  }

  const allRowsForFilters = [...locations, ...predictions, ...failedItems, ...actions, ...sections, ...rawAudits, ...rawCompletionChecklists];
  const locationOptions = uniqueOptions(allRowsForFilters, rowLocation);
  const checklistOptions = uniqueOptions(allRowsForFilters, rowChecklist);
  const severityOptions = uniqueOptions(allRowsForFilters, rowSeverity).filter((value) => ['critical', 'high', 'medium', 'low'].includes(value.toLowerCase()));
  const filterRows = (rows: Row[]) => rows.filter((row) => matchesFilters(row, filters));

  const filteredClientRows = filterRows(clientRows);
  const filteredLocations = filterRows(locations);
  const filteredPredictions = filterRows(predictions);
  const filteredExplanations = filterRows(explanations);
  const filteredFailedItems = filterRows(failedItems);
  const filteredActions = filterRows(actions);
  const filteredCategories = filterRows(categories);
  const filteredSections = filterRows(sections);
  const filteredRepeatedIssues = filterRows(repeatedIssues);
  const filteredLocationBenchmarks = filterRows(locationBenchmarks);
  const filteredCategoryBenchmarks = filterRows(categoryBenchmarks);
  const filteredSectionBenchmarks = filterRows(sectionBenchmarks);
  const filteredRawAudits = filterRows(rawAudits);
  const filteredRawCompletions = filterRows(rawCompletions);
  const filteredRawChecklists = filterRows(rawCompletionChecklists);

  const topLocation = filteredLocations[0] ?? locations[0];
  const topPrediction = filteredPredictions[0] ?? predictions[0];
  const topDriver = filteredExplanations[0] ?? explanations[0];
  const lastRun = runs[0];
  const avgRisk = filteredLocations.length ? filteredLocations.reduce((sum, row) => sum + Number(row.risk_score ?? row.calculated_risk_score ?? 0), 0) / filteredLocations.length : summary?.avg_risk_score;
  const avgHealth = avgRisk === undefined || avgRisk === null ? summary?.avg_health_score : 100 - Number(avgRisk);
  const totalFailed = filteredLocations.reduce((sum, row) => sum + Number(row.failed_item_count ?? 0), 0) || summary?.total_failed_items || 0;
  const totalCritical = filteredLocations.reduce((sum, row) => sum + Number(row.critical_failed_item_count ?? 0), 0) || summary?.total_critical_failures || 0;

  function updateFilter(key: keyof Filters, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetFilters() {
    setFilters({ location: '', checklist: '', severity: '', dateFrom: periodStart, dateTo: periodEnd, search: '' });
  }

  function downloadPdf() {
    const lines = [
      'InCheck360 Management Report',
      'AI Analytics Engine - Filtered Dashboard Export',
      `Organization: ${organizationId}`,
      `Period: ${filters.dateFrom || periodStart} to ${filters.dateTo || periodEnd}`,
      `Filters: location=${filters.location || 'all'} checklist=${filters.checklist || 'all'} severity=${filters.severity || 'all'}`,
      '',
      'EXECUTIVE SUMMARY',
      `Locations: ${safe(filteredLocations.length || summary?.location_count)} | Avg risk: ${num(avgRisk)}/100 | Avg health: ${num(avgHealth)}/100`,
      `Failed items: ${safe(totalFailed)} | Critical failures: ${safe(totalCritical)} | Actions: ${safe(filteredActions.length)}`,
      '',
      'PREDICTIVE RISK',
      ...filteredPredictions.slice(0, 25).map((row, index) => `${index + 1}. ${safe(row.location_name)} - current ${safe(row.current_risk_score)}/100, predicted ${safe(row.predicted_next_risk_score)}/100 (${safe(row.predicted_risk_level)})`),
      '',
      'ACTION PLAN',
      ...filteredActions.slice(0, 35).map((row, index) => `${index + 1}. [${safe(row.severity)}] ${safe(row.location_name)} - ${safe(row.action_title)}. ${safe(row.recommended_action)}`)
    ];
    const blob = makePdf(lines);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `incheck360-ai-report-${organizationId}-${filters.dateFrom || periodStart}-${filters.dateTo || periodEnd}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const showBlockingWarning = Boolean(warnings.length && !locations.length && !rawAudits.length && !rawCompletions.length);

  return (
    <div className="page-stack">
      <section className="hero-card ai-hero">
        <div>
          <p className="eyebrow">AI analytics engine</p>
          <h2>Predictive risk, abnormal patterns, recommendations, and explanations.</h2>
          <p>Imported report data is analyzed by the AI engine. Use filters to focus by location, checklist, severity, date range, or keyword.</p>
        </div>
        <button className="primary-button" onClick={runAiEngine} disabled={running}><Sparkles size={17} /> {running ? 'Running AI...' : 'Run AI Engine'}</button>
      </section>

      {message && <section className="notice-card">{message}</section>}
      {loading && <section className="notice-card">Loading analytics...</section>}
      {showBlockingWarning && <section className="notice-card">Analytics views are not ready yet. First warning: {warnings[0]}</section>}

      <section className="metric-grid three">
        <MetricCard title="Average risk" value={avgRisk === null || avgRisk === undefined ? '—' : `${num(avgRisk)}/100`} hint="Filtered AI risk" icon={<Brain />} tone="warning" />
        <MetricCard title="Average health" value={avgHealth === null || avgHealth === undefined ? '—' : `${num(avgHealth)}/100`} hint="100 - risk" icon={<Target />} tone="success" />
        <MetricCard title="Critical failures" value={totalCritical} hint={`${safe(totalFailed)} total failed items`} icon={<AlertTriangle />} tone="danger" />
      </section>
      <section className="metric-grid three">
        <MetricCard title="Top risk location" value={topLocation?.location_name ?? topLocation?.location_name_text ?? '—'} hint={`${num(topLocation?.risk_score ?? topLocation?.calculated_risk_score)}/100 risk`} icon={<Building2 />} tone="danger" />
        <MetricCard title="Predicted top risk" value={topPrediction?.location_name ?? '—'} hint={`${num(topPrediction?.predicted_next_risk_score)}/100 predicted`} icon={<TrendingUp />} tone="warning" />
        <MetricCard title="Last AI run" value={lastRun?.status ?? '—'} hint={lastRun?.calculation_run_id ?? 'No run'} icon={<Database />} tone="success" />
      </section>

      <section className="toolbar-card">
        <div className="section-header"><div><p className="eyebrow">Filters</p><h2>Filter analytics data</h2></div><Filter size={20} /></div>
        <div className="filters-grid">
          <label>Location<select value={filters.location} onChange={(event) => updateFilter('location', event.target.value)}><option value="">All locations</option>{locationOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Checklist<select value={filters.checklist} onChange={(event) => updateFilter('checklist', event.target.value)}><option value="">All checklists</option>{checklistOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Severity<select value={filters.severity} onChange={(event) => updateFilter('severity', event.target.value)}><option value="">All severities</option>{severityOptions.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>From<input type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} /></label>
          <label>To<input type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} /></label>
          <label>Search<div className="search-box"><Search size={18} /><input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search all details..." /></div></label>
        </div>
        <div className="row gap-sm wrap"><button className="secondary-button" onClick={resetFilters}><X size={16} /> Reset filters</button><button className="secondary-button" onClick={downloadPdf}><Download size={16} /> Export filtered PDF</button></div>
      </section>

      <section className="toolbar-card"><div className="row gap-sm wrap">{tabs.map((tab) => <button key={tab.id} className={`filter-button ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div></section>

      {activeTab === 'overview' && <Overview topLocation={topLocation} topPrediction={topPrediction} topDriver={topDriver} actions={filteredActions} insights={filterRows(insights)} />}
      {activeTab === 'client' && <DataTable rows={filteredClientRows} empty="No client dashboard rows found." columns={[["Company", (r) => <><strong>{r.company_name ?? r.organization_id}</strong><span>{r.organization_id}</span></>], ["Reports", (r) => `${r.audit_report_count ?? 0} audits / ${r.completion_report_count ?? 0} completion`], ["Avg risk", (r) => `${num(r.avg_risk_score)}/100`], ["Avg health", (r) => `${num(r.avg_health_score)}/100`], ["Risk locations", (r) => `${r.critical_location_count ?? 0} critical / ${r.high_risk_location_count ?? 0} high`], ["Failures", (r) => `${r.total_failed_items ?? 0} failed / ${r.total_critical_failures ?? 0} critical`], ["Top category", (r) => r.top_risk_category ?? '—'], ["Actions", (r) => r.open_action_count ?? '—']]} />}
      {activeTab === 'locations' && <DataTable rows={filteredLocations} empty="No location AI rows found." columns={[["Location", (r) => <><strong>{r.location_name ?? '—'}</strong><span>{r.audit_report_count ?? 0} audit / {r.completion_report_count ?? 0} completion</span></>], ["Risk", (r) => <><span className={`severity-badge ${severityClass(r.risk_level ?? r.predicted_risk_level)}`}>{r.risk_level ?? r.predicted_risk_level ?? '—'}</span><strong>{num(r.risk_score ?? r.calculated_risk_score)}/100</strong></>], ["Health", (r) => `${num(r.health_score)}/100`], ["Audit", (r) => pct(r.avg_audit_score_pct ?? r.avg_audit_score_percentage)], ["Failed", (r) => `${r.failed_item_count ?? 0} (${r.critical_failed_item_count ?? 0} critical)`], ["Missed", (r) => `Lists ${pct(r.avg_lists_missed_pct)} / Items ${pct(r.avg_items_missed_pct)}`], ["Confidence", (r) => pct(Number(r.confidence ?? 0) * 100)]]} />}
      {activeTab === 'explanation' && <DataTable rows={filteredExplanations} empty="No AI explanations found." columns={[["Location", (r) => <><strong>{r.location_name ?? '—'}</strong><span>Risk {num(r.risk_score)}/100</span></>], ["Driver", (r) => <><strong>{r.driver_label}</strong><span>{r.driver_group}</span></>], ["Actual", (r) => num(r.actual_value)], ["Impact", (r) => <strong>{num(r.impact_points)} pts</strong>], ["Rank", (r) => `#${r.driver_rank ?? '—'}`], ["Explanation", (r) => r.explanation ?? '—']]} />}
      {activeTab === 'predictive' && <DataTable rows={filteredPredictions} empty="No predictive risk rows found." columns={[["Location", (r) => <><strong>{r.location_name ?? '—'}</strong><span>{r.trend_direction ?? 'stable'}</span></>], ["Current", (r) => `${num(r.current_risk_score)}/100`], ["Predicted", (r) => <><span className={`severity-badge ${severityClass(r.predicted_risk_level)}`}>{r.predicted_risk_level ?? '—'}</span><strong>{num(r.predicted_next_risk_score)}/100</strong></>], ["Audit forecast", (r) => pct(r.predicted_next_audit_score)], ["Delta", (r) => num(r.risk_delta)], ["Visit", (r) => r.recommended_visit_window ?? '—'], ["Reason", (r) => r.prediction_reason ?? '—']]} />}
      {activeTab === 'benchmarking' && <div className="page-stack"><DataTable rows={filteredLocationBenchmarks} empty="No location benchmark rows found." columns={[["Location", (r) => <><strong>{r.location_name ?? '—'}</strong><span>Risk rank #{r.risk_rank_high_to_low ?? '—'}</span></>], ["Risk", (r) => `${num(r.risk_score)}/100`], ["Company avg", (r) => `${num(r.company_avg_risk_score)}/100`], ["Vs avg", (r) => num(r.risk_vs_company_avg)], ["Percentile", (r) => pct(r.risk_percentile)], ["Health rank", (r) => `#${r.health_rank_best_to_worst ?? '—'}`]]} /><DataTable rows={filteredCategoryBenchmarks} empty="No category benchmark rows found." columns={[["Category", (r) => <strong>{r.risk_category ?? 'general'}</strong>], ["Rank", (r) => `#${r.category_failure_rank ?? '—'}`], ["Failed", (r) => r.total_failed_items ?? 0], ["Critical", (r) => r.total_critical_failed_items ?? 0], ["Locations", (r) => r.affected_location_count ?? 0], ["Avg score", (r) => pct(r.avg_item_score_pct)]]} /><DataTable rows={filteredSectionBenchmarks} empty="No section benchmark rows found." columns={[["Section", (r) => <strong>{r.section_name ?? '—'}</strong>], ["Weak rank", (r) => `#${r.weakest_section_rank ?? '—'}`], ["Avg score", (r) => pct(r.avg_section_score_pct)], ["Min score", (r) => pct(r.min_section_score_pct)], ["Failed", (r) => r.failed_item_count ?? 0], ["Critical", (r) => r.critical_failed_item_count ?? 0], ["Locations", (r) => r.affected_location_count ?? 0]]} /></div>}
      {activeTab === 'categories' && <DataTable rows={filteredCategories} empty="No category analytics found." columns={[["Category", (r) => <><strong>{r.risk_category ?? 'general'}</strong><span>{r.location_name}</span></>], ["Risk", (r) => <span className={`severity-badge ${severityClass(r.category_risk_level)}`}>{r.category_risk_level ?? '—'}</span>], ["Failures", (r) => r.failed_item_count ?? 0], ["Critical", (r) => r.critical_failed_item_count ?? 0], ["Audits", (r) => r.affected_audit_count ?? 0], ["Sections", (r) => r.affected_section_count ?? 0], ["Avg item score", (r) => pct(r.avg_item_score_pct)], ["Latest", (r) => date(r.latest_failure_at)]]} />}
      {activeTab === 'sections' && <DataTable rows={filteredSections} empty="No section analytics found." columns={[["Section", (r) => <><strong>{r.section_name ?? '—'}</strong><span>{r.checklist_name} · {r.location_name}</span></>], ["Risk", (r) => <span className={`severity-badge ${severityClass(r.section_risk_level)}`}>{r.section_risk_level ?? '—'}</span>], ["Avg score", (r) => pct(r.avg_section_score_pct)], ["Min score", (r) => pct(r.min_section_score_pct)], ["Failed", (r) => r.failed_item_count ?? 0], ["Critical", (r) => r.critical_failed_item_count ?? 0], ["Latest", (r) => date(r.latest_section_at)]]} />}
      {activeTab === 'failed' && <DataTable rows={filteredFailedItems} empty="No failed item rows found." columns={[["Failed item", (r) => <><strong>{r.item_text}</strong><span>{r.section_name} · {r.location_name}</span></>], ["Checklist", (r) => r.checklist_name ?? '—'], ["Severity", (r) => <span className={`severity-badge ${severityClass(r.severity)}`}>{r.severity ?? '—'}</span>], ["Category", (r) => r.risk_category ?? 'general'], ["Result", (r) => r.result_value ?? '—'], ["Comment", (r) => r.comment_text ?? '—'], ["Action", (r) => r.recommended_action ?? '—']]} />}
      {activeTab === 'repeated' && <DataTable rows={filteredRepeatedIssues} empty="No repeated issues found." columns={[["Repeated issue", (r) => <><strong>{r.example_item_text ?? r.normalized_item_text}</strong><span>{r.location_name}</span></>], ["Level", (r) => <span className={`severity-badge ${severityClass(r.repeated_issue_level)}`}>{r.repeated_issue_level ?? '—'}</span>], ["Category", (r) => r.risk_category ?? 'general'], ["Repeat", (r) => r.repeat_count ?? 0], ["Critical repeats", (r) => r.critical_repeat_count ?? 0], ["Sections", (r) => Array.isArray(r.affected_sections) ? r.affected_sections.join(', ') : '—'], ["Latest", (r) => date(r.latest_failure_at)]]} />}
      {activeTab === 'actions' && <DataTable rows={filteredActions} empty="No action plan rows found." columns={[["Action", (r) => <><strong>{r.action_title}</strong><span>{r.action_reference} · {r.location_name}</span></>], ["Checklist", (r) => r.checklist_name ?? '—'], ["Priority", (r) => <span className={`severity-badge ${severityClass(r.severity)}`}>{r.severity ?? '—'}</span>], ["Category", (r) => r.risk_category ?? 'general'], ["Section", (r) => r.section_name ?? '—'], ["Recommendation", (r) => r.recommended_action ?? '—'], ["Due", (r) => date(r.suggested_due_at)]]} />}
      {activeTab === 'management' && <section className="card"><div className="section-header"><div><p className="eyebrow">Management PDF export</p><h2>Filtered professional report output</h2></div><button className="primary-button" onClick={downloadPdf}><Download size={17} /> Download PDF</button></div><p className="muted-text">Includes filtered executive summary, predictive risk, and corrective action plan.</p><div className="mini-grid"><span><FileText size={15} /> PDF ready</span><span><Building2 size={15} /> {filteredLocations.length || summary?.location_count || 0} locations</span><span><AlertTriangle size={15} /> {totalCritical} critical failures</span><span><ListChecks size={15} /> {filteredActions.length} actions</span><span><GitCompare size={15} /> Benchmarking included</span></div></section>}
      {activeTab === 'raw' && <div className="page-stack"><DataTable rows={filteredRawAudits} empty="No raw audit rows." columns={[["Report", (r) => <><strong>{r.checklist_name}</strong><span>{r.source_file_name}</span></>], ["Location", (r) => r.location_name_text], ["Client", (r) => r.client_name], ["Date", (r) => date(r.completed_at ?? r.report_date)], ["Status", (r) => r.instance_status], ["Score", (r) => pct(r.score_percentage)], ["Submitted by", (r) => r.submitted_by_name ?? '—']]} /><DataTable rows={filteredRawCompletions} empty="No raw completion reports." columns={[["Completion report", (r) => <><strong>{r.location_name_text}</strong><span>{r.source_file_name}</span></>], ["Client", (r) => r.client_name], ["Period", (r) => `${date(r.date_range_start)} → ${date(r.date_range_end)}`], ["Lists completed", (r) => pct(r.lists_completed_pct)], ["Lists missed", (r) => pct(r.lists_missed_pct)], ["Items completed", (r) => pct(r.items_completed_pct)], ["Items missed", (r) => pct(r.items_missed_pct)]]} /><DataTable rows={filteredRawChecklists} empty="No raw completion checklist rows." columns={[["Checklist", (r) => <strong>{r.checklist_name}</strong>], ["Done on time", (r) => `${r.done_on_time_count} (${pct(r.done_on_time_pct)})`], ["Done late", (r) => `${r.done_late_count} (${pct(r.done_late_pct)})`], ["Partially", (r) => `${r.partially_done_count} (${pct(r.partially_done_pct)})`], ["Missed", (r) => `${r.missed_count} (${pct(r.missed_pct)})`]]} /></div>}
      {activeTab === 'lineage' && <div className="page-stack"><DataTable rows={filterRows(lineage)} empty="No lineage rows found." columns={[["Layer", (r) => <strong>{r.layer}</strong>], ["Table", (r) => r.table_name], ["Rows", (r) => r.row_count], ["Source", (r) => r.source_type], ["Generated by", (r) => r.generated_by ?? 'not generated'], ["Model", (r) => r.model_version ?? '—'], ["Run ID", (r) => r.calculation_run_id ?? '—'], ["Activity", (r) => date(r.last_activity_at)]]} /><DataTable rows={runs} empty="No generation run logs yet." columns={[["Status", (r) => <span className={`severity-badge ${r.status === 'failed' ? 'critical' : r.status === 'completed' ? 'low' : 'medium'}`}>{r.status}</span>], ["Run ID", (r) => r.calculation_run_id], ["Period", (r) => `${date(r.period_start)} → ${date(r.period_end)}`], ["Raw rows", (r) => r.raw_rows_scanned], ["Features", (r) => r.generated_feature_rows], ["Insights", (r) => r.generated_insight_rows], ["Triggered by", (r) => r.triggered_by ?? '—'], ["Started", (r) => date(r.started_at)]]} /></div>}
    </div>
  );
}

function Overview({ topLocation, topPrediction, topDriver, actions, insights }: { topLocation?: Row; topPrediction?: Row; topDriver?: Row; actions: Row[]; insights: Row[] }) {
  return (
    <div className="two-column">
      <section className="card"><div className="section-header"><div><p className="eyebrow">Executive summary</p><h2>Where management should focus</h2></div><Brain size={20} /></div><div className="stack-list"><article className="list-card"><h3>Highest current risk</h3><p>{topLocation?.location_name ?? 'No location data yet'}</p><span className={`severity-badge ${severityClass(topLocation?.risk_level ?? topLocation?.predicted_risk_level)}`}>{topLocation?.risk_level ?? topLocation?.predicted_risk_level ?? '—'} · {num(topLocation?.risk_score ?? topLocation?.calculated_risk_score)}/100</span></article><article className="list-card"><h3>Highest predicted risk</h3><p>{topPrediction?.location_name ?? 'No prediction yet'}</p><span className={`severity-badge ${severityClass(topPrediction?.predicted_risk_level)}`}>{topPrediction?.predicted_risk_level ?? '—'} · {topPrediction?.recommended_visit_window ?? '—'}</span></article><article className="list-card"><h3>Main AI driver</h3><p>{topDriver ? `${topDriver.driver_label}: ${topDriver.explanation}` : 'No AI driver found yet.'}</p><span className="muted-text">Impact: {num(topDriver?.impact_points)} points</span></article>{insights.slice(0, 2).map((insight) => <article className="list-card" key={insight.insight_id}><h3>{insight.title}</h3><p>{insight.summary}</p><span className={`severity-badge ${severityClass(insight.severity)}`}>{insight.severity}</span></article>)}</div></section>
      <section className="card"><div className="section-header"><div><p className="eyebrow">Priority actions</p><h2>Top action plan</h2></div><ListChecks size={20} /></div><div className="stack-list">{actions.slice(0, 8).map((action, index) => <article className="list-card" key={action.action_reference ?? index}><span className={`severity-badge ${severityClass(action.severity)}`}>{action.severity}</span><h3>{action.action_title}</h3><p>{action.recommended_action}</p><span className="muted-text">{action.location_name} · {action.checklist_name ?? 'No checklist'} · Due {date(action.suggested_due_at)}</span></article>)}{!actions.length && <span className="muted-text">No action plan generated yet.</span>}</div></section>
    </div>
  );
}

function DataTable({ rows, columns, empty }: { rows: Row[]; columns: Array<[string, (row: Row, index: number) => ReactNode]>; empty: string }) {
  return <section className="card"><div className="table-wrap"><table><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id ?? row.audit_item_id ?? row.action_reference ?? row.calculation_run_id ?? row.audit_report_id ?? row.completion_report_id ?? row.completion_checklist_id ?? index}>{columns.map(([label, render]) => <td key={label}>{render(row, index)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={columns.length}>{empty}</td></tr>}</tbody></table></div></section>;
}
