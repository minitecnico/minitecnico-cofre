import { Wallet, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function MobileHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="md:hidden sticky top-0 z-20 bg-gradient-dark text-ink-50 px-4 py-3 flex items-center justify-between shadow-soft-md">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-9 h-9 bg-gradient-accent rounded-xl flex items-center justify-center shadow-soft flex-shrink-0">
          <Wallet className="w-4 h-4 text-ink-900" strokeWidth={2.5} />
        </div>
        <h1 className="font-display text-xl font-bold leading-none tracking-tight">Cofre</h1>
      </div>

      <button
        onClick={logout}
        className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-300 hover:bg-white/5 hover:text-negative transition-all duration-200"
        aria-label="Sair"
      >
        <LogOut className="w-5 h-5" />
      </button>
    </header>
  );
}
