import { useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, GraduationCap, Home } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="landing-wrap" style={{ minHeight: '100vh', justifyContent: 'center' }}>
      <main className="landing-main" style={{ textAlign: 'center', maxWidth: 540 }}>
        <div
          style={{
            display: 'inline-flex',
            padding: '16px',
            borderRadius: '50%',
            background: 'var(--surface-2)',
            color: 'var(--primary)',
            marginBottom: '16px',
          }}
        >
          <AlertCircle size={40} />
        </div>
        <h1 style={{ fontSize: '2rem', marginBottom: '8px' }}>404 · Page Not Found</h1>
        <p className="muted" style={{ marginBottom: '24px' }}>
          The page you are looking for does not exist or has been moved to a new route.
        </p>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn ghost" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} aria-hidden="true" />
            <span>Go Back</span>
          </button>
          <button className="btn light" onClick={() => navigate('/')}>
            <Home size={16} aria-hidden="true" />
            <span>Return to Home</span>
          </button>
          <button className="btn primary" onClick={() => navigate('/study')}>
            <GraduationCap size={16} aria-hidden="true" />
            <span>Open StudyVerse</span>
          </button>
        </div>
      </main>
    </div>
  );
}
