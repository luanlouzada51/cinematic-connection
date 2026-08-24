# Movie Match — rede social de cinéfilos com swipe

App mobile-first, dark mode cinematográfico (preto/grafite com destaques em vermelho e dourado), construído em etapas. Todo o backend (login, banco, imagens, chat em tempo real, IA de moderação) roda no Lovable Cloud — sem contas externas.

Catálogo: como ainda não há chave do TMDB, começo com um catálogo interno populado com títulos populares (capa, sinopse, gênero, elenco, ano) gravados no banco. Quando você tiver a chave do TMDB, troco a fonte de dados sem refazer as telas.

## Etapa 1 — Base e descoberta de filmes
- Login/cadastro por e-mail+senha e Google; onboarding com nome, foto, idade, localização, bio e gêneros favoritos.
- Catálogo interno de filmes e séries com capas.
- Swipe de conteúdo: card só com a capa, tap expande (gênero, nota interna, elenco, sinopse), swipe esquerda salva na watchlist, swipe direita descarta para sempre.
- Avaliações de 1 a 5 estrelas com nota média interna por título e vetor de gosto por gênero calculado automaticamente.
- Perfil com watchlist, avaliações e estatísticas.
- Navegação inferior com as 5 abas principais + configurações.

## Etapa 2 — Pessoas, match e chat
- Swipe de perfis: aleatório no início, passando a priorizar gosto similar conforme o usuário avalia filmes; nunca fica sem cards (volta ao aleatório).
- Match mútuo libera chat em tempo real.
- Moderação de chat: bloqueio de menções a redes sociais, telefones e e-mails por regex, mais checagem de toxicidade por IA; reportar e bloquear usuário.

## Etapa 3 — Comunidades por gênero
- Um feed por gênero, separado entre Filmes e Séries.
- Posts, comentários, threads de lançamentos e upvote/downvote estilo Reddit com ordenação por relevância.

## Etapa 4 — Premium, anúncios e i18n
- Free com espaços de banner e intersticial entre swipes.
- Premium por assinatura (Stripe): sem anúncios, filtros avançados de match (gênero, faixa de idade, raio de localização), ver quem curtiu você, super like, boost e desfazer swipe.
- i18n completo em pt, en e es, com troca de idioma nas configurações.

## Etapa 5 — Gamificação e extras
- CineStreak com badges, conquistas por gênero explorado e "seu ano no cinema".
- Listas colaborativas públicas (seguir/curtir).
- Watch Party: marcar sessão numa data e outros topam junto, com chat temporário.
- Notificações in-app (watchlist, matches, mensagens, Watch Party).

## Detalhes técnicos
- Tabelas principais: `profiles`, `titles`, `genres`, `ratings`, `watchlist`, `content_swipes`, `person_swipes`, `matches`, `messages`, `reports`, `blocks`, `posts`, `comments`, `votes`, `lists`, `list_items`, `watch_parties`, `achievements`, `subscriptions`, `user_roles`. RLS em todas, com grants explícitos; papéis em tabela separada.
- Vetor de gosto por gênero recalculado por trigger a cada avaliação; ranking interno via view agregada.
- Swipe com Motion (gestos + spring), pré-carregamento de capas e no máximo 3 cards montados para manter 60fps.
- Moderação: regex no cliente e revalidação no servidor antes de gravar a mensagem, mais classificação de toxicidade via IA do Lovable.
- Notificações push do navegador exigem publicar o app com HTTPS; começo com notificações in-app e adiciono push depois.

## Fora de escopo agora
- Login Facebook e Apple (exigem contas de desenvolvedor suas) — adiciono quando você tiver as credenciais.
- Dados traduzidos do TMDB e disponibilidade em streaming (JustWatch) dependem das chaves de API.
