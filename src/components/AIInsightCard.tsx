import { AlertCircle, CheckCircle2, Eye, Lightbulb, ThumbsDown, ThumbsUp, XCircle } from 'lucide-react';
import { formatDateTime } from '../lib/analytics';
import type { AIInsight } from '../lib/types';

interface AIInsightCardProps {
  insight: AIInsight;
}

export function AIInsightCard({ insight }: AIInsightCardProps) {
  return (
    <article className={`insight-card ${insight.severity}`}>
      <div className="insight-header">
        <div>
          <div className="row gap-sm wrap">
            <span className={`severity-badge ${insight.severity}`}>{insight.severity}</span>
            <span className="pill muted">{Math.round(insight.confidence * 100)}% confidence</span>
            <span className="pill muted">{insight.status}</span>
          </div>
          <h3>{insight.title}</h3>
          {insight.locationName && <p className="muted-text">{insight.locationName}</p>}
        </div>
        <AlertCircle size={22} />
      </div>

      <p>{insight.summary}</p>

      <div className="recommendation-box">
        <Lightbulb size={18} />
        <span>{insight.recommendation}</span>
      </div>

      <div className="evidence-list">
        <strong>Evidence</strong>
        {insight.evidence.map((item) => (
          <span key={item}>• {item}</span>
        ))}
      </div>

      <div className="insight-footer">
        <span>{formatDateTime(insight.generatedAt)}</span>
        <div className="row gap-sm wrap">
          <button className="ghost-button"><Eye size={15} /> Seen</button>
          <button className="ghost-button"><CheckCircle2 size={15} /> Resolve</button>
          <button className="ghost-button"><XCircle size={15} /> Dismiss</button>
          <button className="ghost-button"><ThumbsUp size={15} /> Useful</button>
          <button className="ghost-button"><ThumbsDown size={15} /> Incorrect</button>
        </div>
      </div>
    </article>
  );
}
