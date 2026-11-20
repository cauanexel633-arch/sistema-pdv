import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  onFechar: () => void;
  children: ReactNode;
  largura?: string;
}

export default function Modal({ titulo, onFechar, children, largura = 'max-w-lg' }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onFechar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`max-h-[92vh] w-full ${largura} overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{titulo}</h2>
          <button onClick={onFechar} className="px-2 text-3xl leading-none text-slate-500" aria-label="Fechar">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
