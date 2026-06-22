import { KeyRound, Shield, UsersRound } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="page-stack">
      <section className="card">
        <p className="eyebrow">Admin settings</p>
        <h2>Platform configuration</h2>
        <p>Configure organizations, roles, locations, schedules, checklist governance, and internal ML settings.</p>
      </section>

      <section className="template-grid">
        <article className="card">
          <div className="metric-icon"><UsersRound /></div>
          <h3>Roles and permissions</h3>
          <p>Admin, Operations Manager, Area Manager, Store Manager, Staff, Auditor, and Viewer.</p>
        </article>
        <article className="card">
          <div className="metric-icon"><Shield /></div>
          <h3>Compliance rules</h3>
          <p>Define escalation rules, due dates, photo proof requirements, and score thresholds.</p>
        </article>
        <article className="card">
          <div className="metric-icon"><KeyRound /></div>
          <h3>Internal ML configuration</h3>
          <p>Configure feature weights, score thresholds, escalation rules, and model runs. No OpenAI key is required.</p>
        </article>
      </section>
    </div>
  );
}
