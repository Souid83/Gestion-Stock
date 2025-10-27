import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { setupFirstAdmin } from './lib/supabase.ts';
import { AuthRequired } from './components/Auth/AuthRequired';
import Login from './pages/Login';

// Try to set up first admin user
setupFirstAdmin().catch(console.error);

function AppWrapper() {
  const isLoginPage = window.location.pathname === '/login';

  if (isLoginPage) {
    return <Login />;
  }

  return (
    <AuthRequired>
      <App />
    </AuthRequired>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppWrapper />
    </BrowserRouter>
  </StrictMode>
);
