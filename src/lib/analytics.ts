import type { AIInsight, CorrectiveAction, DashboardMetrics, ExecutionTask, Incident, Location } from './types';

export function calculateDashboardMetrics(
  locations: Location[],
  tasks: ExecutionTask[],
  incidents: Incident[],
  actions: CorrectiveAction[],
  insights: AIInsight[]
): DashboardMetrics {
  const activeLocations = locations.filter((location) => location.status === 'active').length;
  const complianceScore = avg(locations.map((location) => location.complianceScore));
  const taskCompletionRate = avg(locations.map((location) => location.taskCompletionRate));
  const openIncidents = incidents.filter((incident) => incident.status !== 'closed' && incident.status !== 'resolved').length;
  const overdueActions = actions.filter((action) => action.status === 'overdue').length;
  const criticalInsights = insights.filter((insight) => insight.severity === 'critical' && insight.status !== 'resolved').length;

  return {
    locations: locations.length,
    activeLocations,
    complianceScore,
    taskCompletionRate,
    openIncidents,
    overdueActions,
    criticalInsights
  };
}

export function getRiskLabel(score: number): 'Healthy' | 'Watch' | 'At Risk' | 'Critical' {
  if (score >= 85) return 'Healthy';
  if (score >= 70) return 'Watch';
  if (score >= 55) return 'At Risk';
  return 'Critical';
}

export function getLocationRiskScore(location: Location): number {
  const incidentPenalty = Math.min(location.openIncidents * 6, 30);
  const overduePenalty = Math.min(location.overdueActions * 8, 32);
  const completionBoost = location.taskCompletionRate * 0.25;
  const complianceBoost = location.complianceScore * 0.75;
  return Math.max(0, Math.min(100, complianceBoost + completionBoost - incidentPenalty - overduePenalty));
}

function avg(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}
