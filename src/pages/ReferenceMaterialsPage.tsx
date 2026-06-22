import { BookOpen, FileCheck2, ShieldCheck } from 'lucide-react';

const materials = [
  {
    title: 'Food Safety SOP Library',
    category: 'SOP',
    description: 'Temperature control, hygiene procedures, receiving standards, allergen handling, and sanitation workflows.',
    icon: ShieldCheck
  },
  {
    title: 'Brand Standards Manual',
    category: 'Reference',
    description: 'Customer area setup, uniform standards, service scripts, opening and closing presentation requirements.',
    icon: BookOpen
  },
  {
    title: 'Audit Evidence Guide',
    category: 'Guide',
    description: 'Photo requirements, corrective action closure examples, escalation rules, and manager sign-off process.',
    icon: FileCheck2
  }
];

export function ReferenceMaterialsPage() {
  return (
    <div className="page-stack">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Knowledge base</p>
          <h2>Connect SOPs directly to checklist questions.</h2>
          <p>Each question can reference a specific SOP, so staff know what to do and managers can audit against the correct standard.</p>
        </div>
      </section>

      <section className="template-grid">
        {materials.map((material) => {
          const Icon = material.icon;
          return (
            <article className="card" key={material.title}>
              <div className="metric-icon"><Icon /></div>
              <p className="eyebrow">{material.category}</p>
              <h3>{material.title}</h3>
              <p>{material.description}</p>
              <button className="ghost-button">Open Material</button>
            </article>
          );
        })}
      </section>
    </div>
  );
}
