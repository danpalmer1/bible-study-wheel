import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Nav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-woodland-primary text-woodland-bg'
        : 'text-woodland-ink hover:bg-woodland-surface-2'
    }`;

  return (
    <header className="bg-woodland-surface border-b border-woodland-border">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          to="/wheel"
          className="font-serif text-lg font-semibold text-woodland-primary tracking-tight"
        >
          Bible Study Wheel
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/wheel" className={linkCls}>Wheel</NavLink>
          {user ? (
            <>
              <NavLink to="/stats" className={linkCls}>Stats</NavLink>
              {user.role === 'admin' && (
                <NavLink to="/admin" className={linkCls}>Admin</NavLink>
              )}
              <span className="px-3 text-sm text-woodland-muted hidden sm:inline">
                {user.name}
              </span>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="px-3 py-1.5 rounded-md text-sm text-woodland-muted hover:bg-woodland-surface-2 transition-colors"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login" className={linkCls}>Login</NavLink>
              <NavLink to="/signup" className={linkCls}>Sign up</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
