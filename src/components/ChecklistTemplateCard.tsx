import { ClipboardCheck, Clock, GitBranch } from 'lucide-react';
import type { ChecklistTemplate } from '../lib/types';

interface ChecklistTemplateCardProps {
  template: ChecklistTemplate;
}

export function ChecklistTemplateCard({ template }: ChecklistTemplateCardProps) {
  return (
    <article className="card checklist-card">
      <div className="section-header compact">
        <div>
          <p className="eyebrow">{template.category}</p>
          <h3>{template.title}</h3>
        </div>
        <span className={`pill ${template.active ? 'success' : 'muted'}`}>{template.active ? 'Active' : 'Paused'}</span>
      </div>
      <div className="mini-grid">
        <span><ClipboardCheck size={16} /> {template.questions.length} questions</span>
        <span><Clock size={16} /> {template.estimatedMinutes} min</span>
        <span><GitBranch size={16} /> v{template.version}</span>
      </div>
      <p className="muted-text">{template.frequency} · {template.shift} · {template.targetRole}</p>
      <div className="question-preview">
        {template.questions.slice(0, 3).map((question) => (
          <span key={question.id}>• {question.title}</span>
        ))}
      </div>
    </article>
  );
}
