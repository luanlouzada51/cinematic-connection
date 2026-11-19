# Cortes de IA

Todo dia às 5h o computador acha os 3 podcasts/entrevistas sobre IA mais vistos da semana, corta 1 min de cada
(gancho + corte, legenda em português, som de suspense/humor) e agenda no seu canal pra **7h, 12h e 18h** (Ohio).
Entre 5h e 7h dá pra revisar no app do YouTube Studio e apagar o que não gostar.

Precisa rodar no seu computador (o YouTube bloqueia download vindo de servidor). Configuração: ~40 min, uma vez só.

---

## Passo a passo (Windows)

### 0. Criar o canal
1. Entre no YouTube com sua conta Google (pode ser a mesma do Premium).
2. Abra https://www.youtube.com/channel_switcher → **Criar um canal** → dê o nome (ex.: "IA em 1 Minuto") → **Criar**.
3. Verifique o telefone em https://www.youtube.com/verify (libera miniatura personalizada).
4. Opcional: foto, banner e descrição em https://studio.youtube.com.

### 1. Instalar os programas
1. **Python 3.14** (não a 3.15: a biblioteca de transcrição ainda não tem versão pra ela no Windows):
   https://www.python.org/ftp/python/3.14.10/python-3.14.10-amd64.exe → rode o instalador →
   **marque "Add python.exe to PATH"** → Install Now.
2. Abra o **PowerShell** (menu Iniciar → digite PowerShell) e rode:
   ```
   winget install Gyan.FFmpeg
   winget install DenoLand.Deno
   ```
3. **Feche e abra o PowerShell de novo** e confira (cada um tem que mostrar uma versão):
   ```
   python --version
   ffmpeg -version
   deno --version
   ```

### 2. Baixar o projeto
1. Baixe o ZIP (logado no GitHub):
   https://github.com/luanlouzada51/cinematic-connection/archive/refs/heads/claude/affectionate-turing-8so9p1.zip
2. Extraia, copie a pasta **`ai-clips`** pra `C:\` e renomeie pra **`C:\cortes-ia`**.
3. No PowerShell:
   ```
   cd C:\cortes-ia
   python -m pip install -r requirements.txt
   ```

### 3. Chave da IA (Anthropic)
É ela que "assiste" o podcast, escolhe o trecho e traduz a legenda. Custa ~US$ 0,10 por corte.
1. Crie a conta em https://console.anthropic.com
2. Coloque crédito em **Settings → Billing** (mínimo US$ 5 dura ~1 mês e meio).
3. **Settings → API Keys → Create Key** → copie a chave (começa com `sk-ant-`).
4. No PowerShell (troque pela sua chave), depois feche e abra o PowerShell:
   ```
   setx ANTHROPIC_API_KEY "sk-ant-COLE-AQUI"
   ```
   Não mande essa chave pra ninguém.

### 4. Permissão pra postar no canal (Google Cloud)
1. https://console.cloud.google.com/projectcreate → nome `cortes-ia` → **Criar** (deixe esse projeto selecionado no topo).
2. https://console.cloud.google.com/apis/library/youtube.googleapis.com → **Ativar**.
3. https://console.cloud.google.com/auth/overview → **Começar** → nome do app `Cortes IA` + seu e-mail →
   Público: **Externo** → seu e-mail de contato → aceite → **Criar**.
4. https://console.cloud.google.com/auth/audience → **Publicar app** → Confirmar.
   (Sem isso a autorização expira a cada 7 dias.) Se pedir site/política de privacidade que você não tem:
   apague os escopos em https://console.cloud.google.com/auth/scopes e o logo em
   https://console.cloud.google.com/auth/branding, salve e tente publicar de novo.
   Se ainda assim não deixar: fique em "Em teste", adicione seu e-mail em **Usuários de teste** (mesma página) e
   rode `python cortes.py --autorizar` uma vez por semana (se esquecer, o `log.txt` avisa).
5. https://console.cloud.google.com/auth/clients → **Criar cliente** → Tipo: **App para computador** → Criar →
   **Baixar JSON** → renomeie pra **`client_secret.json`** e coloque em `C:\cortes-ia`.

### 5. Login do YouTube Premium (cookies.txt)
1. Instale a extensão **Get cookies.txt LOCALLY**:
   Chrome: https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc ·
   Firefox: https://addons.mozilla.org/firefox/addon/get-cookies-txt-locally/
2. Deixe a extensão funcionar na janela anônima: Chrome → `chrome://extensions` → Get cookies.txt LOCALLY →
   Detalhes → **Permitir no modo anônimo**.
3. Abra uma **janela anônima** (Ctrl+Shift+N), entre no YouTube com a conta Premium, deixe só uma aba aberta em
   https://www.youtube.com/robots.txt → clique na extensão → **Export** → salve como **`C:\cortes-ia\cookies.txt`**.
4. **Feche a janela anônima** e não entre mais nela. (Se exportar da janela normal, o YouTube troca os cookies
   enquanto você navega e eles param de valer em minutos.)
   É o seu login em forma de arquivo: não compartilhe (o `.gitignore` já impede de subir pro GitHub).

### 6. Testar
No PowerShell, em `C:\cortes-ia`:
```
python test_cortes.py
python cortes.py --no-upload
python cortes.py --autorizar
```
- O 1º tem que mostrar `ok`.
- O 2º gera 3 cortes em `C:\cortes-ia\saida` sem postar. Na 1ª vez leva de 20 a 40 min (baixa o modelo de
  transcrição). Assista e veja se gostou.
- O 3º abre o navegador: entre na conta, **escolha o canal novo** (não o pessoal). Se aparecer
  "O Google não verificou este app": **Avançado → Acessar Cortes IA (não seguro)** (o app é seu) → Continuar.
  Deve aparecer `Canal autorizado.`

### 7. Agendar todo dia às 5h
No PowerShell (copie tudo de uma vez):
```
$acao = New-ScheduledTaskAction -Execute "cmd.exe" -Argument '/c cd /d C:\cortes-ia && python -m pip install -q -U "yt-dlp[default]" && python cortes.py >> log.txt 2>&1'
$hora = New-ScheduledTaskTrigger -Daily -At 5am
$cfg  = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable
Register-ScheduledTask -TaskName "CortesIA" -Action $acao -Trigger $hora -Settings $cfg
```
Deixe o PC na tomada e com seu usuário logado (pode ficar bloqueado ou em suspensão: ele acorda sozinho).
Se ele estiver desligado às 5h, roda assim que ligar; horários que já passaram são postados na hora.
O que aconteceu fica em `C:\cortes-ia\log.txt`.

---

## No Mac
Igual ao Windows, trocando os passos 1, 2 e 7:
```
# 1. instale o Homebrew (https://brew.sh) e depois:
brew install python ffmpeg deno
# 2. pasta em ~/cortes-ia:
cd ~/cortes-ia && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
# 6. use .venv/bin/python no lugar de python
# 7. crontab -e  e cole (com sua chave):
PATH=/opt/homebrew/bin:/usr/bin:/bin
ANTHROPIC_API_KEY=sk-ant-COLE-AQUI
0 5 * * * cd ~/cortes-ia && .venv/bin/pip install -q -U yt-dlp; .venv/bin/python cortes.py >> log.txt 2>&1
# e pra acordar o Mac sozinho:
sudo pmset repeat wakeorpoweron MTWRFSU 04:55:00
```

## Ajustes (opcional)

| Variável | Padrão | O que faz |
|---|---|---|
| `HORARIOS` | `07:00,12:00,18:00` | um corte por horário (3 = 3 por dia) |
| `FUSO` | `America/New_York` | fuso dos horários (Ohio) |
| `PRIVACIDADE` | `public` | `private` = sobe tudo privado, sem agendar, pra revisar à mão |
| `FILTRO` | `CAMSAggD` | mais vistos da semana; `CAMSAggC` = só os de hoje |
| `IDIOMA` | `pt` | idioma da legenda |
| `WHISPER_MODEL` | `small` | `base` é mais rápido, `medium` mais preciso |

No Windows: `setx NOME "valor"`. As buscas ficam em `BUSCAS` e o filtro de tema em `SOBRE_IA`, no topo de
`cortes.py`. `feitos.json` guarda o que já foi cortado (nunca repete).

Sons: na 1ª execução são gerados sons simples em `sfx\`. Pra sons melhores, troque por arquivos seus:
`sfx\riser.mp3` (suspense crescente), `sfx\boom.mp3` (impacto) e `sfx\boing.mp3` (humor).

## Se der problema
- **Erro de login / "Sign in to confirm you're not a bot"**: exporte o `cookies.txt` de novo (passo 5).
- **"n challenge solving failed" / "Only images are available"**: `python -m pip install -U "yt-dlp[default]"` (a tarefa já faz isso todo dia).
- **Vídeos ficam presos em "Privado" e não publicam no horário**: o Google às vezes trava uploads de projetos
  novos da API. Peça a liberação em https://support.google.com/youtube/contact/yt_api_form
- **Pediu pra autorizar de novo**: apague `token.json` e rode `python cortes.py --autorizar`.

## Direitos autorais
Repostar trecho de vídeo dos outros pode gerar reivindicação de Content ID ou strike, e o YouTube não monetiza
"conteúdo reutilizado" sem transformação. Prefira criadores que liberam cortes, sempre dê o crédito (o script já
põe o link da fonte na descrição) e, se puder, adicione comentário seu.
