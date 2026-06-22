import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ClipboardCheck, Plus, Search } from 'lucide-react';
import { ChecklistTemplateCard } from '../components/ChecklistTemplateCard';
import { supabase, useMockData } from '../lib/supabase';
import type { ChecklistTemplate } from '../lib/types';

interface ChecklistsPageProps {
  templates: ChecklistTemplate[];
}

const sampleOrgId = '10000000-0000-0000-0000-000000000001';
const emptyOrgId = '00000000-0000-0000-0000-000000000001';
const envOrganizationId = import.meta.env.VITE_ORGANIZATION_ID as string | undefined;
const organizationId = !envOrganizationId || envOrganizationId === emptyOrgId ? sampleOrgId : envOrganizationId;

type AuditReportRow = {
  audit_report_id: string;
  checklist_name: string;
  location_name_text: string | null;
  score_percentage: number | null;
  score_earned: number | null;
  score_total: number | null;
  instance_status: string | null;
  completed_at: string | null;
};

type CompletionChecklistRow = {
  completion_checklist_id: string;
  checklist_name: string;
  location_id: string | null;
  done_on_time_count: number | null;
  done_on_time_pct: number | null;
  partially_done_count: number | null;
  partially_done_pct: number | null;
  missed_count: number | null;
  missed_pct: number | null;
};

type AuditFailureCount = {
  checklist_name: string;
  failed_count: number;
  critical_count: number;
};

type LiveChecklistCard = {
  id: string;
  title: string;
  locationName: string;
  scorePercentage: number | null;
  status: string;
  completedAt: string | null;
  failedCount: number;
  criticalCount: number;
  doneOnTimePct?: number | null;
  missedPct?: number | null;
  source: 'audit' | 'completion';
};

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function formatDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : '—';
}

export function ChecklistsPage({ templates }: ChecklistsPageProps) {
  const [searchText, setSearchText] = useState('');
  const [liveCards, setLiveCards] = useState<LiveChecklistCard[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadImportedChecklists() {
      if (useMockData || !supabase) return;

      const [auditReports, completionChecklists, auditItems] = await Promise.all([
        supabase
          .from('audit_reports')
          .select('audit_report_id,checklist_name,location_name_text,score_percentage,score_earned,score_total,instance_status,completed_at')
          .eq('organization_id', organizationId)
          .order('completed_at', { ascending: false })
          .limit(50),
        supabase
          .from('completion_rate_checklists')
          .select('completion_checklist_id,checklist_name,location_id,done_on_time_count,done_on_time_pct,partially_done_count,partially_done_pct,missed_count,missed_pct')
          .eq('organization_id', organizationId)
          .order('missed_pct', { ascending: false })
          .limit(50),
        supabase
          .from('audit_report_items')
          .select('audit_item_id,item_text,is_pass,is_critical,audit_reports(checklist_name)')
          .eq('organization_id', organizationId)
          .or('is_pass.eq.false,score_earned.lt.score_total')
          .limit(500)
      ]);

      const firstError = auditReports.error || completionChecklists.error || auditItems.error;
      if (firstError) {
        setNotice(`Imported checklists could not load: ${firstError.message}. Confirm the report-import SQL was run.`);
        return;
      }

      const failureMap = new Map<string, AuditFailureCount>();
      ((auditItems.data ?? []) as unknown as Array<{ is_critical: boolean | null; audit_reports?: { checklist_name?: string | null } | null }>).forEach((row) => {
        const checklistName = row.audit_reports?.checklist_name || 'Imported audit report';
        const current = failureMap.get(checklistName) || { checklist_name: checklistName, failed_count: 0, critical_count: 0 };
        current.failed_count += 1;
        if (row.is_critical) current.critical_count += 1;
        failureMap.set(checklistName, current);
      });

      const auditCards: LiveChecklistCard[] = ((auditReports.data ?? []) as AuditReportRow[]).map((row) => {
        const failures = failureMap.get(row.checklist_name);
        return {
          id: row.audit_report_id,
          title: row.checklist_name,
          locationName: row.location_name_text || 'Imported report location',
          scorePercentage: row.score_percentage,
          status: row.instance_status || 'imported',
          completedAt: row.completed_at,
          failedCount: failures?.failed_count ?? 0,
          criticalCount: failures?.critical_count ?? 0,
          source: 'audit'
        };
      });

      const completionCards: LiveChecklistCard[] = ((completionChecklists.data ?? []) as CompletionChecklistRow[]).map((row) => ({
        id: row.completion_checklist_id,
        title: row.checklist_name,
        locationName: 'Completion rate report',
        scorePercentage: row.done_on_time_pct,
        status: row.missed_count && row.missed_count > 0 ? 'missed items' : 'completed',
        completedAt: null,
        failedCount: row.missed_count ?? 0,
        criticalCount: row.missed_pct && row.missed_pct >= 50 ? row.missed_count ?? 0 : 0,
        doneOnTimePct: row.done_on_time_pct,
        missedPct: row.missed_pct,
        source: 'completion'
      }));

      const rows = [...auditCards, ...completionCards];
      setLiveCards(rows);

      if (!rows.length) {
        setNotice(`No imported checklist/audit rows found for organization ${organizationId}. Run the report SQL seed or upload report data.`);
      } else {
        setNotice(null);
      }
    }

    void loadImportedChecklists();
  }, []);

  const filteredLiveCards = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return liveCards;
    return liveCards.filter((item) => `${item.title} ${item.locationName} ${item.status}`.toLowerCase().includes(term));
  }, [liveCards, searchText]);

  if (useMockData) {
    return (
      <div className="page-stack">
        <section className="notice-card">Mock prototype checklists are showing. Connect Supabase and redeploy to show imported report checklists.</section>
        <section className="toolbar-card">
          <div className="search-box">
            <Search size={18} />
            <input placeholder="Search checklist template..." />
          </div>
          <button className="primary-button"><Plus size={17} /> New Template</button>
        </section>

        <section className="card builder-card">
          <div>
            <p className="eyebrow">Checklist builder</p>
            <h2>Create dynamic checklists with proof, scoring, and corrective actions.</h2>
            <p>Use yes/no, number, temperature, photo, text, signature, and conditional fields.</p>
          </div>
        </section>

        <section className="template-grid">
          {templates.map((template) => <ChecklistTemplateCard key={template.id} template={template} />)}
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      {notice && <section className="notice-card">{notice}</section>}
      <section className="toolbar-card">
        <div className="search-box">
          <Search size={18} />
          <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search imported audit or completion checklist..." />
        </div>
        <span className="pill muted">Imported report checklists</span>
      </section>

      <section className="card builder-card">
        <div>
          <p className="eyebrow">Imported checklist analytics</p>
          <h2>Audit and completion checklists from uploaded reports.</h2>
          <p>
            This page is generated from imported audit reports, failed audit items, and completion-rate checklist summaries.
          </p>
        </div>
      </section>

      <section className="template-grid">
        {filteredLiveCards.map((item) => (
          <article className="card checklist-card" key={item.id}>
            <div className="section-header compact">
              <div>
                <p className="eyebrow">{item.source === 'audit' ? 'Audit report' : 'Completion rate'}</p>
                <h3>{item.title}</h3>
              </div>
              <span className={`pill ${item.criticalCount > 0 ? 'danger' : 'success'}`}>{item.status}</span>
            </div>
            <p className="muted-text"><ClipboardCheck size={15} /> {item.locationName}</p>
            <div className="progress-block">
              <div className="progress-label">
                <span>{item.source === 'audit' ? 'Audit score' : 'Done on time'}</span>
                <strong>{formatPct(item.scorePercentage)}</strong>
              </div>
              <div className="progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(item.scorePercentage ?? 0)))}%` }} /></div>
            </div>
            {item.source === 'completion' && (
              <div className="progress-block">
                <div className="progress-label"><span>Missed</span><strong>{formatPct(item.missedPct)}</strong></div>
                <div className="progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(item.missedPct ?? 0)))}%` }} /></div>
              </div>
            )}
            <div className="mini-grid">
              <span><AlertTriangle size={15} /> Failed: {item.failedCount}</span>
              <span><BarChart3 size={15} /> Critical: {item.criticalCount}</span>
              <span>{formatDate(item.completedAt)}</span>
            </div>
          </article>
        ))}
        {!filteredLiveCards.length && <section className="notice-card">No imported checklist data found.</section>}
      </section>
    </div>
  );
}
