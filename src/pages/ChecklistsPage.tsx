import { Plus, Search } from 'lucide-react';
import { ChecklistTemplateCard } from '../components/ChecklistTemplateCard';
import type { ChecklistTemplate } from '../lib/types';

interface ChecklistsPageProps {
  templates: ChecklistTemplate[];
}

export function ChecklistsPage({ templates }: ChecklistsPageProps) {
  return (
    <div className="page-stack">
      <section className="toolbar-card">
        <div className="search-box">
          <Search size={18} />
          <input placeholder="Search checklist template..." />
        </div>
        <button className="primary-button"><Plus size={17} /> New Template</button>
      </section>

      <section className="card builder-card">
        <div>
          <p className="eyebrow">Checklist builder</p>
          <h2>Create dynamic checklists with proof, scoring, and corrective actions.</h2>
          <p>
            Use yes/no, number, temperature, photo, text, signature, and conditional fields. Failed questions can automatically require photo evidence and create corrective actions.
          </p>
        </div>
      </section>

      <section className="template-grid">
        {templates.map((template) => <ChecklistTemplateCard key={template.id} template={template} />)}
      </section>
    </div>
  );
}
