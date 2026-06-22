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

## Internal ML entities

- ai_model_runs
- internal_ml_feature_weights
- ai_entity_snapshots
- internal_ml_location_scores
- ai_insights
- ai_insight_feedback

## Intended flow

1. Admin creates checklist templates.
2. Tasks are scheduled by location, role, shift, or frequency.
3. Staff complete checklist submissions.
4. Failed answers can create incidents or corrective actions.
5. Internal ML reads operational data and generates location scores.
6. Internal ML creates explainable insights and recommendations.
7. Managers resolve insights and provide feedback.
8. Feedback improves feature weights and later predictive training.
