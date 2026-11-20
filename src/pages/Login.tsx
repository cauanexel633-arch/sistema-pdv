import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    setEnviando(false);
    if (error) {
      setErro(/invalid login/i.test(error.message) ? 'E-mail ou senha incorretos.' : error.message);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={entrar} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Entrar no PDV</h1>

        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" type="email" required autoComplete="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div>
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input id="senha" type="password" required autoComplete="current-password" className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>

        {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

        <button type="submit" className="btn-primario w-full" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="text-center text-sm text-slate-600">
          Não tem conta?{' '}
          <Link to="/criar-conta" className="font-semibold text-indigo-700">Criar conta</Link>
        </p>
      </form>
    </div>
  );
}
