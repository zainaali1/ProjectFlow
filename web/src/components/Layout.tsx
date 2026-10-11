import { useAuth } from '../auth/AuthContext';
import { Link } from '../router';

const icons = {
  overview: <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm8 0h8v-9h-8v9Zm0-16v5h8V4h-8Z" />,
  projects: <path d="M3 6.5A1.5 1.5 0 0 1 4.5 5H9l2 2h8.5A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5v-11Z" />,
  tasks: <path d="m4 7 2 2 3.5-3.5M4 15l2 2 3.5-3.5M13 8h7M13 16h7" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  schedule: <path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 8h4v3H8v-3Z" fill="none" strokeWidth="1.8" strokeLinecap="round" />,
  people: <path d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9c0-3.3 2.7-6 6-6s6 2.7 6 6H3Zm13.5-9a3 3 0 1 0 0-6M18 14c2.2.6 3.5 2.8 3.5 6" fill="none" strokeWidth="1.8" strokeLinecap="round" />,
};

const NAV: { to: string; label: string; icon: keyof typeof icons }[] = [
  { to: '/', label: 'Overview', icon: 'overview' },
  { to: '/projects', label: 'Projects', icon: 'projects' },
  { to: '/tasks', label: 'Tasks', icon: 'tasks' },
  { to: '/schedule', label: 'Schedule', icon: 'schedule' },
  { to: '/workers', label: 'People', icon: 'people' },
];

function NavIcon({ name }: { name: keyof typeof icons }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" className="nav-icon">
      {icons[name]}
    </svg>
  );
}

export function Layout({ path, children }: { path: string; children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const isActive = (to: string) => (to === '/' ? path === '/' : path.startsWith(to));
  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="ProjectFlow home">
          <span>ProjectFlow</span>
        </Link>
        <button className="topbar-me" onClick={signOut} title={`Signed in as ${user.name}. Select to sign out.`}>
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          Sign out
        </button>
      </header>
      <aside className="rail">
        <Link to="/" className="brand" aria-label="ProjectFlow home">
          <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <rect width="32" height="32" rx="7" fill="currentColor" opacity=".12" />
            <rect x="7" y="9" width="13" height="4" rx="2" fill="#E0A526" />
            <rect x="11" y="15" width="14" height="4" rx="2" fill="#7FC4B0" />
            <rect x="7" y="21" width="9" height="4" rx="2" fill="currentColor" />
          </svg>
          <span>ProjectFlow</span>
        </Link>
        <nav aria-label="Main">
          <ul className="nav">
            {NAV.map((n) => (
              <li key={n.to}>
                <Link to={n.to} className={`nav-link${isActive(n.to) ? ' active' : ''}`} aria-current={isActive(n.to) ? 'page' : undefined}>
                  <NavIcon name={n.icon} />
                  <span>{n.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="me">
          <span className="avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="me-text">
            <span className="me-name">{user.name}</span>
            <button className="link-btn" onClick={signOut}>
              Sign out
            </button>
          </span>
        </div>
      </aside>
      <main id="main" className="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
