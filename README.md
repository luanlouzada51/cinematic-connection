# CleanConnect

Aplicativo para empresas de limpeza, escrito do zero. São dois produtos ligados
pela mesma conta:

1. **Operação (empresa ↔ cliente)** — clientes, casas, preços, contratos
   recorrentes, agenda do dia, status ao vivo (a caminho → entrada → saída →
   concluído), fotos, observações e chat.
2. **Mercado de trabalho (empresa ↔ profissional)** — perfil com habilidades e
   dias livres, vagas por dia, candidatura, vínculo que dura o serviço e
   avaliação dos dois lados no fim.

E, no meio dos dois, o **acerto de pagamento**: escolhe-se o período, o app lista
as casas feitas e os trabalhos pegos no mercado, aplica a porcentagem (80/20 ou o
que a empresa definir), a diária ou a hora, desconta o que precisar e diz **quem
paga quem**. O acerto vale tanto para quem é da equipe quanto para quem foi
contratado por uma vaga, sem vínculo fixo.

## O que foi corrigido em relação ao app que serviu de referência

- A agenda funciona inteira no celular: dá para cadastrar cliente, casa, preço e
  recorrência sem abrir o computador.
- Horário com AM/PM correto conforme o idioma (`pt-BR` 24h, `en-US` 12h).
- O cliente tem acesso próprio: acompanha a visita ao vivo e conversa pelo app.
- A empresa decide o que aparece: preço para a equipe, preço para o cliente e se
  o chat com cliente existe.
- O acerto de fim de período deixa de ser planilha.
- Contrato recorrente não deixa a agenda esvaziar: o app avisa quando as visitas
  geradas estão acabando e renova a partir da última, herdando a equipe.
- Serviço pode ser remarcado, e a agenda tem visão de dia e de semana.

## Papéis

| Papel                  | Entra vendo    | Enxerga o mercado de trabalho?               |
| ---------------------- | -------------- | -------------------------------------------- |
| Empresa (dono/gerente) | Agenda         | Sim                                          |
| Profissional           | Meu dia        | Sim                                          |
| Cliente                | Minhas visitas | **Não** — bloqueado no banco, não só na tela |

## Como rodar

```sh
bun install     # ou npm install
bun run dev
```

Variáveis necessárias em `.env` (o projeto já vem conectado ao Supabase pelo
Lovable Cloud):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_PROJECT_ID=
```

### Banco

Duas migrações em `supabase/migrations`:

- `20260828120000_clean_connect_schema.sql` — o schema inteiro: tabelas, RLS por
  papel, gatilhos (criação de conta, média de avaliação, status da vaga), funções
  de entrada por código, bucket de fotos e realtime.
- `20260828170000_payouts_include_gigs.sql` — o que cada vaga rendeu e quem ficou
  com o dinheiro, e o acerto passando a aceitar quem não é da equipe.

**As migrações precisam ser aplicadas antes do primeiro uso** — sincronizando o
projeto com o Lovable Cloud ou rodando `supabase db push` com a CLI. Sem isso, as
telas internas abrem vazias porque as tabelas ainda não existem.

## Comandos

```sh
bun run dev        # desenvolvimento
bun run build      # build de produção
bun run lint       # eslint + prettier
bun run typecheck  # tsc --noEmit
bun run test       # vitest (cálculo do acerto)
```

## Organização

```
src/
  routes/            rotas (finas: leem parâmetros e montam a tela)
    app/             área autenticada, com casca e navegação por papel
  features/
    auth/            sessão: conta, empresa, papel, visibilidade de preço
    company/         cadastro da empresa e diretório em cache
    customers/       clientes e casas
    schedule/        agenda, linha do tempo do serviço, fotos, recorrência
    messaging/       conversas empresa ↔ cliente e empresa ↔ profissional
    marketplace/     perfis, disponibilidade, vagas, vínculo, avaliações
    payouts/         relatório e cálculo do acerto (com testes)
  components/ui/     kit de interface próprio, pequeno
  lib/               i18n (pt/en), formatação, utilitários
supabase/migrations/ schema e RLS
```

O cálculo do acerto vive isolado em `src/features/payouts/settlement.ts`, como
função pura, e é o único trecho com testes — é onde erro custa dinheiro de
verdade. Regra padrão: só entra na divisão o dinheiro que já foi recebido; casa
não paga aparece à parte, e a empresa pode optar por incluí-la.

## Idiomas

Interface em português e inglês (`src/lib/locales`). O idioma é detectado pelo
navegador e trocado no cabeçalho; moeda e formato de hora acompanham (BRL/24h ou
USD/12h).
