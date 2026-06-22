# Data Model

This platform is designed around operational execution.

## Core entities

- organizations
- locations
- user_profiles
- checklist_templates
- checklist_questions
- execution_tasks
- checklist_submissions
- checklist_answers
- incidents
- corrective_actions
- reference_materials

## AI entities

- ai_model_runs
- ai_entity_snapshots
- ai_insights
- ai_insight_feedback
- ai_knowledge_chunks

## Intended flow

1. Admin creates checklist templates.
2. Tasks are scheduled by location, role, shift, or frequency.
3. Staff complete checklist submissions.
4. Failed answers can create incidents or corrective actions.
5. AI reads operational data and generates insights.
6. Managers resolve insights and provide feedback.
7. Feedback improves future prompts and model evaluation.
