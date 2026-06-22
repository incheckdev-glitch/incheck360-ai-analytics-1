import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, BarChart3, Brain, Building2, ClipboardCheck, Database, Download, FileText, GitCompare, Layers, ListChecks, Search, Sparkles, Target, TrendingUp } from 'lucide-react';
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
  { id: 'management', label: 'Management Export' },
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
  avg_items_completed_pct: number | null;
  avg_items_missed_pct: number | null;
  failed_item_count: number | null;
  critical_failed_item_count: number | null;
  repeated_issue_count: number | null;
  risk_score: number | null;
  health_score: number | null;
  risk_level: string | null;
  confidence: number | null;
};

type ExplanationRow = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  driver_label: string | null;
  driver_group: string | null;
  actual_value: number | null;
  impact_points: number | null;
  risk_score: number | null;
  explanation: string | null;
  driver_rank: number | null;
};

type PredictiveRow = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  current_risk_score: number | null;
  previous_risk_score: number | null;
  risk_delta: number | null;
  predicted_next_risk_score: number | null;
  predicted_next_audit_score: number | null;
  predicted_risk_level: string | null;
  trend_direction: string | null;
  recommended_visit_window: string | null;
  prediction_reason: string | null;
  failed_item_count: number | null;
  critical_failed_item_count: number | null;
  repeated_failure_count: number | null;
};

type ClientDashboardRow = {
  organization_id: string;
  company_name: string | null;
  location_count: number | null;
  audit_report_count: number | null;
  completion_report_count: number | null;
  avg_risk_score: number | null;
  avg_health_score: number | null;
  critical_location_count: number | null;
  high_risk_location_count: number | null;
  total_failed_items: number | null;
  total_critical_failures: number | null;
  total_repeated_issues: number | null;
  avg_lists_missed_pct: number | null;
  avg_items_missed_pct: number | null;
  top_risk_category: string | null;
  top_category_failures: number | null;
  open_action_count: number | null;
  high_priority_action_count: number | null;
};

type BenchmarkLocationRow = AdvancedLocation & {
  risk_rank_high_to_low: number | null;
  health_rank_best_to_worst: number | null;
  risk_percentile: number | null;
  company_avg_risk_score: number | null;
  risk_vs_company_avg: number | null;
};

type BenchmarkCategoryRow = {
  organization_id: string;
  risk_category: string | null;
  total_failed_items: number | null;
  total_critical_failed_items: number | null;
  affected_location_count: number | null;
  avg_item_score_pct: number | null;
  category_failure_rank: number | null;
};

type BenchmarkSectionRow = {
  organization_id: string;
  section_name: string | null;
  affected_location_count: number | null;
  section_row_count: number | null;
  avg_section_score_pct: number | null;
  min_section_score_pct: number | null;
  failed_item_count: number | null;
  critical_failed_item_count: number | null;
  weakest_section_rank: number | null;
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
  category_risk_level: string | null;
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
  section_risk_level: string | null;
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
  severity: string | null;
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
  repeated_issue_level: string | null;
};

type ActionRow = {
  organization_id: string;
  location_id: string | null;
  location_name: string | null;
  action_reference: string;
  severity: string | null;
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
  return ['critical', 'high', 'medium', 'low'].includes(value ?? '') ? value as string : 'low';
}

function plain(value: unknown): string {
  if (value === null || value === undefined) return '—';
  return String(value)
    .replace(/[\u2010-\u2015]/g, '-')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || '—';
}

function asRecords(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];
}

function pdfEscape(text: string): string {
  return plain(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapText(text: string, maxChars: number): string[] {
  const words = plain(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  words.forEach((word) => {
    if (!line) {
      line = word;
      return;
    }
    if (`${line} ${word}`.length > maxChars) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`;
    }
  });
  if (line) lines.push(line);
  return lines.length ? lines : ['—'];
}

type PdfColor = [number, number, number];
type PdfCell = unknown;

type PdfTableColumn<T> = {
  title: string;
  width: number;
  value: (row: T, index: number) => PdfCell;
  maxChars?: number;
};

type PdfPage = {
  commands: string[];
};

class ProfessionalPdf {
  private pages: PdfPage[] = [];
  private y = 0;
  private readonly width = 595;
  private readonly height = 842;
  private readonly margin = 42;
  private readonly bottom = 58;
  private pageTitle = '';
  private readonly navy: PdfColor = [0.08, 0.12, 0.20];
  private readonly blue: PdfColor = [0.10, 0.31, 0.70];
  private readonly gray: PdfColor = [0.45, 0.48, 0.55];
  private readonly lightGray: PdfColor = [0.96, 0.97, 0.98];
  private readonly border: PdfColor = [0.84, 0.87, 0.91];
  private readonly danger: PdfColor = [0.75, 0.12, 0.12];
  private readonly warning: PdfColor = [0.78, 0.42, 0.04];
  private readonly success: PdfColor = [0.10, 0.45, 0.25];

  constructor(private readonly report: Record<string, unknown>) {}

  build() {
    this.cover();
    this.executiveSummary();
    this.predictiveRisk();
    this.mlExplanation();
    this.benchmarking();
    this.actionPlan();
    this.failedItems();
    return this.toBlob();
  }

  private get current() {
    return this.pages[this.pages.length - 1];
  }

  private newPage(title = 'Management Report') {
    this.pages.push({ commands: [] });
    this.pageTitle = title;
    this.y = this.height - 44;
    if (this.pages.length > 1) this.header(title);
  }

  private color([r, g, b]: PdfColor, stroke = false) {
    this.current.commands.push(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} ${stroke ? 'RG' : 'rg'}`);
  }

  private rect(x: number, y: number, w: number, h: number, fill?: PdfColor, stroke?: PdfColor) {
    if (fill) {
      this.color(fill);
      this.current.commands.push(`${x} ${y} ${w} ${h} re f`);
    }
    if (stroke) {
      this.color(stroke, true);
      this.current.commands.push(`${x} ${y} ${w} ${h} re S`);
    }
  }

  private text(value: string, x: number, y: number, size = 9, color: PdfColor = [0.11, 0.13, 0.18], bold = false) {
    this.color(color);
    this.current.commands.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${x} ${y} Td (${pdfEscape(value)}) Tj ET`);
  }

  private line(x1: number, y1: number, x2: number, y2: number, color: PdfColor = this.border) {
    this.color(color, true);
    this.current.commands.push(`${x1} ${y1} m ${x2} ${y2} l S`);
  }

  private header(title: string) {
    this.rect(0, this.height - 40, this.width, 40, this.navy);
    this.text('InCheck360', this.margin, this.height - 25, 13, [1, 1, 1], true);
    this.text(title, this.width - 245, this.height - 24, 9, [0.88, 0.93, 1], false);
    this.y = this.height - 70;
  }

  private footer(pageIndex: number) {
    this.line(this.margin, 38, this.width - this.margin, 38, this.border);
    this.text('InCheck360 Advanced Internal ML v2', this.margin, 24, 8, this.gray);
    this.text(`Page ${pageIndex + 1}`, this.width - 80, 24, 8, this.gray);
  }

  private ensure(height: number, title = this.pageTitle) {
    if (this.y - height < this.bottom) {
      this.newPage(title);
    }
  }

  private title(text: string, subtitle?: string) {
    this.ensure(45);
    this.text(text, this.margin, this.y, 16, this.navy, true);
    this.y -= 17;
    if (subtitle) {
      wrapText(subtitle, 92).slice(0, 2).forEach((line) => {
        this.text(line, this.margin, this.y, 9, this.gray);
        this.y -= 12;
      });
    }
    this.y -= 8;
  }

  private card(x: number, y: number, w: number, h: number, label: string, value: string, accent: PdfColor) {
    this.rect(x, y, w, h, [1, 1, 1], this.border);
    this.rect(x, y + h - 5, w, 5, accent);
    this.text(label.toUpperCase(), x + 12, y + h - 22, 7, this.gray, true);
    this.text(value, x + 12, y + 18, 18, this.navy, true);
  }

  private bulletList(items: string[]) {
    items.forEach((item) => {
      this.ensure(24);
      this.text('•', this.margin, this.y, 10, this.blue, true);
      const lines = wrapText(item, 86).slice(0, 3);
      lines.forEach((line, index) => {
        this.text(line, this.margin + 14, this.y - (index * 11), 9, [0.15, 0.17, 0.22]);
      });
      this.y -= Math.max(16, lines.length * 11 + 3);
    });
  }

  private table<T>(title: string, rows: T[], columns: PdfTableColumn<T>[], options?: { maxRows?: number; subtitle?: string }) {
    const visibleRows = rows.slice(0, options?.maxRows ?? rows.length);
    this.title(title, options?.subtitle);
    if (!visibleRows.length) {
      this.text('No records available.', this.margin, this.y, 9, this.gray);
      this.y -= 18;
      return;
    }

    const tableWidth = this.width - (this.margin * 2);
    const headerHeight = 22;
    const rowHeight = 33;
    const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
    const scaledColumns = columns.map((col) => ({ ...col, width: (col.width / totalWidth) * tableWidth }));

    this.ensure(headerHeight + rowHeight + 12);
    this.rect(this.margin, this.y - headerHeight, tableWidth, headerHeight, this.navy);
    let x = this.margin;
    scaledColumns.forEach((col) => {
      this.text(col.title, x + 6, this.y - 14, 7, [1, 1, 1], true);
      x += col.width;
    });
    this.y -= headerHeight;

    visibleRows.forEach((row, rowIndex) => {
      this.ensure(rowHeight + headerHeight, title);
      const fill = rowIndex % 2 === 0 ? [1, 1, 1] as PdfColor : this.lightGray;
      this.rect(this.margin, this.y - rowHeight, tableWidth, rowHeight, fill, this.border);
      let cellX = this.margin;
      scaledColumns.forEach((col) => {
        const raw = plain(col.value(row, rowIndex));
        const lines = wrapText(raw, col.maxChars ?? Math.max(8, Math.floor(col.width / 5))).slice(0, 2);
        lines.forEach((lineText, lineIndex) => {
          this.text(lineText, cellX + 6, this.y - 12 - (lineIndex * 10), 7.5, [0.12, 0.14, 0.18], lineIndex === 0 && col.title.toLowerCase().includes('location'));
        });
        cellX += col.width;
      });
      this.y -= rowHeight;
    });
    this.y -= 14;
  }

  private cover() {
    this.newPage('Executive Management Report');
    const meta = (this.report.report_meta ?? {}) as Record<string, unknown>;
    const summary = (this.report.executive_summary ?? {}) as Record<string, unknown>;

    this.rect(0, 0, this.width, this.height, [0.98, 0.99, 1.00]);
    this.rect(0, this.height - 220, this.width, 220, this.navy);
    this.rect(0, this.height - 224, this.width, 6, this.blue);
    this.text('InCheck360', this.margin, this.height - 74, 18, [1, 1, 1], true);
    this.text('Management Report', this.margin, this.height - 118, 30, [1, 1, 1], true);
    this.text('Advanced Internal ML v2 - Operations Intelligence', this.margin, this.height - 144, 13, [0.86, 0.91, 1.00]);
    this.text(`Period: ${plain(meta.period_start ?? reportPeriodStart)} to ${plain(meta.period_end ?? reportPeriodEnd)}`, this.margin, this.height - 170, 10, [0.86, 0.91, 1.00]);
    this.text(`Generated: ${plain(meta.generated_at ?? new Date().toISOString())}`, this.margin, this.height - 187, 9, [0.75, 0.82, 0.92]);

    const cardY = this.height - 330;
    const cardW = 118;
    this.card(this.margin, cardY, cardW, 76, 'Locations', plain(summary.location_count), this.blue);
    this.card(this.margin + 132, cardY, cardW, 76, 'Avg risk', `${plain(summary.avg_risk_score)}/100`, this.warning);
    this.card(this.margin + 264, cardY, cardW, 76, 'Critical', plain(summary.total_critical_failures), this.danger);
    this.card(this.margin + 396, cardY, cardW, 76, 'Actions', plain(summary.open_action_count), this.success);

    this.y = cardY - 40;
    this.title('Executive snapshot', 'A concise management view of location risk, failed controls, predictive exposure, and required corrective actions.');
    this.bulletList([
      `Company / Organization: ${plain(summary.company_name ?? summary.organization_id ?? organizationId)}`,
      `Top risk category: ${plain(summary.top_risk_category)} with ${plain(summary.top_category_failures)} failure(s).`,
      `${plain(summary.critical_location_count)} critical location(s) and ${plain(summary.high_risk_location_count)} high-risk location(s) were identified.`,
      `${plain(summary.total_failed_items)} failed item(s), including ${plain(summary.total_critical_failures)} critical failure(s), require follow-up.`
    ]);
  }

  private executiveSummary() {
    this.newPage('Executive Summary');
    const summary = (this.report.executive_summary ?? {}) as Record<string, unknown>;
    this.title('Executive Summary', 'Operational health, risk concentration, and follow-up workload for the selected reporting period.');
    this.card(this.margin, this.y - 80, 156, 66, 'Average health', `${plain(summary.avg_health_score)}/100`, this.success);
    this.card(this.margin + 176, this.y - 80, 156, 66, 'Failed items', plain(summary.total_failed_items), this.danger);
    this.card(this.margin + 352, this.y - 80, 156, 66, 'High-priority actions', plain(summary.high_priority_action_count), this.warning);
    this.y -= 110;
    this.bulletList([
      `Audit reports: ${plain(summary.audit_report_count)}. Completion reports: ${plain(summary.completion_report_count)}.`,
      `Average missed lists: ${plain(summary.avg_lists_missed_pct)}%. Average missed items: ${plain(summary.avg_items_missed_pct)}%.`,
      `Repeated issues: ${plain(summary.total_repeated_issues)}. Open actions: ${plain(summary.open_action_count)}.`
    ]);
  }

  private predictiveRisk() {
    this.newPage('Predictive Risk');
    this.table('Predictive Risk', asRecords(this.report.predictive_risk), [
      { title: 'Location', width: 110, value: (row) => row.location_name },
      { title: 'Current', width: 65, value: (row) => `${plain(row.current_risk_score)}/100` },
      { title: 'Predicted', width: 74, value: (row) => `${plain(row.predicted_next_risk_score)}/100` },
      { title: 'Level', width: 66, value: (row) => row.predicted_risk_level },
      { title: 'Visit window', width: 110, value: (row) => row.recommended_visit_window },
      { title: 'Reason', width: 170, value: (row) => row.prediction_reason, maxChars: 32 }
    ], { maxRows: 16, subtitle: 'Forecasted risk based on current risk, critical findings, repeated failures, and checklist execution discipline.' });
  }

  private mlExplanation() {
    this.newPage('ML Explanation');
    this.table('ML Explanation - Top Drivers', asRecords(this.report.ml_explanations), [
      { title: 'Location', width: 105, value: (row) => row.location_name },
      { title: 'Driver', width: 130, value: (row) => row.driver_label },
      { title: 'Group', width: 110, value: (row) => row.driver_group },
      { title: 'Value', width: 52, value: (row) => row.actual_value },
      { title: 'Impact', width: 58, value: (row) => `${plain(row.impact_points)} pts` },
      { title: 'Explanation', width: 170, value: (row) => row.explanation, maxChars: 35 }
    ], { maxRows: 22, subtitle: 'Transparent scoring drivers showing exactly why a location risk score increased.' });
  }

  private benchmarking() {
    this.newPage('Benchmarking');
    this.table('Location Benchmarking', asRecords(this.report.location_benchmarking), [
      { title: 'Location', width: 120, value: (row) => row.location_name },
      { title: 'Risk rank', width: 64, value: (row) => `#${plain(row.risk_rank_high_to_low)}` },
      { title: 'Risk', width: 60, value: (row) => `${plain(row.risk_score)}/100` },
      { title: 'Health', width: 60, value: (row) => `${plain(row.health_score)}/100` },
      { title: 'Vs avg', width: 60, value: (row) => row.risk_vs_company_avg },
      { title: 'Failed / Critical', width: 95, value: (row) => `${plain(row.failed_item_count)} / ${plain(row.critical_failed_item_count)}` }
    ], { maxRows: 15 });

    this.table('Category Benchmarking', asRecords(this.report.category_benchmarking), [
      { title: 'Category', width: 155, value: (row) => row.risk_category },
      { title: 'Rank', width: 55, value: (row) => `#${plain(row.category_failure_rank)}` },
      { title: 'Failed', width: 60, value: (row) => row.total_failed_items },
      { title: 'Critical', width: 60, value: (row) => row.total_critical_failed_items },
      { title: 'Locations', width: 70, value: (row) => row.affected_location_count },
      { title: 'Avg score', width: 70, value: (row) => `${plain(row.avg_item_score_pct)}%` }
    ], { maxRows: 12 });
  }

  private actionPlan() {
    this.newPage('Action Plan');
    this.table('Priority Action Plan', asRecords(this.report.action_plan), [
      { title: 'Priority', width: 58, value: (row) => row.severity },
      { title: 'Location', width: 92, value: (row) => row.location_name },
      { title: 'Finding', width: 180, value: (row) => row.action_title, maxChars: 36 },
      { title: 'Due', width: 82, value: (row) => String(row.suggested_due_at ?? '').slice(0, 10) },
      { title: 'Corrective action', width: 190, value: (row) => row.recommended_action, maxChars: 38 }
    ], { maxRows: 28, subtitle: 'Actions are ranked by severity and due date. Critical actions require evidence.' });
  }

  private failedItems() {
    this.newPage('Failed Item Details');
    this.table('Failed Item Details', asRecords(this.report.failed_items), [
      { title: 'Location', width: 90, value: (row) => row.location_name },
      { title: 'Section', width: 110, value: (row) => row.section_name, maxChars: 22 },
      { title: 'Failed control', width: 190, value: (row) => row.item_text, maxChars: 38 },
      { title: 'Comment', width: 118, value: (row) => row.comment_text, maxChars: 24 },
      { title: 'Action', width: 160, value: (row) => row.recommended_action, maxChars: 32 }
    ], { maxRows: 28, subtitle: 'Detailed root-cause records imported from the report findings.' });
  }

  private toBlob() {
    const objects: string[] = [];
    objects.push('<< /Type /Catalog /Pages 2 0 R >>');
    const pageObjectNumbers = this.pages.map((_, index) => 5 + index * 2);
    objects.push(`<< /Type /Pages /Kids [${pageObjectNumbers.map((num) => `${num} 0 R`).join(' ')}] /Count ${this.pages.length} >>`);
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
    objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

    this.pages.forEach((page, pageIndex) => this.footer(pageIndex));

    this.pages.forEach((page, pageIndex) => {
      const pageObjectNumber = 5 + pageIndex * 2;
      const contentObjectNumber = pageObjectNumber + 1;
      const content = page.commands.join('\n');
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjectNumber} 0 R >>`);
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    });

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xrefStart = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach((offset) => {
      pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
    });
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }
}

function buildManagementReportPdf(report: Record<string, unknown>) {
  return new ProfessionalPdf(report).build();
}

export function AIAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [searchText, setSearchText] = useState('');
  const [locationsMl, setLocationsMl] = useState<AdvancedLocation[]>([]);
  const [explanations, setExplanations] = useState<ExplanationRow[]>([]);
  const [predictions, setPredictions] = useState<PredictiveRow[]>([]);
  const [clientDashboards, setClientDashboards] = useState<ClientDashboardRow[]>([]);
  const [locationBenchmarks, setLocationBenchmarks] = useState<BenchmarkLocationRow[]>([]);
  const [categoryBenchmarks, setCategoryBenchmarks] = useState<BenchmarkCategoryRow[]>([]);
  const [sectionBenchmarks, setSectionBenchmarks] = useState<BenchmarkSectionRow[]>([]);
  const [categoryRows, setCategoryRows] = useState<CategoryRow[]>([]);
  const [sectionRows, setSectionRows] = useState<SectionRow[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItemRow[]>([]);
  const [repeatedIssues, setRepeatedIssues] = useState<RepeatedIssueRow[]>([]);
  const [actionRows, setActionRows] = useState<ActionRow[]>([]);
  const [rawAudits, setRawAudits] = useState<RawAuditRow[]>([]);
  const [rawCompletions, setRawCompletions] = useState<RawCompletionRow[]>([]);
  const [managementExport, setManagementExport] = useState<Record<string, unknown> | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>(useMockData ? seedInsights : []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAnalytics() {
    if (useMockData || !supabase) return;
    setIsLoading(true);
    try {
      const [mlResult, explanationResult, predictionResult, clientResult, locationBenchmarkResult, categoryBenchmarkResult, sectionBenchmarkResult, categoryResult, sectionResult, failedResult, repeatedResult, actionResult, auditsResult, completionResult, insightsResult, exportResult] = await Promise.all([
        supabase.from('v_advanced_report_location_analytics').select('*').eq('organization_id', organizationId).order('risk_score', { ascending: false }).limit(100),
        supabase.from('v_ml_explanation_driver_breakdown').select('*').eq('organization_id', organizationId).order('impact_points', { ascending: false }).limit(300),
        supabase.from('v_predictive_location_risk').select('*').eq('organization_id', organizationId).order('predicted_next_risk_score', { ascending: false }).limit(100),
        supabase.from('v_client_company_dashboard').select('*').eq('organization_id', organizationId).limit(10),
        supabase.from('v_location_benchmarking').select('*').eq('organization_id', organizationId).order('risk_rank_high_to_low', { ascending: true }).limit(100),
        supabase.from('v_category_benchmarking').select('*').eq('organization_id', organizationId).order('category_failure_rank', { ascending: true }).limit(100),
        supabase.from('v_section_benchmarking').select('*').eq('organization_id', organizationId).order('weakest_section_rank', { ascending: true }).limit(100),
        supabase.from('v_advanced_report_category_analytics').select('*').eq('organization_id', organizationId).order('failed_item_count', { ascending: false }).limit(100),
        supabase.from('v_advanced_report_section_analytics').select('*').eq('organization_id', organizationId).order('avg_section_score_pct', { ascending: true }).limit(100),
        supabase.from('v_advanced_report_failed_items').select('*').eq('organization_id', organizationId).order('is_critical', { ascending: false }).order('completed_at', { ascending: false }).limit(250),
        supabase.from('v_advanced_report_repeated_issues').select('*').eq('organization_id', organizationId).order('repeat_count', { ascending: false }).limit(100),
        supabase.from('v_advanced_report_action_plan').select('*').eq('organization_id', organizationId).order('priority_rank', { ascending: true }).order('suggested_due_at', { ascending: true }).limit(150),
        supabase.from('audit_reports').select('audit_report_id,checklist_name,location_name_text,score_percentage,score_earned,score_total,instance_status,completed_at,submitted_by_name').eq('organization_id', organizationId).order('completed_at', { ascending: false }).limit(50),
        supabase.from('completion_rate_reports').select('completion_report_id,location_name_text,date_range_start,date_range_end,lists_completed_pct,lists_missed_pct,items_completed_pct,items_missed_pct').eq('organization_id', organizationId).order('date_range_end', { ascending: false }).limit(50),
        supabase.from('ai_insights').select('insight_id,module,title,summary,recommendation,severity,confidence,status,location_id,entity_reference,evidence,generated_at,created_at').eq('organization_id', organizationId).order('generated_at', { ascending: false }).limit(50),
        supabase.rpc('get_management_report_export', { p_organization_id: organizationId, p_period_start: reportPeriodStart, p_period_end: reportPeriodEnd })
      ]);

      const firstError = mlResult.error || explanationResult.error || predictionResult.error || clientResult.error || locationBenchmarkResult.error || categoryBenchmarkResult.error || sectionBenchmarkResult.error || categoryResult.error || sectionResult.error || failedResult.error || repeatedResult.error || actionResult.error || auditsResult.error || completionResult.error || insightsResult.error || exportResult.error;
      if (firstError) {
        setMessage(`Advanced v2 analytics are not ready: ${firstError.message}. Run advanced_ml_v2_explanation_predictive_dashboard_export_benchmarking.sql in Supabase.`);
        return;
      }

      setLocationsMl((mlResult.data ?? []) as AdvancedLocation[]);
      setExplanations((explanationResult.data ?? []) as ExplanationRow[]);
      setPredictions((predictionResult.data ?? []) as PredictiveRow[]);
      setClientDashboards((clientResult.data ?? []) as ClientDashboardRow[]);
      setLocationBenchmarks((locationBenchmarkResult.data ?? []) as BenchmarkLocationRow[]);
      setCategoryBenchmarks((categoryBenchmarkResult.data ?? []) as BenchmarkCategoryRow[]);
      setSectionBenchmarks((sectionBenchmarkResult.data ?? []) as BenchmarkSectionRow[]);
      setCategoryRows((categoryResult.data ?? []) as CategoryRow[]);
      setSectionRows((sectionResult.data ?? []) as SectionRow[]);
      setFailedItems((failedResult.data ?? []) as FailedItemRow[]);
      setRepeatedIssues((repeatedResult.data ?? []) as RepeatedIssueRow[]);
      setActionRows((actionResult.data ?? []) as ActionRow[]);
      setRawAudits((auditsResult.data ?? []) as RawAuditRow[]);
      setRawCompletions((completionResult.data ?? []) as RawCompletionRow[]);
      setInsights((insightsResult.data ?? []).map((row) => mapSupabaseInsight(row as Record<string, unknown>)));
      setManagementExport((exportResult.data ?? null) as Record<string, unknown> | null);

      const rowCount = (mlResult.data?.length ?? 0) + (auditsResult.data?.length ?? 0) + (completionResult.data?.length ?? 0);
      setMessage(rowCount ? null : `Supabase connected, but no imported report data was found for organization ${organizationId}. Run the seed/import SQL first.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Advanced analytics failed to load.');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadAnalytics();
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

      const { data, error } = await supabase.rpc('run_advanced_report_ml_v2', {
        p_organization_id: organizationId,
        p_period_start: reportPeriodStart,
        p_period_end: reportPeriodEnd
      });

      if (error) {
        const fallback = await supabase.rpc('run_advanced_report_ml', {
          p_organization_id: organizationId,
          p_period_start: reportPeriodStart,
          p_period_end: reportPeriodEnd
        });
        if (fallback.error) {
          const edgeResult = await invokeAIGenerateInsights({ organization_id: organizationId, run_type: 'manual' });
          setMessage(`Fallback ML completed. Rows scored: ${edgeResult?.rows_scored ?? 0}. Insights created: ${edgeResult?.insights_created ?? 0}. Run the v2 SQL for explanation and predictive risk.`);
        } else {
          setMessage(`Advanced ML completed. Rows scored: ${Array.isArray(fallback.data) ? fallback.data.length : 0}. Run v2 SQL for explanation and predictive analytics.`);
        }
      } else {
        setMessage(`Advanced ML v2 calculated ${Array.isArray(data) ? data.length : 0} location prediction(s) for ${reportPeriodStart} to ${reportPeriodEnd}.`);
      }
      await loadAnalytics();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Advanced ML failed.');
    } finally {
      setIsGenerating(false);
    }
  }

  function downloadManagementReport() {
    if (!managementExport) return;
    const blob = buildManagementReportPdf(managementExport);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `incheck360-management-report-${organizationId}-${reportPeriodStart}-${reportPeriodEnd}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const filteredInsights = useMemo(
    () => severityFilter === 'all' ? insights : insights.filter((insight) => insight.severity === severityFilter),
    [severityFilter, insights]
  );

  const search = searchText.trim().toLowerCase();
  const filteredFailedItems = failedItems.filter((row) => !search || `${row.location_name} ${row.item_text} ${row.section_name} ${row.risk_category} ${row.comment_text}`.toLowerCase().includes(search));
  const filteredActions = actionRows.filter((row) => !search || `${row.location_name} ${row.action_title} ${row.risk_category} ${row.recommended_action}`.toLowerCase().includes(search));
  const filteredExplanations = explanations.filter((row) => !search || `${row.location_name} ${row.driver_label} ${row.driver_group} ${row.explanation}`.toLowerCase().includes(search));

  const avgRisk = locationsMl.length ? locationsMl.reduce((sum, row) => sum + Number(row.risk_score ?? 0), 0) / locationsMl.length : null;
  const avgHealth = locationsMl.length ? locationsMl.reduce((sum, row) => sum + Number(row.health_score ?? 0), 0) / locationsMl.length : null;
  const criticalLocations = locationsMl.filter((row) => row.risk_level === 'critical').length;
  const totalFailed = locationsMl.reduce((sum, row) => sum + Number(row.failed_item_count ?? 0), 0);
  const totalCritical = locationsMl.reduce((sum, row) => sum + Number(row.critical_failed_item_count ?? 0), 0);
  const topLocation = locationsMl[0];
  const topPrediction = predictions[0];
  const topDriver = explanations[0];
  const clientDashboard = clientDashboards[0];

  return (
    <div className="page-stack">
      <section className="hero-card ai-hero">
        <div>
          <p className="eyebrow">Advanced internal ML v2</p>
          <h2>Explainable ML, predictive risk, management reporting, and benchmarking.</h2>
          <p>Reads imported audit and completion reports from Supabase, explains risk drivers, predicts future risk, benchmarks locations, and exports a management report. No OpenAI API is used.</p>
        </div>
        <button className="primary-button" onClick={runAdvancedMl} disabled={isGenerating}><Sparkles size={17} /> {isGenerating ? 'Calculating...' : 'Run Advanced ML v2'}</button>
      </section>

      {message && <section className="notice-card">{message}</section>}
      {isLoading && <section className="notice-card">Loading advanced analytics from Supabase...</section>}

      <section className="metric-grid three">
        <MetricCard title="Avg risk" value={avgRisk === null ? '—' : `${num(avgRisk)}/100`} hint="Internal ML risk" icon={<Brain />} tone="warning" />
        <MetricCard title="Avg health" value={avgHealth === null ? '—' : `${num(avgHealth)}/100`} hint="100 - risk score" icon={<Target />} tone="success" />
        <MetricCard title="Predicted top risk" value={topPrediction ? `${num(topPrediction.predicted_next_risk_score)}/100` : '—'} hint={topPrediction?.location_name ?? 'Next audit prediction'} icon={<TrendingUp />} tone="danger" />
      </section>

      <section className="metric-grid three">
        <MetricCard title="Critical locations" value={criticalLocations} hint="Risk level critical" icon={<AlertTriangle />} tone="danger" />
        <MetricCard title="Failed items" value={totalFailed} hint={`${totalCritical} critical`} icon={<ClipboardCheck />} tone="danger" />
        <MetricCard title="Top ML driver" value={topDriver?.driver_label ?? '—'} hint={`${num(topDriver?.impact_points)} impact points`} icon={<Layers />} tone="warning" />
      </section>

      <section className="toolbar-card">
        <div className="row gap-sm wrap">{tabs.map((tab) => <button key={tab.id} className={`filter-button ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}</div>
        <div className="search-box"><Search size={18} /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search details..." /></div>
      </section>

      {activeTab === 'overview' && (
        <div className="two-column">
          <section className="card"><div className="section-header"><div><p className="eyebrow">Executive summary</p><h2>Where management should focus</h2></div><Brain size={20} /></div><div className="stack-list"><article className="list-card"><h3>Highest current risk</h3><p>{topLocation?.location_name ?? 'No location data yet'}</p><span className={`severity-badge ${severityClass(topLocation?.risk_level)}`}>{topLocation?.risk_level ?? '—'} · {num(topLocation?.risk_score)}/100</span></article><article className="list-card"><h3>Highest predicted risk</h3><p>{topPrediction?.location_name ?? 'No prediction yet'}</p><span className={`severity-badge ${severityClass(topPrediction?.predicted_risk_level)}`}>{topPrediction?.predicted_risk_level ?? '—'} · {topPrediction?.recommended_visit_window ?? '—'}</span></article><article className="list-card"><h3>Main ML driver</h3><p>{topDriver ? `${topDriver.driver_label}: ${topDriver.explanation}` : 'Run Advanced ML v2 after installing the SQL.'}</p><span className="muted-text">Impact: {num(topDriver?.impact_points)} points</span></article></div></section>
          <section className="card"><div className="section-header"><div><p className="eyebrow">Priority actions</p><h2>Top action plan</h2></div><ListChecks size={20} /></div><div className="stack-list">{actionRows.slice(0, 5).map((action) => <ActionCard key={action.action_reference} action={action} />)}{!actionRows.length && <span className="muted-text">No action plan generated yet.</span>}</div></section>
        </div>
      )}

      {activeTab === 'client' && <><section className="metric-grid three"><MetricCard title="Locations" value={clientDashboard?.location_count ?? '—'} hint="Imported report locations" icon={<Building2 />} /><MetricCard title="Open actions" value={clientDashboard?.open_action_count ?? '—'} hint={`${clientDashboard?.high_priority_action_count ?? 0} high priority`} icon={<ListChecks />} tone="warning" /><MetricCard title="Top category" value={clientDashboard?.top_risk_category ?? '—'} hint={`${clientDashboard?.top_category_failures ?? 0} failures`} icon={<Layers />} tone="danger" /></section><DataTable rows={clientDashboards} empty="No client/company dashboard rows found." columns={[["Company", (r: ClientDashboardRow) => <><strong>{r.company_name ?? r.organization_id}</strong><span>{r.organization_id}</span></>], ["Reports", (r) => `${r.audit_report_count ?? 0} audits / ${r.completion_report_count ?? 0} completion`], ["Avg risk", (r) => `${num(r.avg_risk_score)}/100`], ["Avg health", (r) => `${num(r.avg_health_score)}/100`], ["Risk locations", (r) => `${r.critical_location_count ?? 0} critical / ${r.high_risk_location_count ?? 0} high`], ["Failures", (r) => `${r.total_failed_items ?? 0} failed / ${r.total_critical_failures ?? 0} critical`], ["Repeated", (r) => `${r.total_repeated_issues ?? 0}`], ["Missed", (r) => `Lists ${pct(r.avg_lists_missed_pct)} / Items ${pct(r.avg_items_missed_pct)}`]]} /></>}
      {activeTab === 'locations' && <DataTable rows={locationsMl} empty="No location ML rows found." columns={[["Location", (r: AdvancedLocation) => <><strong>{r.location_name ?? '—'}</strong><span>{r.audit_report_count ?? 0} audit / {r.completion_report_count ?? 0} completion</span></>], ["Risk", (r) => <><span className={`severity-badge ${severityClass(r.risk_level)}`}>{r.risk_level ?? 'low'}</span><strong>{num(r.risk_score)}/100</strong></>], ["Health", (r) => `${num(r.health_score)}/100`], ["Audit", (r) => pct(r.avg_audit_score_pct)], ["Failed", (r) => `${r.failed_item_count ?? 0} (${r.critical_failed_item_count ?? 0} critical)`], ["Completion Missed", (r) => `Lists ${pct(r.avg_lists_missed_pct)} / Items ${pct(r.avg_items_missed_pct)}`], ["Confidence", (r) => pct(Number(r.confidence ?? 0) * 100)]]} />}
      {activeTab === 'explanation' && <DataTable rows={filteredExplanations} empty="No ML explanations found. Run the v2 SQL and ML." columns={[["Location", (r: ExplanationRow) => <><strong>{r.location_name ?? '—'}</strong><span>Risk {num(r.risk_score)}/100</span></>], ["Driver", (r) => <><strong>{r.driver_label}</strong><span>{r.driver_group}</span></>], ["Actual value", (r) => num(r.actual_value)], ["Impact", (r) => <strong>{num(r.impact_points)} pts</strong>], ["Rank", (r) => `#${r.driver_rank ?? '—'}`], ["Explanation", (r) => r.explanation ?? '—']]} />}
      {activeTab === 'predictive' && <DataTable rows={predictions} empty="No predictive risk rows found." columns={[["Location", (r: PredictiveRow) => <><strong>{r.location_name ?? '—'}</strong><span>{r.trend_direction ?? 'stable'}</span></>], ["Current risk", (r) => `${num(r.current_risk_score)}/100`], ["Predicted risk", (r) => <><span className={`severity-badge ${severityClass(r.predicted_risk_level)}`}>{r.predicted_risk_level ?? '—'}</span><strong>{num(r.predicted_next_risk_score)}/100</strong></>], ["Predicted audit", (r) => pct(r.predicted_next_audit_score)], ["Delta", (r) => num(r.risk_delta)], ["Visit window", (r) => r.recommended_visit_window ?? '—'], ["Reason", (r) => r.prediction_reason ?? '—']]} />}
      {activeTab === 'benchmarking' && <div className="page-stack"><DataTable rows={locationBenchmarks} empty="No location benchmark rows found." columns={[["Location", (r: BenchmarkLocationRow) => <><strong>{r.location_name ?? '—'}</strong><span>Risk rank #{r.risk_rank_high_to_low ?? '—'}</span></>], ["Risk", (r) => `${num(r.risk_score)}/100`], ["Company avg", (r) => `${num(r.company_avg_risk_score)}/100`], ["Vs avg", (r) => num(r.risk_vs_company_avg)], ["Percentile", (r) => pct(r.risk_percentile)], ["Health rank", (r) => `#${r.health_rank_best_to_worst ?? '—'}`]]} /><DataTable rows={categoryBenchmarks} empty="No category benchmark rows found." columns={[["Category", (r: BenchmarkCategoryRow) => <strong>{r.risk_category ?? 'general'}</strong>], ["Rank", (r) => `#${r.category_failure_rank ?? '—'}`], ["Failed", (r) => `${r.total_failed_items ?? 0}`], ["Critical", (r) => `${r.total_critical_failed_items ?? 0}`], ["Locations", (r) => `${r.affected_location_count ?? 0}`], ["Avg score", (r) => pct(r.avg_item_score_pct)]]} /><DataTable rows={sectionBenchmarks} empty="No section benchmark rows found." columns={[["Section", (r: BenchmarkSectionRow) => <strong>{r.section_name ?? '—'}</strong>], ["Weak rank", (r) => `#${r.weakest_section_rank ?? '—'}`], ["Avg score", (r) => pct(r.avg_section_score_pct)], ["Min score", (r) => pct(r.min_section_score_pct)], ["Failed", (r) => `${r.failed_item_count ?? 0}`], ["Critical", (r) => `${r.critical_failed_item_count ?? 0}`], ["Locations", (r) => `${r.affected_location_count ?? 0}`]]} /></div>}
      {activeTab === 'categories' && <DataTable rows={categoryRows} empty="No category analytics found." columns={[["Category", (r: CategoryRow) => <><strong>{r.risk_category ?? 'general'}</strong><span>{r.location_name}</span></>], ["Risk", (r) => <span className={`severity-badge ${severityClass(r.category_risk_level)}`}>{r.category_risk_level ?? 'low'}</span>], ["Failures", (r) => `${r.failed_item_count ?? 0}`], ["Critical", (r) => `${r.critical_failed_item_count ?? 0}`], ["Audits", (r) => `${r.affected_audit_count ?? 0}`], ["Sections", (r) => `${r.affected_section_count ?? 0}`], ["Avg item score", (r) => pct(r.avg_item_score_pct)]]} />}
      {activeTab === 'sections' && <DataTable rows={sectionRows} empty="No section analytics found." columns={[["Section", (r: SectionRow) => <><strong>{r.section_name ?? '—'}</strong><span>{r.checklist_name} · {r.location_name}</span></>], ["Risk", (r) => <span className={`severity-badge ${severityClass(r.section_risk_level)}`}>{r.section_risk_level ?? 'low'}</span>], ["Avg score", (r) => pct(r.avg_section_score_pct)], ["Min score", (r) => pct(r.min_section_score_pct)], ["Failed", (r) => `${r.failed_item_count ?? 0}`], ["Critical", (r) => `${r.critical_failed_item_count ?? 0}`]]} />}
      {activeTab === 'failed' && <DataTable rows={filteredFailedItems} empty="No failed items found." columns={[["Failed item", (r: FailedItemRow) => <><strong>{r.item_text}</strong><span>{r.section_name} · {r.location_name}</span></>], ["Severity", (r) => <span className={`severity-badge ${severityClass(r.severity)}`}>{r.severity}</span>], ["Category", (r) => r.risk_category ?? 'general'], ["Score", (r) => `${num(r.score_earned)} / ${num(r.score_total)}`], ["Comment", (r) => r.comment_text ?? '—'], ["Recommended action", (r) => r.recommended_action ?? '—'], ["Due days", (r) => `${r.due_in_days ?? 7}`]]} />}
      {activeTab === 'repeated' && <DataTable rows={repeatedIssues} empty="No repeated issues found yet." columns={[["Repeated issue", (r: RepeatedIssueRow) => <><strong>{r.example_item_text}</strong><span>{r.location_name}</span></>], ["Level", (r) => <span className={`severity-badge ${severityClass(r.repeated_issue_level)}`}>{r.repeated_issue_level}</span>], ["Category", (r) => r.risk_category ?? 'general'], ["Repeat count", (r) => `${r.repeat_count ?? 0}`], ["Critical repeats", (r) => `${r.critical_repeat_count ?? 0}`], ["Sections", (r) => (r.affected_sections ?? []).join(', ') || '—']]} />}
      {activeTab === 'actions' && <DataTable rows={filteredActions} empty="No action plan rows found." columns={[["Action", (r: ActionRow) => <><strong>{r.action_title}</strong><span>{r.action_reference} · {r.location_name}</span></>], ["Priority", (r) => <span className={`severity-badge ${severityClass(r.severity)}`}>{r.severity}</span>], ["Category", (r) => r.risk_category ?? 'general'], ["Section", (r) => r.section_name ?? '—'], ["Recommendation", (r) => r.recommended_action ?? '—'], ["Due", (r) => date(r.suggested_due_at)], ["Evidence", (r) => r.evidence_required ? 'Required' : 'Optional']]} />}

      {activeTab === 'management' && (
        <section className="card">
          <div className="section-header">
            <div><p className="eyebrow">Management report export</p><h2>Executive PDF report</h2></div>
            <button className="primary-button" onClick={downloadManagementReport} disabled={!managementExport}><Download size={17} /> Download PDF</button>
          </div>
          <p className="muted-text">The export downloads a professional PDF with a cover page, KPI cards, sectioned tables, page headers, and page numbers.</p>
          {managementExport ? (
            <div className="mini-grid">
              <span><FileText size={15} /> Pro PDF ready</span>
              <span><Building2 size={15} /> {clientDashboard?.location_count ?? '—'} locations</span>
              <span><AlertTriangle size={15} /> {clientDashboard?.total_critical_failures ?? 0} critical failures</span>
              <span><ListChecks size={15} /> {clientDashboard?.open_action_count ?? 0} actions</span>
              <span><GitCompare size={15} /> Benchmarking included</span>
            </div>
          ) : (
            <span className="muted-text">No management report generated yet. Run Advanced ML v2 and refresh.</span>
          )}
        </section>
      )}

      {activeTab === 'insights' && (
        <>
          <section className="toolbar-card"><div className="row gap-sm wrap">{(['all', 'critical', 'high', 'medium', 'low'] as Array<'all' | Severity>).map((severity) => <button key={severity} className={`filter-button ${severityFilter === severity ? 'active' : ''}`} onClick={() => setSeverityFilter(severity)}>{severity}</button>)}</div></section>
          <section className="insights-grid">
            {filteredInsights.map((insight) => <AIInsightCard key={insight.id} insight={insight} />)}
            {!filteredInsights.length && actionRows.slice(0, 6).map((action) => (
              <article className="insight-card high" key={action.action_reference}>
                <div className="insight-header"><span className={`severity-badge ${severityClass(action.severity)}`}>{action.severity}</span><span className="pill muted">deterministic ML</span></div>
                <h3>{action.action_title}</h3>
                <p>{action.finding_comment || 'Imported report finding requires action.'}</p>
                <div className="recommendation-box"><Sparkles size={15} /> {action.recommended_action}</div>
                <div className="insight-footer"><span>{action.location_name}</span><span>Due {date(action.suggested_due_at)}</span></div>
              </article>
            ))}
          </section>
        </>
      )}
      {activeTab === 'raw' && <div className="two-column"><section className="card"><div className="section-header"><div><p className="eyebrow">Raw audit reports</p><h2>Imported audits</h2></div><Database size={20} /></div><SimpleRawAudit rows={rawAudits} /></section><section className="card"><div className="section-header"><div><p className="eyebrow">Raw completion reports</p><h2>Imported completion</h2></div><Database size={20} /></div><SimpleRawCompletion rows={rawCompletions} /></section></div>}
    </div>
  );
}

function DataTable<T>({ rows, columns, empty }: { rows: T[]; columns: Array<[string, (row: T) => ReactNode]>; empty: string }) {
  return <section className="card"><div className="table-wrap"><table><thead><tr>{columns.map(([label]) => <th key={label}>{label}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={index}>{columns.map(([label, render]) => <td key={label}>{render(row)}</td>)}</tr>)}{!rows.length && <tr><td colSpan={columns.length}>{empty}</td></tr>}</tbody></table></div></section>;
}

function ActionCard({ action }: { action: ActionRow }) {
  return <article className="list-card"><span className={`severity-badge ${severityClass(action.severity)}`}>{action.severity}</span><h3>{action.action_title}</h3><p>{action.recommended_action}</p><span className="muted-text">{action.location_name} · Due {date(action.suggested_due_at)}</span></article>;
}

function SimpleRawAudit({ rows }: { rows: RawAuditRow[] }) {
  return <div className="stack-list">{rows.map((row) => <article className="list-card" key={row.audit_report_id}><h3>{row.checklist_name}</h3><p>{row.location_name_text} · {pct(row.score_percentage)} · {row.instance_status}</p><span className="muted-text">{num(row.score_earned)} / {num(row.score_total)} · {row.submitted_by_name ?? '—'} · {date(row.completed_at)}</span></article>)}{!rows.length && <span className="muted-text">No raw audit rows.</span>}</div>;
}

function SimpleRawCompletion({ rows }: { rows: RawCompletionRow[] }) {
  return <div className="stack-list">{rows.map((row) => <article className="list-card" key={row.completion_report_id}><h3>{row.location_name_text ?? 'Completion report'}</h3><p>{date(row.date_range_start)} → {date(row.date_range_end)}</p><span className="muted-text">Lists completed {pct(row.lists_completed_pct)} · Missed {pct(row.lists_missed_pct)} · Items completed {pct(row.items_completed_pct)} · Items missed {pct(row.items_missed_pct)}</span></article>)}{!rows.length && <span className="muted-text">No raw completion rows.</span>}</div>;
}
