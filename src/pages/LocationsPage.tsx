import { MapPin, Search } from 'lucide-react';
import { locations } from '../data/mockData';
import { getLocationRiskScore, getRiskLabel } from '../lib/analytics';

export function LocationsPage() {
  return (
    <div className="page-stack">
      <section className="toolbar-card">
        <div className="search-box">
          <Search size={18} />
          <input placeholder="Search location, region, manager..." />
        </div>
        <button className="primary-button">Add Location</button>
      </section>

      <section className="location-grid">
        {locations.map((location) => {
          const riskScore = getLocationRiskScore(location);
          return (
            <article className="card location-card" key={location.id}>
              <div className="section-header compact">
                <div>
                  <p className="eyebrow">{location.code}</p>
                  <h3>{location.name}</h3>
                </div>
                <span className={`pill ${location.status === 'active' ? 'success' : 'muted'}`}>{location.status}</span>
              </div>
              <p className="muted-text"><MapPin size={15} /> {location.city}, {location.region}</p>
              <div className="progress-block">
                <div className="progress-label"><span>Compliance</span><strong>{location.complianceScore}%</strong></div>
                <div className="progress"><span style={{ width: `${location.complianceScore}%` }} /></div>
              </div>
              <div className="progress-block">
                <div className="progress-label"><span>Task completion</span><strong>{location.taskCompletionRate}%</strong></div>
                <div className="progress"><span style={{ width: `${location.taskCompletionRate}%` }} /></div>
              </div>
              <div className="location-footer">
                <span>Manager: {location.manager}</span>
                <strong>{getRiskLabel(riskScore)} · {Math.round(riskScore)}</strong>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
