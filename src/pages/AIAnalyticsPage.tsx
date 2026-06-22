import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, BarChart3, Building2, ClipboardCheck, Download, FileText, Filter, ListChecks, RefreshCw, Search, X } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { supabase, useMockData } from '../lib/supabase';

const defaultOrg = '10000000-0000-0000-0000-000000000001';
const emptyOrg = '00000000-0000-0000-0000-000000000001';
const envOrg = import.meta.env.VITE_ORGANIZATION_ID as string | undefined;
const organizationId = !envOrg || envOrg === emptyOrg ? defaultOrg : envOrg;
const periodStart = (import.meta.env.VITE_REPORT_PERIOD_START as string | undefined) || '2026-06-01';
const periodEnd = (import.meta.env.VITE_REPORT_PERIOD_END as string | undefined) || '2026-06-22';

type Row = Record<string, any>;
type TabId = 'dashboard' | 'locations' | 'passfail' | 'failed' | 'sections' | 'planned' | 'urgent' | 'pdf' | 'raw';
type Filters = { location: string; checklist: string; result: string; dateFrom: string; dateTo: string; search: string };

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'locations', label: 'Score by Location' },
  { id: 'passfail', label: 'Pass vs Fail' },
  { id: 'failed', label: 'Top Failed Items' },
  { id: 'sections', label: 'Section Failure Rate' },
  { id: 'planned', label: 'Completed vs Planned' },
  { id: 'urgent', label: 'Urgent Findings' },
  { id: 'pdf', label: 'PDF Report Data' },
  { id: 'raw', label: 'Raw Reports' }
];

function clean(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}
function num(value: unknown) { return value === null || value === undefined || Number.isNaN(Number(value)) ? '—' : Number(value).toFixed(2).replace(/\.00$/, ''); }
function pct(value: unknown) { return value === null || value === undefined || Number.isNaN(Number(value)) ? '—' : `${Number(value).toFixed(2)}%`; }
function day(value: unknown) { return value ? String(value).slice(0, 10) : '—'; }
function badge(value: unknown) {
  const v = String(value ?? '').toLowerCase();
  if (['critical', 'fail', 'failed'].includes(v)) return 'critical';
  if (['high'].includes(v)) return 'high';
  if (['medium'].includes(v)) return 'medium';
  return 'low';
}
function rowLocation(row: Row) { return clean(row.location_name ?? row.location_name_text ?? ''); }
function rowChecklist(row: Row) { return clean(row.checklist_name ?? ''); }
function rowResult(row: Row) { return clean(row.final_result ?? row.section_risk_level ?? row.severity ?? ''); }
function rowDate(row: Row) { return String(row.completed_at ?? row.audit_completed_at ?? row.latest_audit_at ?? row.latest_failure_at ?? row.audit_date ?? row.report_date ?? row.date_range_end ?? '').slice(0, 10); }

function matches(row: Row, filters: Filters) {
  const dateValue = rowDate(row);
  if (filters.location && rowLocation(row).toLowerCase() !== filters.location.toLowerCase()) return false;
  if (filters.checklist && rowChecklist(row).toLowerCase() !== filters.checklist.toLowerCase()) return false;
  if (filters.result && rowResult(row).toLowerCase() !== filters.result.toLowerCase()) return false;
  if (filters.dateFrom && dateValue && dateValue < filters.dateFrom) return false;
  if (filters.dateTo && dateValue && dateValue > filters.dateTo) return false;
  if (filters.search && !JSON.stringify(row).toLowerCase().includes(filters.search.toLowerCase())) return false;
  return true;
}
function unique(rows: Row[], getter: (row: Row) => string) { return Array.from(new Set(rows.map(getter).filter((v) => v && v !== '—'))).sort(); }

async function fetchRows(name: string, query: any): Promise<{ data: Row[]; error?: string }> {
  const result = await query;
  if (result.error) return { data: [], error: `${name}: ${result.error.message}` };
  return { data: result.data ?? [] };
}

function makePdf(lines: string[]) {
  const esc = (text: string) => clean(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  const objects: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
  pages.forEach((page, i) => {
    const body = ['BT', '/F1 10 Tf', '14 TL', '48 790 Td', ...page.flatMap((line, index) => [index === 0 && i === 0 ? '/F1 18 Tf' : '/F1 10 Tf', `(${esc(line)}) Tj`, 'T*']), 'ET'].join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objects.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
  });
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function AIAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [filters, setFilters] = useState<Filters>({ location: '', checklist: '', result: '', dateFrom: periodStart, dateTo: periodEnd, search: '' });
  const [summary, setSummary] = useState<Row | null>(null);
  const [locationScores, setLocationScores] = useState<Row[]>([]);
  const [passFail, setPassFail] = useState<Row[]>([]);
  const [failedItems, setFailedItems] = useState<Row[]>([]);
  const [sectionRates, setSectionRates] = useState<Row[]>([]);
  const [completedVsPlanned, setCompletedVsPlanned] = useState<Row[]>([]);
  const [urgentFindings, setUrgentFindings] = useState<Row[]>([]);
  const [pdfRows, setPdfRows] = useState<Row[]>([]);
  const [rawAudits, setRawAudits] = useState<Row[]>([]);
  const [rawCompletions, setRawCompletions] = useState<Row[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    const db = supabase;
    if (useMockData || !db) return;
    setLoading(true);
    try {
      const results = await Promise.all([
        fetchRows('v_audit_dashboard_summary', db.from('v_audit_dashboard_summary').select('*').eq('organization_id', organizationId).limit(1)),
        fetchRows('v_audit_dashboard_score_by_location', db.from('v_audit_dashboard_score_by_location').select('*').eq('organization_id', organizationId).order('average_audit_score', { ascending: true }).limit(200)),
        fetchRows('v_audit_dashboard_pass_fail_rate', db.from('v_audit_dashboard_pass_fail_rate').select('*').eq('organization_id', organizationId).order('audit_date', { ascending: false }).limit(200)),
        fetchRows('v_audit_dashboard_top_failed_items', db.from('v_audit_dashboard_top_failed_items').select('*').eq('organization_id', organizationId).order('failure_count', { ascending: false }).limit(300)),
        fetchRows('v_audit_dashboard_failure_rate_by_section', db.from('v_audit_dashboard_failure_rate_by_section').select('*').eq('organization_id', organizationId).order('critical_failed_item_count', { ascending: false }).limit(300)),
        fetchRows('v_audit_dashboard_completed_vs_planned', db.from('v_audit_dashboard_completed_vs_planned').select('*').eq('organization_id', organizationId).order('missed_count', { ascending: false }).limit(300)),
        fetchRows('v_audit_pdf_urgent_findings', db.from('v_audit_pdf_urgent_findings').select('*').eq('organization_id', organizationId).order('completed_at', { ascending: false }).limit(300)),
        fetchRows('v_audit_pdf_report_data', db.from('v_audit_pdf_report_data').select('*').eq('organization_id', organizationId).order('completed_at', { ascending: false }).limit(100)),
        fetchRows('audit_reports', db.from('audit_reports').select('audit_report_id,client_name,group_modes,checklist_name,location_name_text,report_date,score_percentage,instance_status,completed_at,submitted_by_name,source_file_name').eq('organization_id', organizationId).order('completed_at', { ascending: false }).limit(200)),
        fetchRows('completion_rate_reports', db.from('completion_rate_reports').select('completion_report_id,client_name,group_modes,location_name_text,date_range_start,date_range_end,lists_completed_pct,lists_missed_pct,items_completed_pct,items_missed_pct,source_file_name').eq('organization_id', organizationId).order('date_range_end', { ascending: false }).limit(200))
      ]);
      setWarnings(results.flatMap((r) => r.error ? [r.error] : []));
      setSummary(results[0].data[0] ?? null);
      setLocationScores(results[1].data);
      setPassFail(results[2].data);
      setFailedItems(results[3].data);
      setSectionRates(results[4].data);
      setCompletedVsPlanned(results[5].data);
      setUrgentFindings(results[6].data);
      setPdfRows(results[7].data);
      setRawAudits(results[8].data);
      setRawCompletions(results[9].data);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load Audit Advanced Report dashboard.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const allRows = [...locationScores, ...passFail, ...failedItems, ...sectionRates, ...completedVsPlanned, ...urgentFindings, ...pdfRows, ...rawAudits, ...rawCompletions];
  const options = {
    locations: unique(allRows, rowLocation),
    checklists: unique(allRows, rowChecklist),
    results: unique(allRows, rowResult).filter((v) => ['Pass', 'Fail', 'critical', 'high', 'medium', 'low'].includes(v))
  };
  const filterRows = (rows: Row[]) => rows.filter((row) => matches(row, filters));
  const filtered = {
    locations: filterRows(locationScores),
    passFail: filterRows(passFail),
    failedItems: filterRows(failedItems),
    sectionRates: filterRows(sectionRates),
    completedVsPlanned: filterRows(completedVsPlanned),
    urgentFindings: filterRows(urgentFindings),
    pdfRows: filterRows(pdfRows),
    rawAudits: filterRows(rawAudits),
    rawCompletions: filterRows(rawCompletions)
  };

  const averageScore = summary?.average_audit_score ?? (filtered.locations.length ? filtered.locations.reduce((sum, row) => sum + Number(row.average_audit_score ?? 0), 0) / filtered.locations.length : null);
  const failCount = summary?.fail_count ?? filtered.pdfRows.filter((row) => row.final_result === 'Fail').length;
  const urgentCount = filtered.urgentFindings.length || summary?.critical_failed_item_count || 0;
  const weakestLocation = filtered.locations[0];
  const topFailed = filtered.failedItems[0];

  const reportLines = useMemo(() => [
    'InCheck360 Audit Advanced Report',
    `Period: ${filters.dateFrom || periodStart} to ${filters.dateTo || periodEnd}`,
    `Filters: Location=${filters.location || 'All'} | Checklist=${filters.checklist || 'All'} | Result=${filters.result || 'All'}`,
    '',
    'SUMMARY',
    `Audit count: ${clean(summary?.audit_count ?? filtered.pdfRows.length)}`,
    `Average audit score: ${num(averageScore)}%`,
    `Pass rate: ${pct(summary?.pass_rate_pct)} | Fail rate: ${pct(summary?.fail_rate_pct)}`,
    `Failed items: ${clean(summary?.failed_item_count ?? filtered.failedItems.length)} | Urgent findings: ${urgentCount}`,
    '',
    'URGENT FINDINGS',
    ...filtered.urgentFindings.slice(0, 25).map((row, index) => `${index + 1}. [${clean(row.severity)}] ${clean(row.location_name)} / ${clean(row.checklist_name)} / ${clean(row.section_name)} - ${clean(row.item_text)}. Action: ${clean(row.recommended_action)}`),
    '',
    'TOP FAILED ITEMS',
    ...filtered.failedItems.slice(0, 25).map((row, index) => `${index + 1}. ${clean(row.item_text)} - ${clean(row.failure_count)} failures (${clean(row.section_name)})`)
  ], [filters, summary, filtered.pdfRows.length, filtered.failedItems, filtered.urgentFindings, averageScore, urgentCount]);

  function updateFilter(key: keyof Filters, value: string) { setFilters((current) => ({ ...current, [key]: value })); }
  function resetFilters() { setFilters({ location: '', checklist: '', result: '', dateFrom: periodStart, dateTo: periodEnd, search: '' }); }
  function exportPdf() {
    const blob = makePdf(reportLines);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit-advanced-report-${filters.dateFrom}-${filters.dateTo}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Audit Advanced Report</p>
          <h2>Dashboard and pen-and-paper style audit report output.</h2>
          <p>Configuration is managed in InCheck. This page only reads completed auditing checklists and shows the dashboard, report data, urgent findings, and PDF export.</p>
        </div>
        <button className="primary-button" onClick={exportPdf}><Download size={17} /> Export Audit PDF</button>
      </section>

      {message && <section className="notice-card">{message}</section>}
      {loading && <section className="notice-card">Loading Audit Advanced Report dashboard...</section>}
      {!!warnings.length && !summary && <section className="notice-card">Run the Audit Advanced Report dashboard SQL first. First warning: {warnings[0]}</section>}

      <section className="metric-grid three">
        <MetricCard title="Audit count" value={summary?.audit_count ?? filtered.pdfRows.length} hint={`${summary?.location_count ?? options.locations.length} locations`} icon={<ClipboardCheck />} tone="success" />
        <MetricCard title="Average audit score" value={averageScore === null || averageScore === undefined ? '—' : `${num(averageScore)}%`} hint="Final score from audit report data" icon={<BarChart3 />} tone="warning" />
        <MetricCard title="Urgent findings" value={urgentCount} hint={`${summary?.failed_item_count ?? filtered.failedItems.length} total failed items`} icon={<AlertTriangle />} tone="danger" />
      </section>
      <section className="metric-grid three">
        <MetricCard title="Fail count" value={failCount ?? 0} hint={`Fail rate ${pct(summary?.fail_rate_pct)}`} icon={<FileText />} tone="danger" />
        <MetricCard title="Weakest location" value={weakestLocation?.location_name ?? '—'} hint={`Avg score ${pct(weakestLocation?.average_audit_score)}`} icon={<Building2 />} tone="warning" />
        <MetricCard title="Top failed item" value={topFailed?.item_text ?? '—'} hint={`${topFailed?.failure_count ?? 0} failures`} icon={<ListChecks />} tone="danger" />
      </section>

      <section className="toolbar-card audit-filter-card">
        <div className="section-header"><div><p className="eyebrow">Dashboard filters</p><h2>Filter audit report data</h2></div><Filter size={20} /></div>
        <div className="filters-grid">
          <label>Location<select value={filters.location} onChange={(e) => updateFilter('location', e.target.value)}><option value="">All locations</option>{options.locations.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Checklist<select value={filters.checklist} onChange={(e) => updateFilter('checklist', e.target.value)}><option value="">All checklists</option>{options.checklists.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>Result / Risk<select value={filters.result} onChange={(e) => updateFilter('result', e.target.value)}><option value="">All</option>{options.results.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label>From<input type="date" value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} /></label>
          <label>To<input type="date" value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} /></label>
          <label>Search<div className="search-box"><Search size={18} /><input value={filters.search} onChange={(e) => updateFilter('search', e.target.value)} placeholder="Search audit report..." /></div></label>
        </div>
        <div className="row gap-sm wrap"><button className="secondary-button" onClick={resetFilters}><X size={16} /> Reset filters</button><button className="secondary-button" onClick={load}><RefreshCw size={16} /> Refresh</button><button className="secondary-button" onClick={exportPdf}><Download size={16} /> Export PDF</button></div>
      </section>

      <section className="toolbar-card"><div className="row gap-sm wrap">{tabs.map((tab) => <button key={tab.id} className={`filter-button ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div></section>

      {activeTab === 'dashboard' && <DashboardCards weakestLocation={weakestLocation} topFailed={topFailed} urgentFindings={filtered.urgentFindings} />}
      {activeTab === 'locations' && <DataTable rows={filtered.locations} empty="No score by location rows." columns={[["Location", (r) => <><strong>{r.location_name}</strong><span>{r.audit_count} audits</span></>], ["Average score", (r) => pct(r.average_audit_score)], ["Lowest score", (r) => pct(r.lowest_audit_score)], ["Pass", (r) => r.pass_count], ["Fail", (r) => r.fail_count], ["Fail rate", (r) => pct(r.fail_rate_pct)], ["Critical", (r) => r.critical_failed_item_count]]} />}
      {activeTab === 'passfail' && <DataTable rows={filtered.passFail} empty="No pass/fail trend rows." columns={[["Date", (r) => day(r.audit_date)], ["Checklist", (r) => r.checklist_name], ["Audits", (r) => r.audit_count], ["Pass", (r) => r.pass_count], ["Fail", (r) => r.fail_count], ["Pass rate", (r) => pct(r.pass_rate_pct)], ["Fail rate", (r) => pct(r.fail_rate_pct)]]} />}
      {activeTab === 'failed' && <DataTable rows={filtered.failedItems} empty="No failed audit items." columns={[["Failed item", (r) => <><strong>{r.item_text}</strong><span>{r.section_name} · {r.location_name}</span></>], ["Checklist", (r) => r.checklist_name], ["Severity", (r) => <span className={`severity-badge ${badge(r.severity)}`}>{r.severity}</span>], ["Category", (r) => r.risk_category], ["Failures", (r) => r.failure_count], ["Affected audits", (r) => r.affected_audit_count], ["Action", (r) => r.recommended_action]]} />}
      {activeTab === 'sections' && <DataTable rows={filtered.sectionRates} empty="No section failure rows." columns={[["Section", (r) => <><strong>{r.section_name}</strong><span>{r.checklist_name} · {r.location_name}</span></>], ["Risk", (r) => <span className={`severity-badge ${badge(r.section_risk_level)}`}>{r.section_risk_level}</span>], ["Avg score", (r) => pct(r.average_section_score)], ["Failed", (r) => r.failed_item_count], ["Critical", (r) => r.critical_failed_item_count]]} />}
      {activeTab === 'planned' && <DataTable rows={filtered.completedVsPlanned} empty="No completed vs planned rows." columns={[["Checklist", (r) => <strong>{r.checklist_name}</strong>], ["Completed", (r) => r.completed_count], ["Planned", (r) => r.planned_count], ["Missed", (r) => r.missed_count], ["Completion rate", (r) => pct(r.completion_rate_pct)]]} />}
      {activeTab === 'urgent' && <DataTable rows={filtered.urgentFindings} empty="No urgent findings." columns={[["Urgent finding", (r) => <><strong>{r.item_text}</strong><span>{r.section_name} · {r.location_name}</span></>], ["Checklist", (r) => r.checklist_name], ["Severity", (r) => <span className={`severity-badge ${badge(r.severity)}`}>{r.severity}</span>], ["Result", (r) => r.result_value], ["Comment", (r) => r.comment_text], ["Action", (r) => r.recommended_action]]} />}
      {activeTab === 'pdf' && <DataTable rows={filtered.pdfRows} empty="No PDF report data." columns={[["Audit", (r) => <><strong>{r.checklist_name}</strong><span>{r.location_name}</span></>], ["Auditor", (r) => r.auditor_name], ["Score", (r) => pct(r.final_score)], ["Result", (r) => <span className={`severity-badge ${badge(r.final_result)}`}>{r.final_result}</span>], ["Reason", (r) => r.final_result_reason], ["Urgent", (r) => r.urgent_findings_count]]} />}
      {activeTab === 'raw' && <div className="page-stack"><DataTable rows={filtered.rawAudits} empty="No raw audit reports." columns={[["Audit report", (r) => <><strong>{r.checklist_name}</strong><span>{r.source_file_name}</span></>], ["Location", (r) => r.location_name_text], ["Client", (r) => r.client_name], ["Date", (r) => day(r.completed_at ?? r.report_date)], ["Score", (r) => pct(r.score_percentage)], ["Auditor", (r) => r.submitted_by_name]]} /><DataTable rows={filtered.rawCompletions} empty="No raw completion reports." columns={[["Completion report", (r) => <><strong>{r.location_name_text}</strong><span>{r.source_file_name}</span></>], ["Client", (r) => r.client_name], ["Period", (r) => `${day(r.date_range_start)} → ${day(r.date_range_end)}`], ["Lists completed", (r) => pct(r.lists_completed_pct)], ["Lists missed", (r) => pct(r.lists_missed_pct)], ["Items missed", (r) => pct(r.items_missed_pct)]]} /></div>}
    </div>
  );
}

function DashboardCards({ weakestLocation, topFailed, urgentFindings }: { weakestLocation?: Row; topFailed?: Row; urgentFindings: Row[] }) {
  return <div className="two-column"><section className="card"><div className="section-header"><div><p className="eyebrow">Standard audit dashboard</p><h2>Monitoring widgets</h2></div><BarChart3 size={20} /></div><div className="stack-list"><article className="list-card"><h3>Average audit score by location</h3><p>{weakestLocation ? `${weakestLocation.location_name} has the weakest score at ${pct(weakestLocation.average_audit_score)}.` : 'No location data.'}</p></article><article className="list-card"><h3>Top failed item/question</h3><p>{topFailed ? `${topFailed.item_text} failed ${topFailed.failure_count} time(s).` : 'No failed items.'}</p></article><article className="list-card"><h3>Urgent findings</h3><p>{urgentFindings.length} urgent failed item(s) should appear at the top of the audit PDF.</p></article></div></section><section className="card"><div className="section-header"><div><p className="eyebrow">PDF output</p><h2>Pen-and-paper report structure</h2></div><FileText size={20} /></div><div className="stack-list"><article className="list-card"><h3>Header</h3><p>Client, location, date/time, auditor, and checklist/audit name.</p></article><article className="list-card"><h3>Body</h3><p>Sections, questions, answers, scores, comments, and status.</p></article><article className="list-card"><h3>Conclusion</h3><p>Final score, final result, critical fail reason, and urgent findings.</p></article></div></section></div>;
}

function DataTable({ rows, columns, empty }: { rows: Row[]; columns: Array<[string, (row: Row, index: number) => ReactNode]>; empty: string }) {
  return <section className="card"><div className="table-wrap"><table><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={row.id ?? row.audit_report_id ?? row.audit_item_id ?? row.checklist_name ?? index}>{columns.map(([label, render]) => <td key={label}>{render(row, index)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={columns.length}>{empty}</td></tr>}</tbody></table></div></section>;
}
