import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useSpinLock } from '../spin/SpinLockContext';

export default function Nav() {
  const { user, logout } = useAuth();
  const { spinning } = useSpinLock();
  const navigate = useNavigate();

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-woodland-primary text-woodland-bg'
        : 'text-woodland-ink hover:bg-woodland-surface-2'
    } ${spinning ? 'pointer-events-none opacity-40' : ''}`;

  return (
    <header className="bg-woodland-surface border-b border-woodland-border">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link
          to="/wheel"
          tabIndex={spinning ? -1 : undefined}
          className={`font-serif text-lg font-semibold text-woodland-primary tracking-tight ${
            spinning ? 'pointer-events-none opacity-40' : ''
          }`}
        >
          Bible Study Wheel
        </Link>
        <nav className="flex items-center gap-1">
          <NavLink to="/wheel" className={linkCls} tabIndex={spinning ? -1 : undefined}>
            Wheel
          </NavLink>
          <NavLink to="/stats" className={linkCls} tabIndex={spinning ? -1 : undefined}>
            Stats
          </NavLink>
          {user && (
            <>
              {user.role === 'admin' && (
                <NavLink to="/admin" className={linkCls} tabIndex={spinning ? -1 : undefined}>
                  Admin
                </NavLink>
              )}
              <span className="px-3 text-sm text-woodland-muted hidden sm:inline">
                {user.name}
              </span>
              <button
                disabled={spinning}
                onClick={() => {
                  logout();
                  navigate('/admin-login');
                }}
                className="px-3 py-1.5 rounded-md text-sm text-woodland-muted hover:bg-woodland-surface-2 transition-colors disabled:opacity-40 disabled:pointer-events-none"
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
