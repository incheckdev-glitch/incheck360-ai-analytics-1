import type { AIInsight, CorrectiveAction, ExecutionTask, Incident, Location, Severity } from './types';

interface LocationFeatures {
  openTasks: number;
  overdueTasks: number;
  blockedTasks: number;
  criticalOpenTasks: number;
  highOpenTasks: number;
  openIncidents: number;
  criticalIncidents: number;
  highIncidents: number;
  foodSafetyIncidents: number;
  openCorrectiveActions: number;
  overdueCorrectiveActions: number;
  blockedCorrectiveActions: number;
  evidenceRequiredOpenActions: number;
  complianceScoreGap: number;
  taskCompletionGap: number;
}

interface Driver {
  label: string;
  contribution: number;
}

interface LocationScore {
  location: Location;
  features: LocationFeatures;
  riskScore: number;
  healthScore: number;
  severity: Severity;
  confidence: number;
  drivers: Driver[];
}

export function generateInternalMlInsights(
  locations: Location[],
  tasks: ExecutionTask[],
  incidents: Incident[],
  correctiveActions: CorrectiveAction[]
): AIInsight[] {
  const now = new Date().toISOString();
  const scores = locations.map((location) => scoreLocation(location, tasks, incidents, correctiveActions));

  const locationInsights = scores
    .filter((score) => score.severity !== 'low')
    .map((score, index) => toLocationInsight(score, now, index));

  const complianceInsights = scores
    .filter((score) => score.features.foodSafetyIncidents > 0 || score.features.evidenceRequiredOpenActions >= 2)
    .map((score, index) => toComplianceInsight(score, incidents, correctiveActions, now, index));

  return [...locationInsights, ...complianceInsights].sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity));
}

export function scoreLocation(
  location: Location,
  tasks: ExecutionTask[],
  incidents: Incident[],
  correctiveActions: CorrectiveAction[]
): LocationScore {
  const locationTasks = tasks.filter((task) => task.locationId === location.id && task.status !== 'done');
  const locationIncidents = incidents.filter((incident) => location.id === incident.locationId && incident.status !== 'closed' && incident.status !== 'resolved');
  const locationActions = correctiveActions.filter((action) => action.locationId === location.id && action.status !== 'done');

  const features: LocationFeatures = {
    openTasks: locationTasks.length,
    overdueTasks: locationTasks.filter((task) => task.status === 'overdue' || isPastDue(task.dueAt)).length,
    blockedTasks: locationTasks.filter((task) => task.status === 'blocked').length,
    criticalOpenTasks: locationTasks.filter((task) => task.priority === 'critical').length,
    highOpenTasks: locationTasks.filter((task) => task.priority === 'high').length,
    openIncidents: locationIncidents.length,
    criticalIncidents: locationIncidents.filter((incident) => incident.severity === 'critical').length,
    highIncidents: locationIncidents.filter((incident) => incident.severity === 'high').length,
    foodSafetyIncidents: locationIncidents.filter((incident) => incident.category.toLowerCase().includes('food')).length,
    openCorrectiveActions: locationActions.length,
    overdueCorrectiveActions: locationActions.filter((action) => action.status === 'overdue' || isPastDue(action.dueAt)).length,
    blockedCorrectiveActions: locationActions.filter((action) => action.status === 'blocked').length,
    evidenceRequiredOpenActions: locationActions.filter((action) => action.evidenceRequired).length,
    complianceScoreGap: Math.max(0, 90 - location.complianceScore),
    taskCompletionGap: Math.max(0, 95 - location.taskCompletionRate)
  };

  const drivers: Driver[] = [
    { label: 'Overdue tasks', contribution: features.overdueTasks * 12 },
    { label: 'Blocked tasks', contribution: features.blockedTasks * 18 },
    { label: 'Critical open tasks', contribution: features.criticalOpenTasks * 10 },
    { label: 'High open tasks', contribution: features.highOpenTasks * 7 },
    { label: 'Open incidents', contribution: features.openIncidents * 10 },
    { label: 'Critical incidents', contribution: features.criticalIncidents * 25 },
    { label: 'High incidents', contribution: features.highIncidents * 15 },
    { label: 'Overdue corrective actions', contribution: features.overdueCorrectiveActions * 14 },
    { label: 'Blocked corrective actions', contribution: features.blockedCorrectiveActions * 18 },
    { label: 'Evidence-required open actions', contribution: features.evidenceRequiredOpenActions * 6 },
    { label: 'Compliance score gap below 90', contribution: features.complianceScoreGap * 1.2 },
    { label: 'Task completion gap below 95', contribution: features.taskCompletionGap * 0.8 }
  ].filter((driver) => driver.contribution > 0)
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5);

  const riskScore = Math.min(100, Math.round(drivers.reduce((sum, driver) => sum + driver.contribution, 0)));
  const severity = severityFromScore(riskScore);
  const confidence = Math.min(0.95, Math.max(0.55, 0.62 + drivers.length * 0.05));

  return {
    location,
    features,
    riskScore,
    healthScore: 100 - riskScore,
    severity,
    confidence,
    drivers
  };
}

function toLocationInsight(score: LocationScore, generatedAt: string, index: number): AIInsight {
  return {
    id: `internal-ml-location-${score.location.id}-${index}`,
    module: 'locations',
    title: `${score.location.name} predicted as ${score.severity} operational risk`,
    summary: `Internal ML risk score is ${score.riskScore}/100. The location has ${score.features.openTasks} open tasks, ${score.features.openIncidents} open incidents, and ${score.features.openCorrectiveActions} open corrective actions.`,
    recommendation: recommendationForSeverity(score.severity),
    severity: score.severity,
    confidence: score.confidence,
    status: 'new',
    locationId: score.location.id,
    locationName: score.location.name,
    evidence: score.drivers.map((driver) => `${driver.label}: ${Math.round(driver.contribution)} risk points`),
    generatedAt
  };
}

function toComplianceInsight(
  score: LocationScore,
  incidents: Incident[],
  correctiveActions: CorrectiveAction[],
  generatedAt: string,
  index: number
): AIInsight {
  const locationIncidents = incidents.filter((incident) => incident.locationId === score.location.id && incident.status !== 'closed' && incident.status !== 'resolved');
  const locationActions = correctiveActions.filter((action) => action.locationId === score.location.id && action.status !== 'done');

  return {
    id: `internal-ml-compliance-${score.location.id}-${index}`,
    module: 'compliance',
    title: `Compliance evidence review needed at ${score.location.name}`,
    summary: `The internal model detected ${score.features.foodSafetyIncidents} food-safety incidents and ${score.features.evidenceRequiredOpenActions} evidence-required open actions.`,
    recommendation: 'Review evidence, assign a manager owner, and close the corrective action only after proof is uploaded.',
    severity: score.features.criticalIncidents > 0 ? 'critical' : 'high',
    confidence: Math.max(score.confidence, 0.84),
    status: 'new',
    locationId: score.location.id,
    locationName: score.location.name,
    evidence: [
      ...locationIncidents.slice(0, 3).map((incident) => `${incident.reference}: ${incident.title}`),
      ...locationActions.filter((action) => action.evidenceRequired).slice(0, 3).map((action) => `Evidence required: ${action.title}`)
    ],
    generatedAt
  };
}

function severityFromScore(score: number): Severity {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function severityWeight(severity: Severity) {
  return { low: 1, medium: 2, high: 3, critical: 4 }[severity];
}

function recommendationForSeverity(severity: Severity) {
  if (severity === 'critical') return 'Escalate today, assign a clear owner, and verify evidence before the next shift closes.';
  if (severity === 'high') return 'Schedule manager follow-up within 24 hours and clear overdue corrective actions first.';
  return 'Monitor during the next audit cycle and confirm that open tasks are progressing.';
}

function isPastDue(dateValue: string) {
  return new Date(dateValue).getTime() < Date.now();
}
