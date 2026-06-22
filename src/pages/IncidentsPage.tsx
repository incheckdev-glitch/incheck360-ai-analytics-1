import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { correctiveActions, incidents } from '../data/mockData';
import { formatDateTime } from '../lib/analytics';

export function IncidentsPage() {
  return (
    <div className="page-stack two-column">
      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Incident log</p>
            <h2>Operational incidents</h2>
          </div>
          <AlertTriangle size={20} />
        </div>
        <div className="stack-list">
          {incidents.map((incident) => (
            <article className="list-card" key={incident.id}>
              <div className="row between wrap">
                <span className={`severity-badge ${incident.severity}`}>{incident.severity}</span>
                <span className="pill muted">{incident.status}</span>
              </div>
              <h3>{incident.title}</h3>
              <p>{incident.summary}</p>
              <span className="muted-text">{incident.reference} · {incident.locationName} · {formatDateTime(incident.reportedAt)}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Corrective actions</p>
            <h2>Follow-through tracker</h2>
          </div>
          <CheckCircle2 size={20} />
        </div>
        <div className="stack-list">
          {correctiveActions.map((action) => (
            <article className="list-card" key={action.id}>
              <div className="row between wrap">
                <span className={`severity-badge ${action.severity}`}>{action.severity}</span>
                <span className="pill muted">{action.status}</span>
              </div>
              <h3>{action.title}</h3>
              <p>{action.locationName}</p>
              <span className="muted-text">Owner: {action.owner} · Due: {formatDateTime(action.dueAt)}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
