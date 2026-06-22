import { useMemo, useState } from 'react';
import { Brain, Filter, Sparkles } from 'lucide-react';
import { AIInsightCard } from '../components/AIInsightCard';
import { MetricCard } from '../components/MetricCard';
import { aiInsights as seedInsights, correctiveActions, incidents, locations, tasks } from '../data/mockData';
import { generateInternalMlInsights } from '../lib/internalMl';
import { invokeAIGenerateInsights, useMockData } from '../lib/supabase';
import type { AIInsight, Severity } from '../lib/types';

const severities: Array<'all' | Severity> = ['all', 'critical', 'high', 'medium', 'low'];
const demoOrganizationId = '00000000-0000-0000-0000-000000000001';

export function AIAnalyticsPage() {
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [insights, setInsights] = useState<AIInsight[]>(seedInsights);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationMessage, setGenerationMessage] = useState<string | null>(null);

  const filteredInsights = useMemo(
    () => severityFilter === 'all' ? insights : insights.filter((insight) => insight.severity === severityFilter),
    [severityFilter, insights]
  );

  const criticalCount = insights.filter((insight) => insight.severity === 'critical').length;
  const highCount = insights.filter((insight) => insight.severity === 'high').length;
  const openCount = insights.filter((insight) => insight.status !== 'resolved').length;

  async function handleGenerateInsights() {
    setIsGenerating(true);
    setGenerationMessage(null);

    try {
      if (useMockData) {
        const generatedInsights = generateInternalMlInsights(locations, tasks, incidents, correctiveActions);
        setInsights(generatedInsights.length ? generatedInsights : seedInsights);
        setGenerationMessage(`Internal ML generated ${generatedInsights.length} insight(s) from local demo data. No OpenAI API was used.`);
        return;
      }

      const result = await invokeAIGenerateInsights({ organization_id: demoOrganizationId, run_type: 'manual' });
      setGenerationMessage(`Internal ML run completed. Rows scored: ${result.rows_scored ?? 0}. Insights created: ${result.insights_created ?? 0}.`);
    } catch (error) {
      setGenerationMessage(error instanceof Error ? error.message : 'Internal ML generation failed.');
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="hero-card ai-hero">
        <div>
          <p className="eyebrow">Internal ML analytics engine</p>
          <h2>Turn operational data into risk scores and next actions.</h2>
          <p>
            This version uses internal scoring models, feature weights, and rule-based predictions. It does not require OpenAI or any external AI API.
          </p>
        </div>
        <button className="primary-button" onClick={handleGenerateInsights} disabled={isGenerating}>
          <Sparkles size={17} /> {isGenerating ? 'Generating...' : 'Run Internal ML'}
        </button>
      </section>

      {generationMessage && <section className="notice-card">{generationMessage}</section>}

      <section className="metric-grid three">
        <MetricCard title="Critical" value={criticalCount} hint="Needs escalation" icon={<Brain />} tone="danger" />
        <MetricCard title="High risk" value={highCount} hint="Manager review" icon={<Filter />} tone="warning" />
        <MetricCard title="Open insights" value={openCount} hint="Not resolved yet" icon={<Sparkles />} tone="neutral" />
      </section>

      <section className="toolbar-card">
        <div className="row gap-sm wrap">
          {severities.map((severity) => (
            <button
              key={severity}
              className={`filter-button ${severityFilter === severity ? 'active' : ''}`}
              onClick={() => setSeverityFilter(severity)}
            >
              {severity}
            </button>
          ))}
        </div>
      </section>

      <section className="insights-grid">
        {filteredInsights.map((insight) => <AIInsightCard key={insight.id} insight={insight} />)}
      </section>
    </div>
  );
}
