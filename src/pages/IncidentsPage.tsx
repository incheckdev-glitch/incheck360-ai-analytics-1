import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { correctiveActions, incidents } from '../data/mockData';
import { formatDateTime } from '../lib/analytics';
import { supabase, useMockData } from '../lib/supabase';
import type { IncidentStatus, Severity, TaskStatus } from '../lib/types';

const sampleOrgId = '10000000-0000-0000-0000-000000000001';
const emptyOrgId = '00000000-0000-0000-0000-000000000001';
const envOrganizationId = import.meta.env.VITE_ORGANIZATION_ID as string | undefined;
const organizationId = !envOrganizationId || envOrganizationId === emptyOrgId ? sampleOrgId : envOrganizationId;

type AuditItemRow = {
  audit_item_id: string;
  location_id: string | null;
  item_text: string;
  result_value: string | null;
  score_earned: number | null;
  score_total: number | null;
  completed_by_name: string | null;
  completed_at: string | null;
  comment_text: string | null;
  risk_category: string | null;
  is_critical: boolean | null;
  audit_reports?: {
    checklist_name?: string | null;
    location_name_text?: string | null;
    source_file_name?: string | null;
    report_date?: string | null;
  } | null;
  audit_report_sections?: {
    section_name?: string | null;
  } | null;
};

type ImportedIncident = {
  id: string;
  reference: string;
  title: string;
  locationName: string;
  category: string;
  severity: Severity;
  status: IncidentStatus;
  reportedBy: string;
  reportedAt: string;
  summary: string;
  source: string;
};

type ImportedAction = {
  id: string;
  title: string;
  locationName: string;
  owner: string;
  dueAt: string;
  status: TaskStatus;
  severity: Severity;
  evidenceRequired: boolean;
  source: string;
};

function addDays(value: string | null | undefined, days: number) {
  const base = value ? new Date(value) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

function deriveSeverity(row: AuditItemRow): Severity {
  if (row.is_critical) return 'critical';
  if (['cross_contamination', 'temperature_control', 'personal_hygiene'].includes(row.risk_category ?? '')) return 'high';
  if (['labeling', 'monitoring_records', 'equipment_condition'].includes(row.risk_category ?? '')) return 'medium';
  return 'low';
}

function toIncident(row: AuditItemRow): ImportedIncident {
  const locationName = row.audit_reports?.location_name_text || 'Imported report location';
  const checklistName = row.audit_reports?.checklist_name || 'Imported audit report';
  const section = row.audit_report_sections?.section_name;
  return {
    id: row.audit_item_id,
    reference: `AUD-${row.audit_item_id.slice(0, 8)}`,
    title: row.item_text,
    locationName,
    category: row.risk_category || 'audit_failure',
    severity: deriveSeverity(row),
    status: row.is_critical ? 'investigating' : 'open',
    reportedBy: row.completed_by_name || 'Audit import',
    reportedAt: row.completed_at || new Date().toISOString(),
    summary: row.comment_text || `Failed item from ${checklistName}${section ? ` / ${section}` : ''}.`,
    source: `${checklistName}${section ? ` · ${section}` : ''}`
  };
}

function toCorrectiveAction(row: AuditItemRow): ImportedAction {
  return {
    id: row.audit_item_id,
    title: `Corrective action: ${row.item_text}`,
    locationName: row.audit_reports?.location_name_text || 'Imported report location',
    owner: 'Area / Store Manager',
    dueAt: addDays(row.completed_at, row.is_critical ? 1 : 7),
    status: row.is_critical ? 'overdue' : 'todo',
    severity: deriveSeverity(row),
    evidenceRequired: true,
    source: row.comment_text || row.audit_reports?.checklist_name || 'Imported audit report'
  };
}

export function IncidentsPage() {
  const [importedIncidents, setImportedIncidents] = useState<ImportedIncident[]>([]);
  const [importedActions, setImportedActions] = useState<ImportedAction[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadImportedIncidents() {
      if (useMockData || !supabase) return;

      const { data, error } = await supabase
        .from('audit_report_items')
        .select('audit_item_id,location_id,item_text,result_value,score_earned,score_total,completed_by_name,completed_at,comment_text,risk_category,is_critical,audit_reports(checklist_name,location_name_text,source_file_name,report_date),audit_report_sections(section_name)')
        .eq('organization_id', organizationId)
        .or('is_pass.eq.false,score_earned.lt.score_total')
        .order('is_critical', { ascending: false })
        .order('completed_at', { ascending: false })
        .limit(100);

      if (error) {
        setNotice(`Imported incidents could not load: ${error.message}. Confirm the report-import SQL was run.`);
        return;
      }

      const rows = ((data ?? []) as unknown as AuditItemRow[]);
      setImportedIncidents(rows.map(toIncident));
      setImportedActions(rows.map(toCorrectiveAction));

      if (!rows.length) {
        setNotice(`No failed audit items found for organization ${organizationId}. Import the report SQL seed or upload report data.`);
      } else {
        setNotice(null);
      }
    }

    void loadImportedIncidents();
  }, []);

  const visibleIncidents = useMockData ? incidents : importedIncidents;
  const visibleActions = useMockData ? correctiveActions : importedActions;

  const criticalCount = useMemo(() => visibleIncidents.filter((incident) => incident.severity === 'critical').length, [visibleIncidents]);

  return (
    <div className="page-stack">
      {!useMockData && (
        <section className="notice-card">
          Incident log and corrective actions are derived from imported failed audit items. Critical failures are escalated automatically. Critical count: {criticalCount}.
        </section>
      )}
      {notice && <section className="notice-card">{notice}</section>}

      <div className="two-column">
        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Incident log</p>
              <h2>{useMockData ? 'Operational incidents' : 'Imported audit incidents'}</h2>
            </div>
            <AlertTriangle size={20} />
          </div>
          <div className="stack-list">
            {visibleIncidents.map((incident) => (
              <article className="list-card" key={incident.id}>
                <div className="row between wrap">
                  <span className={`severity-badge ${incident.severity}`}>{incident.severity}</span>
                  <span className="pill muted">{incident.status}</span>
                </div>
                <h3>{incident.title}</h3>
                <p>{incident.summary}</p>
                {!useMockData && 'source' in incident && <p className="muted-text"><ClipboardCheck size={15} /> {incident.source}</p>}
                <span className="muted-text">{incident.reference} · {incident.locationName} · {formatDateTime(incident.reportedAt)}</span>
              </article>
            ))}
            {!visibleIncidents.length && <span className="muted-text">No imported audit incidents found.</span>}
          </div>
        </section>

        <section className="card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Corrective actions</p>
              <h2>{useMockData ? 'Follow-through tracker' : 'Actions from audit failures'}</h2>
            </div>
            <CheckCircle2 size={20} />
          </div>
          <div className="stack-list">
            {visibleActions.map((action) => (
              <article className="list-card" key={action.id}>
                <div className="row between wrap">
                  <span className={`severity-badge ${action.severity}`}>{action.severity}</span>
                  <span className="pill muted">{action.status}</span>
                </div>
                <h3>{action.title}</h3>
                <p>{action.locationName}</p>
                {!useMockData && 'source' in action && <p>{action.source}</p>}
                <span className="muted-text">Owner: {action.owner} · Due: {formatDateTime(action.dueAt)}</span>
              </article>
            ))}
            {!visibleActions.length && <span className="muted-text">No corrective actions generated from imported reports yet.</span>}
          </div>
        </section>
      </div>
    </div>
  );
}
