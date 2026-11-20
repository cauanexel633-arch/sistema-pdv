import { useEffect } from 'react';

interface Props {
  mensagem: string;
  tipo: 'ok' | 'erro';
  onFechar: () => void;
}

export default function Toast({ mensagem, tipo, onFechar }: Props) {
  useEffect(() => {
    const t = setTimeout(onFechar, tipo === 'erro' ? 6000 : 3500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensagem, tipo]);

  return (
    <div
      role="status"
      onClick={onFechar}
      className={`fixed left-1/2 top-4 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 cursor-pointer rounded-2xl px-5 py-4 text-center font-semibold text-white shadow-lg ${
        tipo === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
    >
      {mensagem}
    </div>
  );
}
