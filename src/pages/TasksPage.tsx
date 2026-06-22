import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, ClipboardCheck, UserRound } from 'lucide-react';
import { tasks } from '../data/mockData';
import { formatDateTime } from '../lib/analytics';
import { supabase, useMockData } from '../lib/supabase';
import type { Severity, TaskStatus } from '../lib/types';

const columns = [
  { id: 'todo', title: 'To do' },
  { id: 'in_progress', title: 'In progress' },
  { id: 'overdue', title: 'Critical / overdue' },
  { id: 'done', title: 'Done' }
] as const;

const sampleOrgId = '10000000-0000-0000-0000-000000000001';
const emptyOrgId = '00000000-0000-0000-0000-000000000001';
const envOrganizationId = import.meta.env.VITE_ORGANIZATION_ID as string | undefined;
const organizationId = !envOrganizationId || envOrganizationId === emptyOrgId ? sampleOrgId : envOrganizationId;

type DisplayTask = {
  id: string;
  title: string;
  locationName: string;
  owner: string;
  dueAt: string;
  status: TaskStatus;
  priority: Severity;
  completionPercent: number;
  source?: string;
  note?: string;
};

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

function addDays(value: string | null | undefined, days: number) {
  const base = value ? new Date(value) : new Date();
  base.setDate(base.getDate() + days);
  return base.toISOString();
}

function derivePriority(row: AuditItemRow): Severity {
  if (row.is_critical) return 'critical';
  if (['cross_contamination', 'temperature_control', 'personal_hygiene'].includes(row.risk_category ?? '')) return 'high';
  if (['labeling', 'monitoring_records', 'equipment_condition'].includes(row.risk_category ?? '')) return 'medium';
  return 'low';
}

function deriveStatus(row: AuditItemRow): TaskStatus {
  if (row.is_critical) return 'overdue';
  if (['cross_contamination', 'temperature_control', 'personal_hygiene'].includes(row.risk_category ?? '')) return 'in_progress';
  return 'todo';
}

function mapAuditFailureToTask(row: AuditItemRow): DisplayTask {
  const locationName = row.audit_reports?.location_name_text || 'Imported report location';
  const checklistName = row.audit_reports?.checklist_name || 'Imported audit report';
  return {
    id: row.audit_item_id,
    title: row.item_text,
    locationName,
    owner: row.completed_by_name || 'Area / Store Manager',
    dueAt: addDays(row.completed_at, row.is_critical ? 1 : 7),
    status: deriveStatus(row),
    priority: derivePriority(row),
    completionPercent: 0,
    source: `${checklistName}${row.audit_report_sections?.section_name ? ` · ${row.audit_report_sections.section_name}` : ''}`,
    note: row.comment_text || row.result_value || undefined
  };
}

function mapMockTask(task: (typeof tasks)[number]): DisplayTask {
  return {
    id: task.id,
    title: task.title,
    locationName: task.locationName,
    owner: task.owner,
    dueAt: task.dueAt,
    status: task.status,
    priority: task.priority,
    completionPercent: task.completionPercent
  };
}

export function TasksPage() {
  const [importedTasks, setImportedTasks] = useState<DisplayTask[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadImportedTasks() {
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
        setNotice(`Imported corrective tasks could not load: ${error.message}. Confirm the report-import SQL was run.`);
        return;
      }

      setImportedTasks(((data ?? []) as unknown as AuditItemRow[]).map(mapAuditFailureToTask));
      if (!data?.length) {
        setNotice(`No failed audit items found for organization ${organizationId}. Import the report SQL seed or upload report data.`);
      } else {
        setNotice(null);
      }
    }

    void loadImportedTasks();
  }, []);

  const visibleTasks: DisplayTask[] = useMockData ? tasks.map(mapMockTask) : importedTasks;

  const tasksByColumn = useMemo(() => {
    return columns.reduce((acc, column) => {
      acc[column.id] = visibleTasks.filter((task) => task.status === column.id);
      return acc;
    }, {} as Record<(typeof columns)[number]['id'], DisplayTask[]>);
  }, [visibleTasks]);

  return (
    <div className="page-stack">
      {!useMockData && (
        <section className="notice-card">
          Tasks are generated from imported failed audit items. Critical food-safety failures are treated as urgent corrective tasks.
        </section>
      )}
      {notice && <section className="notice-card">{notice}</section>}

      <section className="kanban-grid">
        {columns.map((column) => (
          <div className="kanban-column" key={column.id}>
            <div className="kanban-title">
              <h3>{column.title}</h3>
              <span>{tasksByColumn[column.id].length}</span>
            </div>
            {tasksByColumn[column.id].map((task) => (
              <article className="task-card" key={task.id}>
                <span className={`severity-badge ${task.priority}`}>{task.priority}</span>
                <h4>{task.title}</h4>
                <p>{task.locationName}</p>
                {!useMockData && task.source && <p className="muted-text"><ClipboardCheck size={15} /> {task.source}</p>}
                {!useMockData && task.note && <p className="recommendation-box"><AlertTriangle size={15} /> {task.note}</p>}
                <div className="mini-grid single">
                  <span><UserRound size={15} /> {task.owner}</span>
                  <span><CalendarClock size={15} /> {formatDateTime(task.dueAt)}</span>
                </div>
                <div className="progress"><span style={{ width: `${task.completionPercent}%` }} /></div>
              </article>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
