import type { ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { configuracaoOk } from './lib/supabase';
import Layout from './components/Layout';
import Login from './pages/Login';
import CriarConta from './pages/CriarConta';
import CadastroPage from './pages/CadastroPage';
import VenderPage from './pages/VenderPage';
import HistoricoPage from './pages/HistoricoPage';
import OperadoresPage from './pages/OperadoresPage';
import DadosPage from './pages/DadosPage';

function Aviso({ titulo, texto, acao }: { titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 text-center shadow">
        <h1 className="text-xl font-bold">{titulo}</h1>
        <p className="text-slate-600">{texto}</p>
        {acao}
      </div>
    </div>
  );
}

export default function App() {
  const { session, perfil, carregando, sair } = useAuth();

  if (!configuracaoOk) {
    return (
      <Aviso
        titulo="Configuração ausente"
        texto="Crie o arquivo .env a partir do .env.example, preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY e reinicie o servidor."
      />
    );
  }

  if (carregando) {
    return <div className="p-8 text-center text-slate-500">Carregando…</div>;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/criar-conta" element={<CriarConta />} />
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  if (!perfil) {
    return (
      <Aviso
        titulo="Perfil não encontrado"
        texto="Esta conta não está vinculada a uma central. Saia e tente novamente ou crie a conta de novo."
        acao={<button className="btn-secundario w-full" onClick={sair}>Sair</button>}
      />
    );
  }

  const ehCentral = perfil.papel === 'central';

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/vender" replace />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/vender" element={<VenderPage />} />
        <Route path="/historico" element={<HistoricoPage />} />
        {ehCentral && <Route path="/operadores" element={<OperadoresPage />} />}
        {ehCentral && <Route path="/dados" element={<DadosPage />} />}
        <Route path="*" element={<Navigate to="/vender" replace />} />
      </Routes>
    </Layout>
  );
}
