import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, Brain, ClipboardCheck, MapPin, Search, ShieldCheck } from 'lucide-react';
import { locations } from '../data/mockData';
import { getLocationRiskScore, getRiskLabel } from '../lib/analytics';
import { supabase, useMockData } from '../lib/supabase';
import type { Severity } from '../lib/types';

type AuditSummary = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  brand_name: string | null;
  checklist_name: string;
  score_percentage: number | null;
  score_earned: number | null;
  score_total: number | null;
  instance_status: string | null;
  completed_at: string | null;
};

type CompletionSummary = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  lists_completed_pct: number | null;
  lists_missed_pct: number | null;
  items_completed_pct: number | null;
  items_missed_pct: number | null;
};

type FailureSummary = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  failed_item_count: number | null;
  critical_failed_item_count: number | null;
  cross_contamination_failures: number | null;
  temperature_control_failures: number | null;
  labeling_failures: number | null;
};

type MlScore = {
  organization_id: string;
  location_id: string;
  location_name: string | null;
  risk_score: number | null;
  health_score: number | null;
  predicted_risk_level: Severity | null;
  confidence: number | null;
};

type LiveLocationRow = {
  location_id: string;
  location_name: string;
  brand_name: string;
  audit?: AuditSummary;
  completion?: CompletionSummary;
  failures?: FailureSummary;
  score?: MlScore;
};

const sampleOrgId = '10000000-0000-0000-0000-000000000001';
const emptyOrgId = '00000000-0000-0000-0000-000000000001';
const envOrganizationId = import.meta.env.VITE_ORGANIZATION_ID as string | undefined;
const organizationId = !envOrganizationId || envOrganizationId === emptyOrgId ? sampleOrgId : envOrganizationId;

function formatPct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return `${Number(value).toFixed(2)}%`;
}

function formatScore(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toFixed(2).replace(/\.00$/, '');
}

export function LocationsPage() {
  const [searchText, setSearchText] = useState('');
  const [liveLocations, setLiveLocations] = useState<LiveLocationRow[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    async function loadLiveLocations() {
      if (useMockData || !supabase) return;

      const [audits, completions, failures, scores] = await Promise.all([
        supabase.from('v_latest_audit_report_summary').select('*').eq('organization_id', organizationId).limit(50),
        supabase.from('v_latest_completion_rate_summary').select('*').eq('organization_id', organizationId).limit(50),
        supabase.from('v_location_compliance_failure_summary').select('*').eq('organization_id', organizationId).limit(50),
        supabase.from('v_latest_ml_report_scores').select('*').eq('organization_id', organizationId).limit(50)
      ]);

      const firstError = audits.error || completions.error || failures.error || scores.error;
      if (firstError) {
        setNotice(`Live locations could not load report tables: ${firstError.message}. Run the report-import SQL in Supabase.`);
        return;
      }

      const map = new Map<string, LiveLocationRow>();

      function ensureLocation(locationId: string, locationName: string | null | undefined, brandName?: string | null) {
        if (!map.has(locationId)) {
          map.set(locationId, {
            location_id: locationId,
            location_name: locationName || brandName || 'Unnamed location',
            brand_name: brandName || locationName || '—'
          });
        }
        return map.get(locationId)!;
      }

      ((audits.data ?? []) as AuditSummary[]).forEach((row) => {
        const entry = ensureLocation(row.location_id, row.location_name, row.brand_name);
        entry.audit = row;
      });

      ((completions.data ?? []) as CompletionSummary[]).forEach((row) => {
        const entry = ensureLocation(row.location_id, row.location_name);
        entry.completion = row;
      });

      ((failures.data ?? []) as FailureSummary[]).forEach((row) => {
        const entry = ensureLocation(row.location_id, row.location_name);
        entry.failures = row;
      });

      ((scores.data ?? []) as MlScore[]).forEach((row) => {
        const entry = ensureLocation(row.location_id, row.location_name);
        entry.score = row;
      });

      const rows = Array.from(map.values()).sort((a, b) => Number(b.score?.risk_score ?? 0) - Number(a.score?.risk_score ?? 0));
      setLiveLocations(rows);

      if (!rows.length) {
        setNotice(`Supabase is connected, but no report locations were found for organization ${organizationId}. Confirm VITE_ORGANIZATION_ID and run the report SQL.`);
      } else {
        setNotice(null);
      }
    }

    void loadLiveLocations();
  }, []);

  const filteredLiveLocations = useMemo(() => {
    const term = searchText.trim().toLowerCase();
    if (!term) return liveLocations;
    return liveLocations.filter((location) =>
      `${location.location_name} ${location.brand_name}`.toLowerCase().includes(term)
    );
  }, [liveLocations, searchText]);

  if (useMockData) {
    return (
      <div className="page-stack">
        <section className="notice-card">Mock prototype data is showing. Connect Supabase and redeploy to show imported report locations.</section>
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
                  <div><p className="eyebrow">{location.code}</p><h3>{location.name}</h3></div>
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
                <div className="location-footer"><span>Manager: {location.manager}</span><strong>{getRiskLabel(riskScore)} · {Math.round(riskScore)}</strong></div>
              </article>
            );
          })}
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack">
      {notice && <section className="notice-card">{notice}</section>}

      <section className="toolbar-card">
        <div className="search-box">
          <Search size={18} />
          <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search report location or brand..." />
        </div>
        <span className="pill muted">Live report locations</span>
      </section>

      <section className="location-grid">
        {filteredLiveLocations.map((location) => {
          const riskScore = Number(location.score?.risk_score ?? 0);
          const riskLevel = location.score?.predicted_risk_level ?? (riskScore >= 60 ? 'high' : riskScore >= 35 ? 'medium' : 'low');
          const auditScore = location.audit?.score_percentage ?? null;
          const itemCompletion = location.completion?.items_completed_pct ?? null;
          const criticalFailures = location.failures?.critical_failed_item_count ?? 0;
          const failedItems = location.failures?.failed_item_count ?? 0;

          return (
            <article className="card location-card" key={location.location_id}>
              <div className="section-header compact">
                <div>
                  <p className="eyebrow">{location.brand_name}</p>
                  <h3>{location.location_name}</h3>
                </div>
                <span className={`severity-badge ${riskLevel}`}>{riskLevel}</span>
              </div>

              <p className="muted-text"><MapPin size={15} /> Imported report data</p>

              <div className="progress-block">
                <div className="progress-label"><span>Audit score</span><strong>{formatPct(auditScore)}</strong></div>
                <div className="progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(auditScore ?? 0)))}%` }} /></div>
              </div>

              <div className="progress-block">
                <div className="progress-label"><span>Items completion</span><strong>{formatPct(itemCompletion)}</strong></div>
                <div className="progress"><span style={{ width: `${Math.max(0, Math.min(100, Number(itemCompletion ?? 0)))}%` }} /></div>
              </div>

              <div className="mini-grid">
                <span><ShieldCheck size={15} /> {formatPct(auditScore)}</span>
                <span><AlertTriangle size={15} /> {failedItems} failed</span>
                <span><Brain size={15} /> {formatScore(riskScore)}/100</span>
              </div>

              <div className="mini-grid single">
                <span><ClipboardCheck size={15} /> Critical failures: {criticalFailures}</span>
                <span><BarChart3 size={15} /> Lists missed: {formatPct(location.completion?.lists_missed_pct)}</span>
              </div>

              <div className="location-footer">
                <span>{location.audit?.checklist_name ?? 'Report location'}</span>
                <strong>Risk · {formatScore(riskScore)}</strong>
              </div>
            </article>
          );
        })}

        {!filteredLiveLocations.length && (
          <section className="notice-card">No report locations found. Run the report-import SQL and confirm the organization variable.</section>
        )}
      </section>
    </div>
  );
}
