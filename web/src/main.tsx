import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AuthContext, type AuthApi } from './auth/AuthContext';
import './styles.css';

const root = createRoot(document.getElementById('root')!);

function render(auth: AuthApi) {
  root.render(
    <StrictMode>
      <AuthContext.Provider value={auth}>
        <App />
      </AuthContext.Provider>
    </StrictMode>,
  );
}

function renderMessage(title: string, message: string) {
  root.render(
    <div className="boot">
      <h1>{title}</h1>
      <p>{message}</p>
    </div>,
  );
}

async function boot() {
  if (import.meta.env.VITE_AUTH_MODE === 'dev') {
    // Local development without sign-in. The API must run with AUTH_MODE=dev too.
    render({ user: { name: 'Local Developer', username: 'dev@localhost' }, getToken: async () => null, signOut: () => undefined });
    return;
  }
  renderMessage('Signing you in…', 'Taking you to Microsoft sign-in.');
  try {
    const { startEntraAuth } = await import('./auth/entra');
    const auth = await startEntraAuth();
    if (auth) render(auth); // null = browser is being redirected to sign in
  } catch (err) {
    renderMessage('Sign-in failed', (err as Error).message);
  }
}

void boot();
