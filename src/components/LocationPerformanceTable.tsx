import { getLocationRiskScore, getRiskLabel, formatDate } from '../lib/analytics';
import type { Location } from '../lib/types';

interface LocationPerformanceTableProps {
  locations: Location[];
}

export function LocationPerformanceTable({ locations }: LocationPerformanceTableProps) {
  return (
    <section className="card">
      <div className="section-header">
        <div>
          <p className="eyebrow">Location performance</p>
          <h2>Operational health by location</h2>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Location</th>
              <th>Region</th>
              <th>Compliance</th>
              <th>Completion</th>
              <th>Open incidents</th>
              <th>Overdue actions</th>
              <th>Risk</th>
              <th>Last audit</th>
            </tr>
          </thead>
          <tbody>
            {locations.map((location) => {
              const riskScore = getLocationRiskScore(location);
              return (
                <tr key={location.id}>
                  <td>
                    <strong>{location.name}</strong>
                    <span>{location.code}</span>
                  </td>
                  <td>{location.region}</td>
                  <td>{location.complianceScore}%</td>
                  <td>{location.taskCompletionRate}%</td>
                  <td>{location.openIncidents}</td>
                  <td>{location.overdueActions}</td>
                  <td><span className="pill muted">{getRiskLabel(riskScore)} · {Math.round(riskScore)}</span></td>
                  <td>{formatDate(location.lastAuditAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
