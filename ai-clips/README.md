# Cortes de IA

Rotina diária: acha os 3 podcasts/entrevistas sobre IA mais vistos da semana → baixa só o áudio → transcreve →
escolhe o melhor trecho de ~1 min falando de IA → baixa só esse pedaço do vídeo → monta o Short vertical
(gancho + corte, legenda, som de suspense/humor) → posta no YouTube.

Busca: episódios de 15 min a 4 h, com IA no título (IA, AI, inteligência artificial, ChatGPT, OpenAI…), pulando
canais de cortes (pega sempre a fonte original). Em episódio longo, transcreve só os 3 trechos mais repetidos pelos
espectadores, então um podcast de 3 h não leva 3 h pra processar.

> **Rode no seu computador.** O YouTube bloqueia download a partir de servidores (pede login de "não sou robô").
> No seu PC funciona normal.

## Instalar (uma vez)

1. Python 3.10+, [ffmpeg](https://ffmpeg.org/download.html) e [deno](https://deno.com) (ou Node) instalados.
2. `pip install -r requirements.txt`
3. **IA que "lê" o vídeo** (recomendado): crie uma chave em console.anthropic.com e defina `ANTHROPIC_API_KEY`.
   Sem a chave, o corte é escolhido por heurística (trechos mais repetidos do YouTube) e a legenda fica no idioma original.
4. **Postar no canal**: no [Google Cloud Console](https://console.cloud.google.com/) crie um projeto, ative a
   *YouTube Data API v3*, crie uma credencial *OAuth → App para computador* e salve o JSON como `client_secret.json`
   nesta pasta. Na 1ª execução abre o navegador pra você escolher o canal de cortes.

### Baixar com a sua conta (YouTube Premium)

Logado, o YouTube não pede "não sou robô" e libera a qualidade Premium. Com o navegador logado na sua conta,
instale a extensão **Get cookies.txt LOCALLY** (Chrome/Firefox), abra youtube.com, exporte e salve como
`cookies.txt` nesta pasta. Refaça se um dia der erro de login. É a senha da sua conta em forma de arquivo:
não compartilhe e não suba pro GitHub (o `.gitignore` já bloqueia).

## Usar

```bash
python cortes.py --video algum.mp4   # teste: edita um vídeo local, resultado em saida/
python cortes.py --no-upload         # busca + baixa + edita, sem postar (revise em saida/)
python cortes.py                     # rotina completa
```

Agendar todo dia às 9h:
- Linux/Mac: `crontab -e` → `0 9 * * * cd /caminho/ai-clips && python3 cortes.py >> log.txt 2>&1`
- Windows: `schtasks /create /sc daily /st 09:00 /tn CortesIA /tr "python C:\caminho\ai-clips\cortes.py"`

## Ajustes (variáveis de ambiente)

| Variável | Padrão | O que faz |
|---|---|---|
| `TOP_N` | 3 | quantos cortes por dia (cada um com 1 min no máximo) |
| `FILTRO` | `CAMSAggD` | mais vistos da semana; `CAMSAggC` = só os de hoje |
| `IDIOMA` | `pt` | legenda traduzida pra esse idioma (com a IA) |
| `PRIVACIDADE` | `public` | `private`/`unlisted` pra revisar antes |
| `WHISPER_MODEL` | `small` | `base` é mais rápido, `medium` mais preciso |
| `COOKIES_DO_NAVEGADOR` | — | `firefox`/`chrome`/`edge`: usa o login do navegador (alternativa ao `cookies.txt`) |

Sons: na 1ª execução são gerados sons simples em `sfx/`. Pra sons melhores, coloque seus arquivos como
`sfx/riser.mp3` (suspense crescente), `sfx/boom.mp3` (impacto) e `sfx/boing.mp3` (humor).
As buscas ficam em `BUSCAS` e o filtro de tema em `SOBRE_IA`, no topo de `cortes.py`. `feitos.json` guarda o que já foi cortado.

## Atenção: direitos autorais

Repostar trecho de vídeo dos outros pode gerar reivindicação de Content ID ou strike, e o YouTube não monetiza
"conteúdo reutilizado" sem transformação. Prefira criadores que liberam cortes, sempre dê o crédito (o script já
põe o link da fonte na descrição) e, se puder, adicione comentário seu.
