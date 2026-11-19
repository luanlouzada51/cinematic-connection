#!/usr/bin/env python3
"""Cortes de IA: acha os podcasts sobre IA mais vistos, gera cortes verticais de até 1 min
(gancho + corte, legenda, efeito sonoro de suspense/humor) e agenda no YouTube.

  python cortes.py               # rotina diária completa
  python cortes.py --no-upload   # só gera os cortes em saida/
  python cortes.py --video X.mp4 # edita um vídeo local (teste)
  python cortes.py --autorizar   # conecta o canal (1ª vez)
"""
import argparse
import itertools
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from functools import cache
from pathlib import Path
from typing import Literal
from urllib.parse import quote
from zoneinfo import ZoneInfo

from pydantic import BaseModel

AQUI = Path(__file__).resolve().parent
TRAB, SAIDA, SFX = AQUI / "trabalho", AQUI / "saida", AQUI / "sfx"
HISTORICO = AQUI / "feitos.json"

BUSCAS = ["podcast inteligência artificial", "podcast sobre IA", "AI podcast", "AI interview podcast"]
FILTRO = os.environ.get("FILTRO", "CAMSAggD")  # mais vistos da semana; "CAMSAggC" = só de hoje
# 1 corte por horário; roda de madrugada e o YouTube publica cada um sozinho na hora marcada
HORARIOS = os.environ.get("HORARIOS", "07:00,12:00,18:00").split(",")
FUSO = ZoneInfo(os.environ.get("FUSO", "America/New_York"))  # Ohio
DURACAO_FONTE = (900, 4 * 3600)  # episódios de 15 min a 4 h
# o título tem que falar de IA (AI/IA só em maiúscula, pra não pegar "eu ia")
SOBRE_IA = re.compile(r"\b(AI|IA)\b|(?i:intelig[êe]ncia artificial|artificial intelligence|chatgpt|openai|"
                      r"anthropic|gemini|nvidia|\bllms?\b|\bgpt|\brob[ôo]s?\b)")
TOTAL = 60  # duração final: gancho + corte
IDIOMA = os.environ.get("IDIOMA", "pt")  # traduz a legenda pra esse idioma (precisa da IA)
PRIVACIDADE = os.environ.get("PRIVACIDADE", "public")
WHISPER = os.environ.get("WHISPER_MODEL", "small")
MODELO = "claude-opus-5-5"
RISO = re.compile(r"\b(ha(ha)+|kk+|lol|risos|laugh\w*)\b", re.I)

# Sons sintetizados na 1ª execução. Pra usar sons de verdade, ponha sfx/riser.mp3, sfx/boom.mp3, sfx/boing.mp3.
SONS = {
    "riser": ("0.5*sin(2*PI*(110*t+60*t*t))*t/3+0.3*sin(2*PI*55*t)*(0.5+0.5*sin(2*PI*8*t))", 3),
    "boom": ("0.9*sin(2*PI*55*t)*exp(-3*t)+0.4*(random(0)*2-1)*exp(-25*t)", 1.5),
    "boing": ("0.6*sin(2*PI*(220*t+150*t*t)+6*sin(2*PI*12*t))*exp(-3*t)", 0.8),
}


class Efeito(BaseModel):
    t: float
    tipo: Literal["suspense", "humor"]


class Linha(BaseModel):
    start: float
    end: float
    text: str


class Escolha(BaseModel):
    start: float
    end: float
    hook_start: float
    hook_end: float
    clima: Literal["suspense", "humor"]
    efeitos: list[Efeito]
    titulo: str
    descricao: str
    legendas: list[Linha]


def sh(cmd, **kw):
    subprocess.run(cmd, check=True, **kw)


def duracao(p):
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]))


# ---------- 1. buscar e baixar ----------

def opts_ytdlp(**kw):
    o = {"quiet": True, "js_runtimes": {"deno": {}, "node": {}}, **kw}
    if (AQUI / "cookies.txt").exists():  # login da sua conta (Premium), exportado do navegador
        o["cookiefile"] = str(AQUI / "cookies.txt")
    elif nav := os.environ.get("COOKIES_DO_NAVEGADOR"):  # ou lê direto do navegador: firefox, chrome, edge
        o["cookiesfrombrowser"] = (nav,)
    return o


def buscar(feitos):
    import yt_dlp
    achados = {}
    with yt_dlp.YoutubeDL(opts_ytdlp(extract_flat=True, playlistend=40)) as ydl:
        for q in BUSCAS:
            url = f"https://www.youtube.com/results?search_query={quote(q)}&sp={FILTRO}"
            for v in ydl.extract_info(url, download=False).get("entries") or []:
                if (v.get("id") not in feitos and DURACAO_FONTE[0] <= (v.get("duration") or 0) <= DURACAO_FONTE[1]
                        and SOBRE_IA.search(v.get("title") or "")
                        and "corte" not in (v.get("channel") or "").lower()):  # fonte original, não outro canal de cortes
                    achados[v["id"]] = v
    return sorted(achados.values(), key=lambda v: v.get("view_count") or 0, reverse=True)[:3 * len(HORARIOS)]  # sobra reserva se algum falhar


def baixar_audio(vid):
    """Só o áudio (podcast de 2 h ~ 100 MB) pra transcrever."""
    import yt_dlp
    with yt_dlp.YoutubeDL(opts_ytdlp(format="ba/b", outtmpl=str(TRAB / "%(id)s.audio.%(ext)s"))) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}")
        return Path(ydl.prepare_filename(info)), info


def baixar_trecho(vid, s, fim):
    """Só o pedaço do corte (1 s de folga), não o episódio inteiro. Devolve (arquivo, segundo onde começa)."""
    a = max(0.0, s - 1)
    import yt_dlp
    from yt_dlp.utils import download_range_func
    with yt_dlp.YoutubeDL(opts_ytdlp(format="bv*[height<=1080]+ba/b", merge_output_format="mp4",
                                     download_ranges=download_range_func(None, [(a, fim + 1)]), force_keyframes_at_cuts=True,
                                     outtmpl=str(TRAB / "%(id)s.trecho.%(ext)s"))) as ydl:
        ydl.download([f"https://www.youtube.com/watch?v={vid}"])
    return TRAB / f"{vid}.trecho.mp4", a


# ---------- 2. ler (transcrever) e escolher o corte ----------

@cache
def whisper():
    from faster_whisper import WhisperModel
    return WhisperModel(WHISPER, device="cpu", compute_type="int8")


def regioes(info, raio=120, k=3):
    """Episódio longo com mapa de 'mais repetidos': transcreve só os k picos (±raio s), não as 3 h."""
    dur = info["duration"]
    if not info.get("heatmap") or dur <= 20 * 60:
        return [(0, dur)]
    out = []
    for h in sorted(info["heatmap"], key=lambda h: -h["value"]):
        c = (h["start_time"] + h["end_time"]) / 2
        if c > 60 and all(abs(c - (a + b) / 2) > 2 * raio for a, b in out):  # pula a abertura
            out.append((max(0, c - raio), min(dur, c + raio)))
        if len(out) == k:
            break
    return sorted(out) or [(0, dur)]


def transcrever(audio, trechos):
    import numpy as np  # áudio decodificado pelo ffmpeg: o decoder do faster-whisper quebra com PyAV novo
    segs, lang = [], None
    for a, b in trechos:
        pcm = subprocess.check_output(["ffmpeg", "-v", "error", "-ss", f"{a:.2f}", "-t", f"{b - a:.2f}", "-i", str(audio),
                                       "-ac", "1", "-ar", "16000", "-f", "f32le", "-"])
        ss, info = whisper().transcribe(np.frombuffer(pcm, np.float32), word_timestamps=True, vad_filter=True)
        segs += [{"start": s.start + a, "end": s.end + a, "text": s.text.strip(),
                  "words": [(w.start + a, w.end + a, w.word.strip()) for w in s.words or []]} for s in ss]
        lang = lang or info.language
    return segs, lang


def melhor_janela(nota, n):
    """Início da janela de n segundos com maior soma de nota."""
    acc = list(itertools.accumulate(nota, initial=0))
    return max(range(max(1, len(nota) - n + 1)), key=lambda i: acc[min(i + n, len(nota))] - acc[i])


def escolher_sem_ia(segs, info):
    # ponytail: heurística (mais repetidos do YouTube ou densidade de fala); a IA escolhe bem melhor
    dur = info["duration"]
    nota = [0.0] * (int(dur) + 1)
    if info.get("heatmap"):
        for h in info["heatmap"]:
            for t in range(int(h["start_time"]), min(int(h["end_time"]) + 1, len(nota))):
                nota[t] = max(nota[t], h["value"])
    else:
        for s in segs:
            for w in s["words"]:
                nota[min(int(w[0]), len(nota) - 1)] += 1
    falado = {t for s in segs for t in range(int(s["start"]), int(s["end"]) + 1)}
    nota = [n if t in falado else 0 for t, n in enumerate(nota)]  # só onde tem fala transcrita
    hl = 4
    s = melhor_janela(nota, TOTAL - hl)
    h = s + 10 + melhor_janela(nota[s + 10: s + TOTAL - hl], hl)
    palavras = [w for sg in segs for w in sg["words"] if s <= w[0] < s + TOTAL - hl]
    risos = [w[0] for w in palavras if RISO.search(w[2])]
    return Escolha(start=s, end=s + TOTAL - hl, hook_start=h, hook_end=h + hl,
                   clima="humor" if risos else "suspense",
                   efeitos=[Efeito(t=t, tipo="humor") for t in risos[:4]],
                   titulo=info["title"][:90], descricao=f"Corte de: {info['title']}\n#ia #inteligenciaartificial #cortes",
                   legendas=[])


def escolher_com_ia(segs, info, traduzir):
    import anthropic
    transcricao = "\n".join(f"[{s['start']:.1f}-{s['end']:.1f}] {s['text']}" for s in segs)
    picos = ""
    if info.get("heatmap"):
        top = sorted(info["heatmap"], key=lambda h: -h["value"])[:5]
        picos = "Trechos mais repetidos pelos espectadores (s): " + ", ".join(
            f"{h['start_time']:.0f}-{h['end_time']:.0f}" for h in top)
    legenda = ("a fala do trecho (start..end) traduzida para português do Brasil, em linhas de até 6 palavras, "
               "com start/end alinhados aos tempos da transcrição" if traduzir else "lista vazia []")
    prompt = f"""Você edita cortes virais de podcasts para um canal brasileiro de cortes sobre IA (YouTube Shorts).
Episódio: "{info['title']}" ({info['duration']:.0f} s). {picos}

Transcrição ([início-fim] texto, em segundos do vídeo original):
{transcricao}

Responda com:
- start/end: o melhor trecho contínuo de {TOTAL - 8} a {TOTAL - 3} s em que se fala de IA. O momento mais forte, que se entende sozinho, começando e terminando em fim de frase.
- hook_start/hook_end: o gancho, 3 a 6 s DE DENTRO desse trecho, depois dos primeiros 10 s dele: a frase mais chocante ou engraçada. Ele toca antes do corte.
- clima: "suspense" ou "humor", o tom do gancho.
- efeitos: até 4 momentos (t em segundos do vídeo original, dentro do trecho) que pedem efeito sonoro, cada um com tipo suspense ou humor.
- titulo: em português, até 70 caracteres, chamativo mas fiel ao conteúdo.
- descricao: 2 linhas em português + 3 hashtags.
- legendas: {legenda}."""
    r = anthropic.Anthropic().messages.parse(
        model=MODELO, max_tokens=16000, output_format=Escolha,
        messages=[{"role": "user", "content": prompt}])
    return None if r.stop_reason == "refusal" else r.parsed_output


def escolher(segs, lang, info):
    if os.environ.get("ANTHROPIC_API_KEY"):
        try:
            if e := escolher_com_ia(segs, info, traduzir=lang != IDIOMA):
                return e
        except Exception as err:
            print("IA falhou, usando heurística:", err, file=sys.stderr)
    return escolher_sem_ia(segs, info)


def encaixar(palavras, a, b):
    """Ajusta [a,b] pra não cortar palavra no meio."""
    d = [w for w in palavras if w[0] >= a - 0.2 and w[1] <= b + 0.2]
    return (max(0.0, d[0][0] - 0.1), d[-1][1] + 0.2) if d else (a, b)


def ajustar(e, palavras, dur):
    hl = min(max(e.hook_end - e.hook_start, 2.0), 8.0)
    s, fim = encaixar(palavras, max(0.0, e.start), min(e.end, dur, e.start + TOTAL - 1 - hl))
    hs = min(max(e.hook_start, s), fim - hl)
    hs, he = encaixar(palavras, hs, hs + hl)
    return s, fim, hs, he


# ---------- 3. editar ----------

def para_saida(t0, t1, trechos):
    """Projeta [t0,t1] do vídeo original na linha do tempo do corte (trechos em ordem de montagem)."""
    out, base = [], 0.0
    for ini, fim in trechos:
        a, b = max(t0, ini), min(t1, fim)
        if a < b or (t0 == t1 and ini <= t0 < fim):
            out.append((base + a - ini, base + b - ini))
        base += fim - ini
    return out


def picotar(linhas, n=3):
    """Quebra linhas em pedaços de até n palavras, dividindo o tempo proporcionalmente."""
    out = []
    for a, b, txt in linhas:
        ws = txt.split()
        k = max(1, -(-len(ws) // n))
        out += [(a + (b - a) * i / k, a + (b - a) * (i + 1) / k, " ".join(ws[i * n:(i + 1) * n])) for i in range(k)]
    return out


def ass(eventos):
    def ts(t):
        return f"{int(t // 3600)}:{int(t % 3600 // 60):02}:{t % 60:05.2f}"
    cab = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: L,Arial,84,&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,7,3,2,60,60,500,1
Style: G,Arial,92,&H0000FFFF,&H0000FFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,8,3,2,60,60,500,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    return cab + "".join(f"Dialogue: 0,{ts(a)},{ts(b)},{st},,0,0,0,,{re.sub(r'[{}]', '', txt).upper()}\n"
                         for a, b, txt, st in eventos)


def som(nome):
    if f := next(SFX.glob(f"{nome}.*"), None):
        return f
    expr, d = SONS[nome]
    f = SFX / f"{nome}.wav"
    sh(["ffmpeg", "-v", "error", "-y", "-f", "lavfi", "-i", f"aevalsrc={expr}:s=44100:d={d}", str(f)])
    return f


def montar(video, offset, nome, segs, e, s, fim, hs, he):
    """offset = segundo do episódio onde o arquivo `video` começa."""
    hl = he - hs
    trechos = [(hs, he), (s, fim)]
    if e.legendas:
        linhas = [(l.start, l.end, l.text) for l in e.legendas]
    else:
        linhas = [(g[0][0], g[-1][1], " ".join(w[2] for w in g))
                  for sg in segs for g in (sg["words"][i:i + 3] for i in range(0, len(sg["words"]), 3)) if g]
    eventos = [(a, b, txt, "G" if a < hl else "L")
               for t0, t1, txt in picotar(linhas) for a, b in para_saida(t0, t1, trechos)]
    (TRAB / f"{nome}.ass").write_text(ass(eventos), encoding="utf-8")

    sons = [("riser", max(0.0, hl - 3)), ("boom", hl)] if e.clima == "suspense" else [("boing", hl)]
    for c in e.efeitos:  # [-1:] = só a ocorrência no corte, não repete no gancho
        sons += [("boom" if c.tipo == "suspense" else "boing", a) for a, _ in para_saida(c.t, c.t, trechos)[-1:]]

    entradas = ["-ss", f"{hs - offset:.2f}", "-t", f"{hl:.2f}", "-i", str(video),
                "-ss", f"{s - offset:.2f}", "-t", f"{fim - s:.2f}", "-i", str(video)]
    fc = ["[0:v][0:a][1:v][1:a]concat=n=2:v=1:a=1[cv][ca]",
          "[cv]split[b][f]",
          "[b]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=25[bg]",
          "[f]scale=1080:-2[fg]",
          f"[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1,subtitles={nome}.ass[v]"]
    for i, (n, t) in enumerate(sons):
        entradas += ["-i", str(som(n))]
        fc.append(f"[{i + 2}:a]adelay={int(t * 1000)}:all=1,volume=0.6[s{i}]")
    mix = "".join(f"[s{i}]" for i in range(len(sons)))
    fc.append(f"[ca]{mix}amix=inputs={len(sons) + 1}:normalize=0:duration=first,alimiter=limit=0.95[a]")

    saida = SAIDA / f"{nome}.mp4"
    sh(["ffmpeg", "-v", "error", "-y", *entradas, "-filter_complex", ";".join(fc), "-map", "[v]", "-map", "[a]",
        "-r", "30", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-c:a", "aac", "-b:a", "160k",
        "-movflags", "+faststart", "-t", str(TOTAL), str(saida)], cwd=TRAB)
    return saida


def processar(audio, info, pegar_video):
    """pegar_video(s, fim) -> (arquivo de vídeo que cobre [s,fim], segundo onde ele começa)."""
    nome = re.sub(r"[^\w-]", "_", info["id"])
    segs, lang = transcrever(audio, regioes(info))
    e = escolher(segs, lang, info)
    palavras = [w for sg in segs for w in sg["words"]]
    s, fim, hs, he = ajustar(e, palavras, info["duration"])
    print(f"{nome}: corte {s:.1f}-{fim:.1f}s, gancho {hs:.1f}-{he:.1f}s, {e.clima} | {e.titulo}")
    return montar(*pegar_video(s, fim), nome, segs, e, s, fim, hs, he), e


# ---------- 4. postar ----------

def horario(hhmm, agora=None):
    """Próximo hh:mm de hoje no fuso do canal; None se já passou (aí posta na hora)."""
    agora = agora or datetime.now(FUSO)
    h, m = map(int, hhmm.split(":"))
    quando = agora.replace(hour=h, minute=m, second=0, microsecond=0)
    return quando if quando > agora + timedelta(minutes=15) else None


def youtube(interativo=False):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    escopo = ["https://www.googleapis.com/auth/youtube.upload"]
    token = AQUI / "token.json"
    cred = Credentials.from_authorized_user_file(str(token), escopo) if token.exists() else None
    if not cred or not cred.valid:
        try:
            cred.refresh(Request())
        except Exception:  # sem token, ou expirou (app "Em teste" no Google expira a cada 7 dias)
            if not interativo:  # rodando sozinho às 5h: avisa em vez de travar esperando o navegador
                sys.exit("Autorização do YouTube expirou ou não existe. Rode:  python cortes.py --autorizar")
            cred = InstalledAppFlow.from_client_secrets_file(str(AQUI / "client_secret.json"), escopo).run_local_server(port=0)
        token.write_text(cred.to_json())
    return build("youtube", "v3", credentials=cred)


def postar(arquivo, e, info, quando=None):
    from googleapiclient.http import MediaFileUpload
    corpo = {
        "snippet": {"title": e.titulo[:100], "categoryId": "28",
                    "description": f"{e.descricao}\n\nFonte: {info['title']} - https://youtu.be/{info['id']}",
                    "tags": ["IA", "inteligência artificial", "cortes", "shorts"]},
        "status": {"privacyStatus": PRIVACIDADE, "selfDeclaredMadeForKids": False},
    }
    if quando and PRIVACIDADE == "public":  # agendado: fica privado e o YouTube publica sozinho na hora
        corpo["status"].update(privacyStatus="private",
                               publishAt=quando.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    req = youtube().videos().insert(
        part="snippet,status", body=corpo, media_body=MediaFileUpload(str(arquivo), resumable=True))
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    return f"https://youtube.com/shorts/{resp['id']}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-upload", action="store_true", help="só gera os cortes, não posta")
    ap.add_argument("--video", help="edita um arquivo local em vez de buscar no YouTube")
    ap.add_argument("--autorizar", action="store_true", help="só conecta o canal do YouTube (1ª vez)")
    a = ap.parse_args()
    for s in (sys.stdout, sys.stderr):  # log do Windows não quebra com emoji no título
        s.reconfigure(errors="replace")
    if a.autorizar:
        youtube(interativo=True)
        print("Canal autorizado.")
        return
    for d in (TRAB, SAIDA, SFX):
        d.mkdir(exist_ok=True)

    if a.video:
        p = Path(a.video).resolve()
        meta = p.with_suffix(".info.json")
        info = json.loads(meta.read_text()) if meta.exists() else {"id": p.stem, "title": p.stem}
        info["duration"] = info.get("duration") or duracao(p)
        print(processar(p, info, lambda s, fim: (p, 0))[0])
        return

    if not a.no_upload:
        youtube()  # confere a autorização antes de gastar meia hora editando
    feitos = set(json.loads(HISTORICO.read_text())) if HISTORICO.exists() else set()
    prontos = 0
    for v in buscar(feitos):
        if prontos == len(HORARIOS):
            break
        try:
            audio, info = baixar_audio(v["id"])
            arquivo, e = processar(audio, info, lambda s, fim: baixar_trecho(v["id"], s, fim))
            if not a.no_upload:
                quando = horario(HORARIOS[prontos])
                print(f"  {'agendado p/ ' + quando.strftime('%H:%M') if quando else 'postado'}:", postar(arquivo, e, info, quando))
            prontos += 1
            feitos.add(v["id"])
            HISTORICO.write_text(json.dumps(sorted(feitos)))
            for f in TRAB.glob(f"{v['id']}.*"):  # libera espaço
                f.unlink()
        except Exception as err:  # um vídeo ruim não derruba o lote
            print(f"  falhou {v['id']}: {err}", file=sys.stderr)


if __name__ == "__main__":
    main()
