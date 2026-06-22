import type { AIInsight, ChecklistTemplate, CorrectiveAction, ExecutionTask, Incident, Location } from '../lib/types';

export const locations: Location[] = [
  {
    id: 'loc-001',
    code: 'DXB-001',
    name: 'Dubai Mall Flagship',
    brand: 'Demo Brand',
    region: 'UAE',
    city: 'Dubai',
    manager: 'Nadine Haddad',
    status: 'active',
    complianceScore: 94,
    taskCompletionRate: 97,
    openIncidents: 1,
    overdueActions: 0,
    lastAuditAt: '2026-06-20T10:00:00Z'
  },
  {
    id: 'loc-002',
    code: 'BEY-002',
    name: 'Beirut Central Kitchen',
    brand: 'Demo Brand',
    region: 'Lebanon',
    city: 'Beirut',
    manager: 'Omar Chatila',
    status: 'active',
    complianceScore: 76,
    taskCompletionRate: 81,
    openIncidents: 3,
    overdueActions: 2,
    lastAuditAt: '2026-06-17T09:00:00Z'
  },
  {
    id: 'loc-003',
    code: 'AMS-003',
    name: 'Amsterdam Central',
    brand: 'Demo Brand EU',
    region: 'Netherlands',
    city: 'Amsterdam',
    manager: 'Sanne De Vries',
    status: 'setup',
    complianceScore: 68,
    taskCompletionRate: 71,
    openIncidents: 0,
    overdueActions: 4,
    lastAuditAt: '2026-06-12T13:30:00Z'
  },
  {
    id: 'loc-004',
    code: 'RUH-004',
    name: 'Riyadh Boulevard',
    brand: 'Demo Brand KSA',
    region: 'KSA',
    city: 'Riyadh',
    manager: 'Faisal Al Saud',
    status: 'active',
    complianceScore: 88,
    taskCompletionRate: 91,
    openIncidents: 1,
    overdueActions: 1,
    lastAuditAt: '2026-06-19T14:15:00Z'
  }
];

export const checklistTemplates: ChecklistTemplate[] = [
  {
    id: 'chk-001',
    title: 'Opening Food Safety Checklist',
    category: 'Food Safety',
    targetRole: 'Shift Manager',
    shift: 'Opening',
    frequency: 'Daily',
    estimatedMinutes: 12,
    active: true,
    version: 3,
    questions: [
      {
        id: 'q-001',
        title: 'Cold room temperature is between 0°C and 5°C',
        type: 'temperature',
        required: true,
        minValue: 0,
        maxValue: 5,
        requiresPhotoOnFail: true,
        sopReference: 'SOP-FS-001'
      },
      {
        id: 'q-002',
        title: 'Handwash stations are stocked with soap and paper towels',
        type: 'yes_no',
        required: true,
        requiresPhotoOnFail: true,
        sopReference: 'SOP-HYG-004'
      },
      {
        id: 'q-003',
        title: 'Opening manager signature',
        type: 'signature',
        required: true
      }
    ]
  },
  {
    id: 'chk-002',
    title: 'Closing Cleanliness Checklist',
    category: 'Cleanliness',
    targetRole: 'Supervisor',
    shift: 'Closing',
    frequency: 'Daily',
    estimatedMinutes: 15,
    active: true,
    version: 2,
    questions: [
      {
        id: 'q-004',
        title: 'All food contact surfaces sanitized',
        type: 'yes_no',
        required: true,
        requiresPhotoOnFail: true
      },
      {
        id: 'q-005',
        title: 'Waste area cleaned and locked',
        type: 'yes_no',
        required: true,
        requiresPhotoOnFail: true
      }
    ]
  },
  {
    id: 'chk-003',
    title: 'Brand Standards Audit',
    category: 'Brand Standards',
    targetRole: 'Area Manager',
    shift: 'Any',
    frequency: 'Weekly',
    estimatedMinutes: 35,
    active: true,
    version: 5,
    questions: [
      {
        id: 'q-006',
        title: 'Uniform and grooming standards met',
        type: 'yes_no',
        required: true,
        requiresPhotoOnFail: true
      },
      {
        id: 'q-007',
        title: 'Customer area photo evidence',
        type: 'photo',
        required: true
      },
      {
        id: 'q-008',
        title: 'Overall audit notes',
        type: 'text',
        required: false
      }
    ]
  }
];

export const tasks: ExecutionTask[] = [
  {
    id: 'task-001',
    title: 'Complete opening food safety checklist',
    locationId: 'loc-001',
    locationName: 'Dubai Mall Flagship',
    checklistTemplateId: 'chk-001',
    checklistTitle: 'Opening Food Safety Checklist',
    owner: 'Nadine Haddad',
    dueAt: '2026-06-22T08:00:00Z',
    status: 'done',
    priority: 'medium',
    completionPercent: 100
  },
  {
    id: 'task-002',
    title: 'Verify corrective action photos',
    locationId: 'loc-002',
    locationName: 'Beirut Central Kitchen',
    owner: 'Omar Chatila',
    dueAt: '2026-06-22T16:00:00Z',
    status: 'overdue',
    priority: 'high',
    completionPercent: 40
  },
  {
    id: 'task-003',
    title: 'Run weekly brand standards audit',
    locationId: 'loc-003',
    locationName: 'Amsterdam Central',
    checklistTemplateId: 'chk-003',
    checklistTitle: 'Brand Standards Audit',
    owner: 'Sanne De Vries',
    dueAt: '2026-06-23T12:00:00Z',
    status: 'in_progress',
    priority: 'medium',
    completionPercent: 55
  },
  {
    id: 'task-004',
    title: 'Complete closing cleanliness checklist',
    locationId: 'loc-004',
    locationName: 'Riyadh Boulevard',
    checklistTemplateId: 'chk-002',
    checklistTitle: 'Closing Cleanliness Checklist',
    owner: 'Faisal Al Saud',
    dueAt: '2026-06-22T23:00:00Z',
    status: 'todo',
    priority: 'low',
    completionPercent: 0
  }
];

export const incidents: Incident[] = [
  {
    id: 'inc-001',
    reference: 'INC-2026-001',
    title: 'Cold room exceeded safe range',
    locationId: 'loc-002',
    locationName: 'Beirut Central Kitchen',
    category: 'Food Safety',
    severity: 'critical',
    status: 'investigating',
    reportedBy: 'Maya Khoury',
    reportedAt: '2026-06-21T11:25:00Z',
    summary: 'Cold room temperature logged at 9°C during opening checklist.',
    correctiveActionId: 'ca-001'
  },
  {
    id: 'inc-002',
    reference: 'INC-2026-002',
    title: 'Missing sanitizer concentration record',
    locationId: 'loc-004',
    locationName: 'Riyadh Boulevard',
    category: 'Compliance',
    severity: 'medium',
    status: 'open',
    reportedBy: 'Faisal Al Saud',
    reportedAt: '2026-06-20T17:30:00Z',
    summary: 'Sanitizer test record was skipped for two shifts.'
  },
  {
    id: 'inc-003',
    reference: 'INC-2026-003',
    title: 'Customer area brand standard deviation',
    locationId: 'loc-001',
    locationName: 'Dubai Mall Flagship',
    category: 'Brand Standards',
    severity: 'low',
    status: 'resolved',
    reportedBy: 'Area Manager',
    reportedAt: '2026-06-18T08:10:00Z',
    summary: 'Menu board was not updated during breakfast transition.'
  }
];

export const correctiveActions: CorrectiveAction[] = [
  {
    id: 'ca-001',
    title: 'Repair cold room sensor and upload verification photo',
    locationId: 'loc-002',
    locationName: 'Beirut Central Kitchen',
    owner: 'Maintenance Team',
    dueAt: '2026-06-21T18:00:00Z',
    status: 'overdue',
    severity: 'critical',
    evidenceRequired: true,
    source: 'INC-2026-001'
  },
  {
    id: 'ca-002',
    title: 'Retrain opening team on sanitizer concentration log',
    locationId: 'loc-004',
    locationName: 'Riyadh Boulevard',
    owner: 'Faisal Al Saud',
    dueAt: '2026-06-24T12:00:00Z',
    status: 'todo',
    severity: 'medium',
    evidenceRequired: false,
    source: 'INC-2026-002'
  },
  {
    id: 'ca-003',
    title: 'Upload updated setup photos before launch',
    locationId: 'loc-003',
    locationName: 'Amsterdam Central',
    owner: 'Sanne De Vries',
    dueAt: '2026-06-19T12:00:00Z',
    status: 'overdue',
    severity: 'high',
    evidenceRequired: true,
    source: 'Setup Audit'
  }
];

export const aiInsights: AIInsight[] = [
  {
    id: 'ai-001',
    module: 'compliance',
    title: 'Critical food safety risk at Beirut Central Kitchen',
    summary: 'The location has a critical cold room incident and an overdue corrective action tied to food safety controls.',
    recommendation: 'Escalate to the operations manager, require photo evidence after repair, and schedule a re-audit within 24 hours.',
    severity: 'critical',
    confidence: 0.91,
    status: 'new',
    locationId: 'loc-002',
    locationName: 'Beirut Central Kitchen',
    evidence: ['Cold room temperature logged at 9°C', 'Corrective action CA-001 is overdue', 'Compliance score dropped to 76'],
    generatedAt: '2026-06-22T06:30:00Z'
  },
  {
    id: 'ai-002',
    module: 'tasks',
    title: 'Amsterdam setup may miss launch readiness',
    summary: 'The setup location has multiple overdue actions and a low task completion rate for a new site.',
    recommendation: 'Assign a launch owner and complete the setup photo evidence before activating the location.',
    severity: 'high',
    confidence: 0.84,
    status: 'seen',
    locationId: 'loc-003',
    locationName: 'Amsterdam Central',
    evidence: ['4 overdue actions', '71% task completion rate', 'Location is still in setup'],
    generatedAt: '2026-06-21T09:00:00Z'
  },
  {
    id: 'ai-003',
    module: 'checklists',
    title: 'Sanitizer log skipped repeatedly',
    summary: 'Riyadh Boulevard missed sanitizer concentration checks across two shifts, creating compliance exposure.',
    recommendation: 'Make the sanitizer question mandatory with photo evidence on failure and send a refresher task to the supervisor.',
    severity: 'medium',
    confidence: 0.78,
    status: 'new',
    locationId: 'loc-004',
    locationName: 'Riyadh Boulevard',
    evidence: ['Incident INC-2026-002', 'Two skipped shift records', 'Open corrective action CA-002'],
    generatedAt: '2026-06-20T18:00:00Z'
  }
];
