export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type InsightStatus = 'new' | 'seen' | 'resolved' | 'dismissed';
export type LocationStatus = 'active' | 'paused' | 'setup';
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'overdue';
export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'closed';
export type QuestionType = 'yes_no' | 'number' | 'temperature' | 'text' | 'photo' | 'signature' | 'multi_select';

export interface Location {
  id: string;
  code: string;
  name: string;
  brand: string;
  region: string;
  city: string;
  manager: string;
  status: LocationStatus;
  complianceScore: number;
  taskCompletionRate: number;
  openIncidents: number;
  overdueActions: number;
  lastAuditAt: string;
}

export interface ChecklistQuestion {
  id: string;
  title: string;
  type: QuestionType;
  required: boolean;
  requiresPhotoOnFail?: boolean;
  minValue?: number;
  maxValue?: number;
  options?: string[];
  sopReference?: string;
}

export interface ChecklistTemplate {
  id: string;
  title: string;
  category: string;
  targetRole: string;
  shift: string;
  frequency: string;
  estimatedMinutes: number;
  active: boolean;
  version: number;
  questions: ChecklistQuestion[];
}

export interface ExecutionTask {
  id: string;
  title: string;
  locationId: string;
  locationName: string;
  checklistTemplateId?: string;
  checklistTitle?: string;
  owner: string;
  dueAt: string;
  status: TaskStatus;
  priority: Severity;
  completionPercent: number;
}

export interface Incident {
  id: string;
  reference: string;
  title: string;
  locationId: string;
  locationName: string;
  category: string;
  severity: Severity;
  status: IncidentStatus;
  reportedBy: string;
  reportedAt: string;
  summary: string;
  correctiveActionId?: string;
}

export interface CorrectiveAction {
  id: string;
  title: string;
  locationId: string;
  locationName: string;
  owner: string;
  dueAt: string;
  status: TaskStatus;
  severity: Severity;
  evidenceRequired: boolean;
  source: string;
}

export interface AIInsight {
  id: string;
  module: 'locations' | 'checklists' | 'tasks' | 'incidents' | 'corrective_actions' | 'compliance';
  title: string;
  summary: string;
  recommendation: string;
  severity: Severity;
  confidence: number;
  status: InsightStatus;
  locationId?: string;
  locationName?: string;
  evidence: string[];
  generatedAt: string;
}

export interface DashboardMetrics {
  locations: number;
  activeLocations: number;
  complianceScore: number;
  taskCompletionRate: number;
  openIncidents: number;
  overdueActions: number;
  criticalInsights: number;
}
