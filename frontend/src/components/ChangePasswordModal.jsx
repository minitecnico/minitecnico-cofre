import { useState } from 'react';
import { Lock, Eye, EyeOff, Check, AlertCircle, Shield } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import Modal from './Modal';

/**
 * Modal de alteração de senha.
 *
 * Fluxo de validação:
 *   1. Frontend valida: 3 campos preenchidos + confirmação bate + mínimo 6 chars
 *   2. Re-autentica via signInWithPassword(email, senha_atual) → confirma identidade
 *   3. Chama supabase.auth.updateUser({ password: nova })
 *   4. Toast "Senha alterada com sucesso" + fecha modal
 *
 * Pega o EMAIL do useAuth (já temos no contexto).
 */
export default function ChangePasswordModal({ isOpen, onClose, onSuccess }) {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function reset() {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setError(null);
    setSubmitting(false);
  }

  function handleClose() {
    if (submitting) return; // não fecha durante request
    reset();
    onClose();
  }

  // Força da nova senha (visual) — heurística simples e útil
  const strength = calcStrength(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const passwordsDontMatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canSubmit =
    !submitting &&
    currentPassword.length > 0 &&
    newPassword.length >= 6 &&
    passwordsMatch &&
    newPassword !== currentPassword; // não permite "trocar" pra mesma senha

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!user?.email) {
      setError('Não foi possível identificar seu email. Faça login de novo.');
      return;
    }
    if (newPassword.length < 6) {
      setError('A nova senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não são iguais.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('A nova senha precisa ser diferente da atual.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Reautentica pra confirmar que é o dono da conta
      const { error: signinError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signinError) {
        // Supabase retorna mensagem em inglês — traduz pra usuário
        if (/invalid login credentials|invalid credentials/i.test(signinError.message)) {
          throw new Error('Senha atual incorreta.');
        }
        throw new Error(signinError.message);
      }

      // 2. Atualiza a senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw new Error(updateError.message);

      // 3. Sucesso — limpa form e avisa o pai
      reset();
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Não foi possível alterar a senha. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Alterar senha">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Aviso de segurança */}
        <div className="px-4 py-3 bg-ink-50 rounded-xl text-xs md:text-sm text-ink-700 flex items-start gap-2">
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-ink-500" strokeWidth={2.25} />
          <span>
            A nova senha passa a valer <strong>imediatamente em todos os dispositivos</strong>.
            Você continuará logado neste navegador.
          </span>
        </div>

        {/* Senha atual */}
        <PasswordField
          label="Senha atual"
          value={currentPassword}
          onChange={setCurrentPassword}
          show={showCurrent}
          onToggleShow={() => setShowCurrent((v) => !v)}
          autoFocus
        />

        {/* Nova senha */}
        <div>
          <PasswordField
            label="Nova senha"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggleShow={() => setShowNew((v) => !v)}
            hint="Mínimo 6 caracteres"
          />
          {/* Indicador de força */}
          {newPassword.length > 0 && (
            <div className="mt-2">
              <div className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${strength.colorClass}`}
                  style={{ width: `${strength.percent}%` }}
                />
              </div>
              <p className={`text-[10px] uppercase tracking-widest font-bold mt-1 ${strength.textColorClass}`}>
                {strength.label}
              </p>
            </div>
          )}
        </div>

        {/* Confirmar */}
        <div>
          <PasswordField
            label="Confirme a nova senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggleShow={() => setShowConfirm((v) => !v)}
          />
          {passwordsMatch && (
            <p className="text-xs text-positive mt-1.5 flex items-center gap-1 font-semibold">
              <Check className="w-3 h-3" strokeWidth={3} />
              Senhas conferem
            </p>
          )}
          {passwordsDontMatch && (
            <p className="text-xs text-negative mt-1.5 flex items-center gap-1 font-semibold">
              <AlertCircle className="w-3 h-3" strokeWidth={2.5} />
              As senhas não são iguais
            </p>
          )}
        </div>

        {error && (
          <div className="px-4 py-3 bg-red-50 border border-negative text-negative text-sm rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
          <button type="button" onClick={handleClose} disabled={submitting} className="btn-ghost">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canSubmit}
            className="btn-accent flex-1 disabled:opacity-60"
          >
            {submitting ? 'Alterando…' : 'Alterar senha'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/**
 * Campo de senha com toggle de mostrar/ocultar.
 */
function PasswordField({ label, value, onChange, show, onToggleShow, hint, autoFocus }) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400 pointer-events-none" />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="input-field pl-10 pr-12"
          autoFocus={autoFocus}
          autoComplete={label === 'Senha atual' ? 'current-password' : 'new-password'}
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-ink-400 hover:text-ink-900 hover:bg-ink-100 rounded-lg transition-colors"
          aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {hint && <p className="text-[10px] text-ink-500 mt-1">{hint}</p>}
    </div>
  );
}

/**
 * Heurística simples de força de senha (0-100).
 * Soma pontos por: tamanho, ter número, ter letra maiúscula, ter caractere especial.
 */
function calcStrength(password) {
  if (!password) {
    return { percent: 0, label: '', colorClass: 'bg-ink-200', textColorClass: 'text-ink-500' };
  }
  let score = 0;
  if (password.length >= 6) score += 25;
  if (password.length >= 10) score += 25;
  if (/[A-Z]/.test(password)) score += 17;
  if (/[0-9]/.test(password)) score += 17;
  if (/[^A-Za-z0-9]/.test(password)) score += 16;

  if (score < 25) {
    return { percent: 25, label: 'Muito fraca', colorClass: 'bg-negative', textColorClass: 'text-negative' };
  }
  if (score < 50) {
    return { percent: 50, label: 'Fraca', colorClass: 'bg-warn', textColorClass: 'text-yellow-700' };
  }
  if (score < 75) {
    return { percent: 75, label: 'Boa', colorClass: 'bg-positive', textColorClass: 'text-positive' };
  }
  return { percent: 100, label: 'Forte', colorClass: 'bg-positive', textColorClass: 'text-positive' };
}
