import { useState, useRef } from 'react';
import { Settings as SettingsIcon, Download, Upload, AlertTriangle, Check } from 'lucide-react';
import { backupService } from '../services/backup';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState(null); // { type: 'success'|'error'|'info', text }
  const [confirmClear, setConfirmClear] = useState(false);

  async function handleExport() {
    try {
      setExporting(true);
      setMessage(null);
      const data = await backupService.export();
      const json = JSON.stringify(data, null, 2);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().slice(0, 10);
      link.download = `cofre-backup-${date}.json`;
      link.click();
      URL.revokeObjectURL(url);

      const stats = {
        cats: data.categories.length,
        cards: data.credit_cards.length,
        rec: data.recurring_transactions.length,
        tx: data.transactions.length,
      };
      setMessage({
        type: 'success',
        text: `Backup gerado: ${stats.tx} transações, ${stats.cats} categorias, ${stats.cards} cartões, ${stats.rec} recorrências.`,
      });
    } catch (err) {
      setMessage({ type: 'error', text: 'Erro ao exportar: ' + err.message });
    } finally {
      setExporting(false);
    }
  }

  async function handleImport(event, clearBefore = false) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setImporting(true);
      setMessage(null);
      const text = await file.text();
      const json = JSON.parse(text);

      const stats = await backupService.import(json, { clearBefore });
      setMessage({
        type: 'success',
        text: `Importado: ${stats.transactions} transações, ${stats.categories} categorias, ${stats.cards} cartões, ${stats.recurring} recorrências. ${stats.skipped > 0 ? `${stats.skipped} ignoradas (já existiam).` : ''}`,
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Erro ao importar: ' + (err.message || 'arquivo inválido'),
      });
    } finally {
      setImporting(false);
      // Limpa o input para permitir reimportar mesmo arquivo
      if (fileInputRef.current) fileInputRef.current.value = '';
      setConfirmClear(false);
    }
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <p className="text-[10px] md:text-xs uppercase tracking-widest text-ink-500 font-semibold">
          Configurações
        </p>
        <h1 className="font-display text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mt-1 leading-tight flex items-center gap-2 md:gap-3">
          <SettingsIcon className="w-7 h-7 md:w-10 md:h-10 flex-shrink-0" strokeWidth={2.5} />
          <span>Ajustes</span>
        </h1>
      </div>

      {/* Conta */}
      <div className="card-flat p-4 md:p-6">
        <h3 className="font-display text-lg md:text-xl font-bold mb-3">Conta</h3>
        <div className="space-y-2 text-sm">
          <p className="text-ink-700">
            <span className="text-[10px] uppercase tracking-widest text-ink-500 block mb-0.5">
              Nome
            </span>
            <span className="font-semibold">{user?.name}</span>
          </p>
          <p className="text-ink-700">
            <span className="text-[10px] uppercase tracking-widest text-ink-500 block mb-0.5">
              E-mail
            </span>
            <span className="font-semibold">{user?.email}</span>
          </p>
        </div>
      </div>

      {/* Backup */}
      <div className="card-flat p-4 md:p-6">
        <h3 className="font-display text-lg md:text-xl font-bold mb-1">Backup completo</h3>
        <p className="text-xs md:text-sm text-ink-600 mb-4">
          Baixe um arquivo JSON com TODOS os seus dados (transações, categorias, cartões, recorrências).
          Guarde em local seguro — Drive, e-mail, pendrive.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-accent disabled:opacity-60"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Gerando…' : 'Baixar backup'}
        </button>
      </div>

      {/* Restaurar */}
      <div className="card-flat p-4 md:p-6">
        <h3 className="font-display text-lg md:text-xl font-bold mb-1">Restaurar backup</h3>
        <p className="text-xs md:text-sm text-ink-600 mb-4">
          Importe um arquivo de backup (.json). Por padrão, dados existentes são preservados —
          duplicatas são detectadas e ignoradas automaticamente.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          onChange={(e) => handleImport(e, confirmClear)}
          className="hidden"
        />

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={() => {
              setConfirmClear(false);
              fileInputRef.current?.click();
            }}
            disabled={importing}
            className="btn-primary disabled:opacity-60"
          >
            <Upload className="w-4 h-4" />
            {importing ? 'Importando…' : 'Importar (modo seguro)'}
          </button>

          {!confirmClear ? (
            <button
              onClick={() => setConfirmClear(true)}
              disabled={importing}
              className="btn-ghost text-negative disabled:opacity-60"
            >
              Apagar tudo e importar…
            </button>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="px-4 py-2.5 min-h-[44px] bg-negative text-white font-semibold border-2 border-negative hover:bg-red-700 transition-colors text-sm md:text-base"
            >
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Confirmar: apagar e importar
            </button>
          )}
        </div>

        {confirmClear && (
          <div className="mt-3 px-3 py-2 bg-red-50 border-2 border-negative text-negative text-xs">
            ⚠️ <strong>Atenção:</strong> isso vai apagar TODOS os seus dados atuais antes de importar o backup. Não pode ser desfeito.
            Clique em "Confirmar" e selecione o arquivo, ou{' '}
            <button onClick={() => setConfirmClear(false)} className="underline font-semibold">
              cancele
            </button>.
          </div>
        )}
      </div>

      {/* Mensagem de feedback */}
      {message && (
        <div
          className={`px-4 py-3 border-2 text-sm font-medium ${
            message.type === 'success'
              ? 'bg-accent/30 border-ink-900 text-ink-900'
              : message.type === 'error'
                ? 'bg-red-50 border-negative text-negative'
                : 'bg-yellow-50 border-warn text-yellow-900'
          }`}
        >
          {message.type === 'success' && <Check className="w-4 h-4 inline mr-1" strokeWidth={3} />}
          {message.text}
          <button
            onClick={() => setMessage(null)}
            className="ml-2 underline opacity-70 hover:opacity-100"
          >
            ok
          </button>
        </div>
      )}

      {/* Dica */}
      <div className="card-flat p-4 md:p-5 bg-ink-900 text-ink-50">
        <p className="text-xs md:text-sm leading-relaxed">
          💡 <strong className="text-accent">Dica:</strong> faça backup uma vez por mês e guarde fora do Supabase.
          Mesmo o plano gratuito sendo confiável, ter cópia em outro lugar é prudente.
        </p>
      </div>
    </div>
  );
}
