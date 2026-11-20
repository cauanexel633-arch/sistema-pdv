# PDV — Ponto de Venda

Sistema de ponto de venda web e responsivo (tablet e celular), em português do Brasil.

**Stack:** React + Vite + TypeScript + Tailwind CSS · Supabase (Postgres, Auth, Storage) · html5-qrcode · JSZip

## Funcionalidades

- **Contas:** Central (principal) e Operador (vinculado a uma central pelo código).
- **Cadastro:** Kits (com leitura de código de barras pela câmera ou leitor USB), Acessórios Residenciais (3 fotos) e Acessórios de Viagem (1 foto).
- **Vender:** seleção de vários itens, desconto, pagamento em débito, crédito (1x a 12x) ou Pix. A venda é gravada em uma única transação e impede venda dupla.
- **Histórico:** vendas com filtro por período e operador, somente leitura para o operador.
- **Central:** aba Operadores (com o código da central) e Dados, para exportar e importar um `.zip` com `dados.json` e fotos.

## Estrutura

```
pdv/
├── supabase/migrations/0001_pdv.sql   # tabelas, RLS, storage, funções e trigger
├── .env.example
└── src/
    ├── main.tsx · App.tsx · index.css
    ├── auth/AuthContext.tsx           # sessão e perfil (papel, central)
    ├── lib/                           # cliente Supabase, tipos, formatação, imagens, export/import
    ├── components/                    # layout, modal, formulário de item, leitor de código, fotos
    └── pages/                         # Login, CriarConta, Cadastro, Vender, Histórico, Operadores, Dados
```

## Configuração do Supabase

1. **Crie um projeto** em [supabase.com](https://supabase.com) (região South America, se disponível).

2. **Aplique a migração.** Escolha uma das formas:
   - **SQL Editor:** abra o conteúdo de `supabase/migrations/0001_pdv.sql`, cole e execute.
   - **CLI:** `supabase link --project-ref SEU-REF` e depois `supabase db push`.

3. **Confirme o bucket.** A migração cria o bucket privado `fotos`. Em *Storage*, ele deve aparecer como privado.

4. **Autenticação.** Em *Authentication → Providers → Email*:
   - Para testes rápidos, desative *Confirm email*.
   - Em produção, mantenha ativado. Quem criar conta precisará confirmar o e-mail antes de entrar.

5. **Pegue as chaves.** Em *Project Settings → API*, copie a **URL** e a chave **anon / publishable**. Nunca use a `service_role` no frontend.

6. **Configure o ambiente local:**
   ```bash
   cp .env.example .env
   # edite .env com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
   ```

## Rodando localmente

```bash
npm install
npm run dev        # http://localhost:5173
```

A câmera para leitura de código e a função `crypto.randomUUID` exigem contexto seguro: use `localhost` ou HTTPS. Para testar no celular na mesma rede, use HTTPS (por exemplo, com `npx vite --host` atrás de um túnel HTTPS como ngrok ou Cloudflare Tunnel).

## Primeiro uso

1. Abra o app e clique em **Criar conta**. Escolha **Central**, preencha os dados e crie a conta.
2. Entre na aba **Operadores** e copie o **código da central**.
3. Em outro aparelho (ou outra sessão), crie uma conta escolhendo **Operador** e informe esse código.
4. Cadastre itens em **Cadastro** e faça vendas em **Vender**.

## Leitor USB

Leitores USB funcionam como teclado. No campo **Número de série** do kit, basta apontar o leitor para o código. O Enter do leitor pula para o campo de valor, sem enviar o formulário.

## Regras principais

| Regra | Onde fica |
|---|---|
| Operador só vê e altera dados da própria central | RLS em `itens`, `vendas`, `perfis`, `centrais` e `storage.objects` |
| Central vê todos os dados da central | Mesmas policies (mesma `central_id`) |
| Operador não gerencia operadores nem importa | Rotas ocultas no app + `importar_dados` só aceita central |
| Item vendido não é apagado nem editado | Policies de update/delete exigem `vendido = false` |
| Venda sem duplicidade | `registrar_venda` trava as linhas (`FOR UPDATE`) em uma transação |
| Kit exige número de série; residencial exige 3 fotos; viagem exige 1 | Constraints no banco e validação no formulário |
| Import sem duplicar | `on conflict (id) do nothing` com o UUID de cada registro |

## Exportação e importação

- **Exportar:** `pdv-exportacao-AAAA-MM-DD.zip` com `dados.json` (versão 1) e `fotos/{id_do_item}/{n}.jpg`.
- **Importar:** o app lê o zip, mostra o resumo (novos e já existentes) e só grava após a confirmação. As fotos dos cadastros novos são enviadas para o bucket da sua central.
- **Operadores:** o arquivo traz a lista de operadores, mas as contas precisam ser criadas por cada pessoa com o código da central. As vendas mantêm o nome de quem vendeu.

## Limitações conhecidas

- Fotos não podem ser trocadas depois do cadastro (basta excluir e cadastrar de novo).
- A central não consegue remover operadores pelo app. Isso pode ser feito no painel do Supabase (*Authentication → Users*).
- Os dados de fotos ficam no Storage, e as imagens são exibidas com URLs assinadas válidas por 1 hora.
