import { NavLink } from 'react-router-dom';
import { LayoutDashboard, ArrowDownCircle, ArrowUpCircle, CreditCard, Tag, LogOut, Wallet, Repeat, Settings } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/incomes', label: 'Receitas', icon: ArrowUpCircle },
  { to: '/expenses', label: 'Despesas', icon: ArrowDownCircle },
  { to: '/recurring', label: 'Recorrências', icon: Repeat },
  { to: '/cards', label: 'Cartões', icon: CreditCard },
  { to: '/categories', label: 'Categorias', icon: Tag },
  { to: '/settings', label: 'Ajustes', icon: Settings },
];

/**
 * Sidebar — visível apenas em telas md+ (≥768px).
 * Em mobile, a navegação é feita pelo BottomNav.
 */
export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex w-56 lg:w-64 min-h-screen bg-ink-900 text-ink-50 border-r-2 border-ink-900 flex-col sticky top-0">
      {/* Logo */}
      <div className="p-5 lg:p-6 border-b border-ink-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 lg:w-10 lg:h-10 bg-accent flex items-center justify-center border-2 border-ink-50 flex-shrink-0">
            <Wallet className="w-5 h-5 text-ink-900" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-xl lg:text-2xl font-bold leading-none tracking-tight">Cofre</h1>
            <p className="text-[10px] uppercase tracking-widest text-ink-300 mt-1 truncate">
              Controle financeiro
            </p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {links.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 font-medium text-sm transition-all ${
                isActive
                  ? 'bg-accent text-ink-900'
                  : 'text-ink-200 hover:bg-ink-800 hover:text-accent'
              }`
            }
          >
            <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-ink-800">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-accent text-ink-900 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-ink-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-ink-300 hover:bg-ink-800 hover:text-negative transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
    </aside>
  );
}
