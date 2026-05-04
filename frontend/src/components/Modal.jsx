import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = {
    sm: 'md:max-w-sm',
    md: 'md:max-w-md',
    lg: 'md:max-w-2xl',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* Backdrop com blur moderno */}
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-md" />

      {/* Conteúdo */}
      <div
        className={`relative bg-gradient-card shadow-soft-xl w-full
                    max-h-[95vh] md:max-h-[90vh] overflow-y-auto
                    rounded-t-3xl md:rounded-2xl
                    ${sizes[size]} animate-slide-up
                    border border-ink-200/80`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-gradient-card backdrop-blur-md flex items-center justify-between px-5 md:px-6 py-4 md:py-5 border-b border-ink-100">
          <h2 className="font-display text-xl md:text-2xl font-bold truncate pr-4 tracking-tight">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-ink-500 hover:text-ink-900 hover:bg-ink-100 transition-all duration-200 flex-shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 md:p-6">{children}</div>
      </div>
    </div>
  );
}
