import { useEffect, useState } from 'react';
import { AlertTriangle, Brain, Database, Download, Sparkles } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { invokeAIGenerateInsights, supabase, useMockData } from '../lib/supabase';

const defaultOrg = '10000000-0000-0000-0000-000000000001';
const emptyOrg = '00000000-0000-0000-0000-000000000001';
const envOrg = import.meta.env.VITE_ORGANIZATION_ID as string | undefined;
const organizationId = !envOrg || envOrg === emptyOrg ? defaultOrg : envOrg;
const periodStart = (import.meta.env.VITE_REPORT_PERIOD_START as string | undefined) || '2026-02-01';
const periodEnd = (import.meta.env.VITE_REPORT_PERIOD_END as string | undefined) || '2026-02-28';

type Row = Record<string, any>;

function safe(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

function num(value: unknown) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

function date(value: unknown) {
  return value ? String(value).slice(0, 10) : '—';
}

function makePdf(lines: string[]) {
  const width = 595;
  const height = 842;
  const margin = 48;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += 48) pages.push(lines.slice(i, i + 48));
  const esc = (text: string) => safe(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objects: string[] = [];
  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  pages.forEach((page, i) => {
    const body = ['BT', '/F1 10 Tf', '14 TL', `${margin} 790 Td`, ...page.flatMap((line, index) => [index === 0 && i === 0 ? '/F1 20 Tf' : '/F1 10 Tf', `(${esc(line)}) Tj`, 'T*']), 'ET'].join('\n');
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
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
  const [summary, setSummary] = useState<Row | null>(null);
  const [lineage, setLineage] = useState<Row[]>([]);
  const [runs, setRuns] = useState<Row[]>([]);
  const [predictions, setPredictions] = useState<Row[]>([]);
  const [actions, setActions] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  async function load() {
    if (useMockData || !supabase) return;
    setLoading(true);
    try {
      const [summaryResult, lineageResult, runsResult, predictionResult, actionResult] = await Promise.all([
        supabase.from('v_client_company_dashboard').select('*').eq('organization_id', organizationId).maybeSingle(),
        supabase.from('v_analytics_data_lineage').select('*').eq('organization_id', organizationId).order('sort_order', { ascending: true }),
        supabase.from('analytics_generation_runs').select('*').eq('organization_id', organizationId).order('started_at', { ascending: false }).limit(10),
        supabase.from('v_predictive_location_risk').select('*').eq('organization_id', organizationId).order('predicted_next_risk_score', { ascending: false }).limit(20),
        supabase.from('v_advanced_report_action_plan').select('*').eq('organization_id', organizationId).order('priority_rank', { ascending: true }).limit(30)
      ]);
      const firstError = summaryResult.error || lineageResult.error || runsResult.error || predictionResult.error || actionResult.error;
      if (firstError) {
        setMessage(`Analytics v3 is not ready: ${firstError.message}. Run advanced_ml_v3_clean_lineage_edge_function.sql first.`);
        return;
      }
      setSummary(summaryResult.data ?? null);
      setLineage(lineageResult.data ?? []);
      setRuns(runsResult.data ?? []);
      setPredictions(predictionResult.data ?? []);
      setActions(actionResult.data ?? []);
      setMessage(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Failed to load analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function runMl() {
    setRunning(true);
    setMessage(null);
    try {
      const result = await invokeAIGenerateInsights({ organization_id: organizationId, analysis_source: 'imported_reports_v3', period_start: periodStart, period_end: periodEnd, run_type: 'manual' });
      setMessage(`ML v3 finished. Raw rows scanned: ${result?.raw_rows_scanned ?? 0}. Features: ${result?.generated_feature_rows ?? 0}. Insights: ${result?.generated_insight_rows ?? 0}.`);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'ML v3 failed.');
    } finally {
      setRunning(false);
    }
  }

  function downloadPdf() {
    const lines = [
      'InCheck360 Management Report',
      'Advanced Internal ML v3 - raw data analyzed by model runner',
      `Organization: ${organizationId}`,
      `Period: ${periodStart} to ${periodEnd}`,
      '',
      'EXECUTIVE SUMMARY',
      `Locations: ${safe(summary?.location_count)} | Avg risk: ${safe(summary?.avg_risk_score)}/100 | Avg health: ${safe(summary?.avg_health_score)}/100`,
      `Failed items: ${safe(summary?.total_failed_items)} | Critical failures: ${safe(summary?.total_critical_failures)} | Open actions: ${safe(summary?.open_action_count)}`,
      '',
      'DATA LINEAGE PROOF',
      ...lineage.map((row) => `${safe(row.layer)} | ${safe(row.table_name)} | rows ${safe(row.row_count)} | generated_by ${safe(row.generated_by ?? 'not generated')} | run ${safe(row.calculation_run_id)}`),
      '',
      'PREDICTIVE RISK',
      ...predictions.map((row, i) => `${i + 1}. ${safe(row.location_name)} - current ${safe(row.current_risk_score)}/100, predicted ${safe(row.predicted_next_risk_score)}/100 (${safe(row.predicted_risk_level)})`),
      '',
      'ACTION PLAN',
      ...actions.map((row, i) => `${i + 1}. [${safe(row.severity)}] ${safe(row.location_name)} - ${safe(row.action_title)}. ${safe(row.recommended_action)}`)
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

  const lastRun = runs[0];

  return (
    <div className="page-stack">
      <section className="hero-card ai-hero">
        <div>
          <p className="eyebrow">Advanced internal ML v3</p>
          <h2>Raw imports only. Analytics generated by the model runner.</h2>
          <p>The SQL seed imports raw report rows only. The Edge Function runs ML v3 and stamps generated rows with lineage fields.</p>
        </div>
        <button className="primary-button" onClick={runMl} disabled={running}><Sparkles size={17} /> {running ? 'Analyzing...' : 'Run Advanced ML v3'}</button>
      </section>

      {message && <section className="notice-card">{message}</section>}
      {loading && <section className="notice-card">Loading analytics...</section>}

      <section className="metric-grid three">
        <MetricCard title="Average risk" value={`${num(summary?.avg_risk_score)}/100`} hint="Generated by ML" icon={<Brain />} tone="warning" />
        <MetricCard title="Critical failures" value={summary?.total_critical_failures ?? '—'} hint="From raw failed items" icon={<AlertTriangle />} tone="danger" />
        <MetricCard title="Last ML run" value={lastRun?.status ?? '—'} hint={lastRun?.calculation_run_id ?? 'No run yet'} icon={<Database />} tone="success" />
      </section>

      <section className="card">
        <div className="section-header"><div><p className="eyebrow">Data lineage proof</p><h2>Imported vs generated</h2></div><button className="primary-button" onClick={downloadPdf}><Download size={17} /> Download PDF</button></div>
        <div className="table-wrap"><table><thead><tr><th>Layer</th><th>Table</th><th>Rows</th><th>Generated by</th><th>Model</th><th>Run ID</th><th>Last activity</th></tr></thead><tbody>{lineage.map((row, index) => <tr key={index}><td><strong>{row.layer}</strong></td><td>{row.table_name}</td><td>{row.row_count}</td><td>{row.generated_by ?? 'not generated'}</td><td>{row.model_version ?? '—'}</td><td>{row.calculation_run_id ?? '—'}</td><td>{date(row.last_activity_at)}</td></tr>)}{!lineage.length && <tr><td colSpan={7}>No lineage rows found.</td></tr>}</tbody></table></div>
      </section>

      <section className="card"><div className="section-header"><div><p className="eyebrow">Predictive risk</p><h2>Generated from raw reports</h2></div><TrendingUp size={20} /></div><div className="table-wrap"><table><thead><tr><th>Location</th><th>Current</th><th>Predicted</th><th>Level</th><th>Visit</th><th>Reason</th></tr></thead><tbody>{predictions.map((row, index) => <tr key={index}><td><strong>{row.location_name}</strong></td><td>{num(row.current_risk_score)}/100</td><td>{num(row.predicted_next_risk_score)}/100</td><td>{row.predicted_risk_level}</td><td>{row.recommended_visit_window}</td><td>{row.prediction_reason}</td></tr>)}</tbody></table></div></section>

      <section className="card"><div className="section-header"><div><p className="eyebrow">Action plan</p><h2>Generated corrective priorities</h2></div><FileText size={20} /></div><div className="table-wrap"><table><thead><tr><th>Priority</th><th>Location</th><th>Action</th><th>Recommendation</th></tr></thead><tbody>{actions.map((row, index) => <tr key={index}><td>{row.severity}</td><td>{row.location_name}</td><td>{row.action_title}</td><td>{row.recommended_action}</td></tr>)}</tbody></table></div></section>
    </div>
  );
}
