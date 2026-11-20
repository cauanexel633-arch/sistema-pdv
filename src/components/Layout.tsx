import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';

interface Aba {
  to: string;
  label: string;
  icone: string;
}

const ABAS_OPERADOR: Aba[] = [
  { to: '/cadastro', label: 'Cadastro', icone: '📦' },
  { to: '/vender', label: 'Vender', icone: '🛒' },
  { to: '/historico', label: 'Histórico', icone: '🧾' },
];

const ABAS_CENTRAL: Aba[] = [
  ...ABAS_OPERADOR,
  { to: '/operadores', label: 'Operadores', icone: '👥' },
  { to: '/dados', label: 'Dados', icone: '💾' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { perfil, sair } = useAuth();
  const abas = perfil?.papel === 'central' ? ABAS_CENTRAL : ABAS_OPERADOR;

  return (
    <div className="min-h-screen bg-slate-100 md:flex">
      {/* Menu lateral (desktop) */}
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:w-60 md:flex-col gap-2 border-r border-slate-200 bg-white p-4">
        <div className="mb-4">
          <p className="text-lg font-bold">PDV</p>
          <p className="text-xs text-slate-500">
            {perfil?.nome} · {perfil?.papel === 'central' ? 'Central' : 'Operador'}
          </p>
        </div>
        {abas.map((a) => (
          <NavLink
            key={a.to}
            to={a.to}
            className={({ isActive }) =>
              `rounded-xl px-4 py-3 font-medium ${
                isActive ? 'bg-indigo-600 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`
            }
          >
            {a.icone} {a.label}
          </NavLink>
        ))}
        <button onClick={sair} className="btn-secundario mt-auto">Sair</button>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Cabeçalho (celular) */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
          <div>
            <span className="font-bold">PDV</span>
            <span className="ml-2 text-xs text-slate-500">{perfil?.nome}</span>
          </div>
          <button onClick={sair} className="text-sm font-medium text-slate-600 underline">Sair</button>
        </header>

        <main className="mx-auto max-w-5xl p-4 pb-28 md:pb-6">{children}</main>
      </div>

      {/* Menu inferior (celular) */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-slate-200 bg-white md:hidden"
        style={{ gridTemplateColumns: `repeat(${abas.length}, minmax(0, 1fr))` }}
      >
        {abas.map((a) => (
          <NavLink
            key={a.to}
            to={a.to}
            className={({ isActive }) =>
              `flex min-h-[60px] flex-col items-center justify-center text-xs font-medium ${
                isActive ? 'text-indigo-700' : 'text-slate-500'
              }`
            }
          >
            <span className="text-xl leading-none">{a.icone}</span>
            <span className="mt-1">{a.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
