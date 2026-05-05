import { Settings as SettingsIcon, LogOut, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * Página de Ajustes — versão minimalista.
 * Só info da conta + sair. Sem backup, sem preferências (alinhado ao
 * estilo "minimalista e smart" do app).
 */
export default function Settings() {
  const { user, logout } = useAuth();

  return (
    <div className="space-y-4 md:space-y-6 max-w-2xl">
      <div>
        <p className="text-[10px] md:text-xs uppercase tracking-widest text-ink-500 font-semibold">
          Configurações
        </p>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mt-1 leading-tight tracking-tight flex items-center gap-2 md:gap-3">
          <SettingsIcon className="w-7 h-7 md:w-10 md:h-10 flex-shrink-0" strokeWidth={2.25} />
          <span>Ajustes</span>
        </h1>
      </div>

      {/* Conta */}
      <div className="card-flat p-5 md:p-6">
        <h3 className="font-display text-lg md:text-xl font-bold mb-4 tracking-tight">Sua conta</h3>

        <div className="flex items-center gap-4 mb-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-accent flex items-center justify-center font-display text-2xl font-bold text-ink-900 shadow-soft">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold text-ink-900 truncate">{user?.name}</p>
            <p className="text-sm text-ink-500 truncate">{user?.email}</p>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t border-ink-100">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
            <UserIcon className="w-4 h-4 text-ink-400" strokeWidth={2} />
            <span className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold w-16">
              Nome
            </span>
            <span className="text-sm font-semibold text-ink-900 truncate">{user?.name}</span>
          </div>
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl">
            <Mail className="w-4 h-4 text-ink-400" strokeWidth={2} />
            <span className="text-[10px] uppercase tracking-widest text-ink-500 font-semibold w-16">
              E-mail
            </span>
            <span className="text-sm font-semibold text-ink-900 truncate">{user?.email}</span>
          </div>
        </div>
      </div>

      {/* Sair */}
      <button
        onClick={logout}
        className="w-full card-flat p-5 md:p-6 text-left transition-all duration-200 hover:border-negative/40 group"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-red-50 group-hover:bg-negative group-hover:text-white flex items-center justify-center text-negative transition-all duration-200 flex-shrink-0">
              <LogOut className="w-5 h-5" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <p className="font-display font-bold text-base md:text-lg text-ink-900">
                Sair da conta
              </p>
              <p className="text-xs md:text-sm text-ink-500 truncate">
                Encerra esta sessão neste dispositivo
              </p>
            </div>
          </div>
          <span className="text-ink-400 text-xl flex-shrink-0">→</span>
        </div>
      </button>

      {/* Sobre — bem discreto no rodapé */}
      <p className="text-center text-[10px] uppercase tracking-widest text-ink-400 pt-4">
        Cofre · controle financeiro pessoal
      </p>
    </div>
  );
}
