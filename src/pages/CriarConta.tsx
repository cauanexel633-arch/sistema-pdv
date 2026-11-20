import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Papel } from '../lib/types';

function traduzirErro(msg: string): string {
  if (/Código da central/i.test(msg)) return 'Código da central não encontrado. Confira o código com a central.';
  if (/already registered|already been registered/i.test(msg)) return 'Este e-mail já está cadastrado.';
  if (/password/i.test(msg)) return 'A senha deve ter pelo menos 6 caracteres.';
  if (/valid email|invalid.*email/i.test(msg)) return 'Informe um e-mail válido.';
  return msg;
}

export default function CriarConta() {
  const [papel, setPapel] = useState<Papel>('central');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [codigo, setCodigo] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [enviando, setEnviando] = useState(false);

  async function criar(e: FormEvent) {
    e.preventDefault();
    setErro('');
    setSucesso('');

    if (!nome.trim()) return setErro('Informe seu nome.');
    if (senha.length < 6) return setErro('A senha deve ter pelo menos 6 caracteres.');
    if (papel === 'operador' && !codigo.trim()) return setErro('Informe o código da central.');

    setEnviando(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
      options: {
        data: {
          papel,
          nome: nome.trim(),
          codigo_central: codigo.trim().toUpperCase(),
        },
      },
    });
    setEnviando(false);

    if (error) return setErro(traduzirErro(error.message));

    if (!data.session) {
      setSucesso('Conta criada! Confirme seu e-mail, se for solicitado, e depois faça login.');
    } else if (papel === 'central') {
      setSucesso('Central criada! Seu código de central aparece na aba Operadores.');
    }
  }

  const opcao = (valor: Papel, titulo: string, descricao: string) => (
    <button
      type="button"
      onClick={() => setPapel(valor)}
      aria-pressed={papel === valor}
      className={`flex-1 rounded-xl border-2 p-3 text-left ${
        papel === valor ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-white'
      }`}
    >
      <p className="font-semibold">{titulo}</p>
      <p className="text-xs text-slate-500">{descricao}</p>
    </button>
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form onSubmit={criar} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow">
        <h1 className="text-2xl font-bold">Criar conta</h1>

        <div>
          <span className="rotulo">Tipo de conta</span>
          <div className="flex gap-2">
            {opcao('central', 'Central', 'Conta principal')}
            {opcao('operador', 'Operador', 'Vinculada a uma central')}
          </div>
        </div>

        <div>
          <label className="rotulo" htmlFor="nome">Nome</label>
          <input id="nome" className="campo" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>

        <div>
          <label className="rotulo" htmlFor="email">E-mail</label>
          <input id="email" type="email" required autoComplete="email" className="campo" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div>
          <label className="rotulo" htmlFor="senha">Senha</label>
          <input id="senha" type="password" required minLength={6} autoComplete="new-password" className="campo" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>

        {papel === 'operador' && (
          <div>
            <label className="rotulo" htmlFor="codigo">Código da central</label>
            <input
              id="codigo"
              className="campo uppercase tracking-widest"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder="Ex.: K7M2QX9P"
              autoCapitalize="characters"
            />
            <p className="mt-1 text-xs text-slate-500">Peça à central o código exibido na aba Operadores.</p>
          </div>
        )}

        {erro && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
        {sucesso && <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{sucesso}</p>}

        <button type="submit" className="btn-primario w-full" disabled={enviando}>
          {enviando ? 'Criando…' : 'Criar conta'}
        </button>

        <p className="text-center text-sm text-slate-600">
          Já tem conta?{' '}
          <Link to="/" className="font-semibold text-indigo-700">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
