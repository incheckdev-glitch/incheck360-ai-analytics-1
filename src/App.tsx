import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, BarChart3, BookOpen, Brain, Building2, CheckSquare, ClipboardCheck, Home, ListTodo, Settings } from 'lucide-react';
import { AIAnalyticsPage } from './pages/AIAnalyticsPage';
import { ChecklistsPage } from './pages/ChecklistsPage';
import { DashboardPage } from './pages/DashboardPage';
import { IncidentsPage } from './pages/IncidentsPage';
import { LocationsPage } from './pages/LocationsPage';
import { ReferenceMaterialsPage } from './pages/ReferenceMaterialsPage';
import { SettingsPage } from './pages/SettingsPage';
import { aiInsights, checklistTemplates, correctiveActions, incidents, locations, tasks } from './data/mockData';
import { calculateDashboardMetrics } from './lib/analytics';
import { useMockData } from './lib/supabase';

export type AppPage = 'dashboard' | 'locations' | 'checklists' | 'tasks' | 'incidents' | 'reference' | 'ai' | 'settings';

const navItems = [
  { id: 'dashboard' as const, label: 'Dashboard', icon: Home },
  { id: 'locations' as const, label: 'Locations', icon: Building2 },
  { id: 'checklists' as const, label: 'Checklists', icon: ClipboardCheck },
  { id: 'tasks' as const, label: 'Tasks', icon: ListTodo },
  { id: 'incidents' as const, label: 'Incidents', icon: AlertTriangle },
  { id: 'reference' as const, label: 'Reference Materials', icon: BookOpen },
  { id: 'ai' as const, label: 'AI Analytics', icon: Brain },
  { id: 'settings' as const, label: 'Settings', icon: Settings }
];

function App() {
  const [activePage, setActivePage] = useState<AppPage>('dashboard');
  const metrics = useMemo(
    () => calculateDashboardMetrics(locations, tasks, incidents, correctiveActions, aiInsights),
    []
  );

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage metrics={metrics} />;
      case 'locations':
        return <LocationsPage />;
      case 'checklists':
        return <ChecklistsPage templates={checklistTemplates} />;
      case 'tasks':
        return <TasksPage />;
      case 'incidents':
        return <IncidentsPage />;
      case 'reference':
        return <ReferenceMaterialsPage />;
      case 'ai':
        return <AIAnalyticsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage metrics={metrics} />;
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-block">
          <div className="brand-logo">
            <Activity size={24} />
          </div>
          <div>
            <strong>InCheck360</strong>
            <span>AI Analytics 1</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? 'active' : ''}`}
                onClick={() => setActivePage(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-card">
          <CheckSquare size={18} />
          <strong>{useMockData ? 'Mock mode' : 'Supabase connected'}</strong>
          <p>
            {useMockData
              ? 'Set Vercel Supabase variables and redeploy to use live data.'
              : 'Live database mode is enabled. Internal ML will use Supabase data.'}
          </p>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">Operations execution platform</p>
            <h1>{navItems.find((item) => item.id === activePage)?.label}</h1>
          </div>
          <div className="topbar-actions">
            <span className={`pill ${useMockData ? 'warning' : 'success'}`}>
              {useMockData ? 'Demo data' : 'Live Supabase'}
            </span>
            <button className="primary-button">Create Task</button>
          </div>
        </header>

        {renderPage()}
      </main>
    </div>
  );
}

export default App;
