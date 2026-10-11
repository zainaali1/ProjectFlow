import { ApiProvider } from './api/ApiContext';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/Toast';
import { EmptyState } from './components/ui';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { SchedulePage } from './pages/SchedulePage';
import { TasksPage } from './pages/TasksPage';
import { WorkersPage } from './pages/WorkersPage';
import { Link, useLocation } from './router';

function Page({ path }: { path: string }) {
  if (path === '/') return <DashboardPage />;
  if (path === '/projects') return <ProjectsPage />;
  const project = path.match(/^\/projects\/(\d+)$/);
  if (project) return <ProjectDetailPage id={Number(project[1])} />;
  if (path === '/tasks') return <TasksPage />;
  if (path === '/schedule') return <SchedulePage />;
  if (path === '/workers') return <WorkersPage />;
  return (
    <EmptyState title="Page not found" action={<Link to="/" className="btn btn-primary">Go to overview</Link>}>
      The address {path} does not match any page.
    </EmptyState>
  );
}

export function App() {
  const { path } = useLocation();
  return (
    <ApiProvider>
      <ToastProvider>
        <Layout path={path}>
          <Page key={path} path={path} />
        </Layout>
      </ToastProvider>
    </ApiProvider>
  );
}
