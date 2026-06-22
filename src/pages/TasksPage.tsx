import { CalendarClock, UserRound } from 'lucide-react';
import { tasks } from '../data/mockData';
import { formatDateTime } from '../lib/analytics';

const columns = [
  { id: 'todo', title: 'To do' },
  { id: 'in_progress', title: 'In progress' },
  { id: 'overdue', title: 'Overdue' },
  { id: 'done', title: 'Done' }
] as const;

export function TasksPage() {
  return (
    <div className="page-stack">
      <section className="kanban-grid">
        {columns.map((column) => (
          <div className="kanban-column" key={column.id}>
            <div className="kanban-title">
              <h3>{column.title}</h3>
              <span>{tasks.filter((task) => task.status === column.id).length}</span>
            </div>
            {tasks.filter((task) => task.status === column.id).map((task) => (
              <article className="task-card" key={task.id}>
                <span className={`severity-badge ${task.priority}`}>{task.priority}</span>
                <h4>{task.title}</h4>
                <p>{task.locationName}</p>
                <div className="mini-grid single">
                  <span><UserRound size={15} /> {task.owner}</span>
                  <span><CalendarClock size={15} /> {formatDateTime(task.dueAt)}</span>
                </div>
                <div className="progress"><span style={{ width: `${task.completionPercent}%` }} /></div>
              </article>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
