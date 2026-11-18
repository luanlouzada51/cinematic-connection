#!/usr/bin/env python3
"""Cortes de IA: acha os vídeos de IA mais vistos, gera cortes verticais de ~1 min
(gancho + corte, legenda, efeito sonoro de suspense/humor) e posta no YouTube.

  python cortes.py               # rotina diária completa
  python cortes.py --no-upload   # só gera os cortes em saida/
  python cortes.py --video X.mp4 # edita um vídeo local (teste)
"""
import argparse
import itertools
import json
import os
import re
import subprocess
import sys
from functools import cache
from pathlib import Path
from typing import Literal
from urllib.parse import quote

from pydantic import BaseModel

AQUI = Path(__file__).resolve().parent
TRAB, SAIDA, SFX = AQUI / "trabalho", AQUI / "saida", AQUI / "sfx"
HISTORICO = AQUI / "feitos.json"

BUSCAS = ["inteligência artificial", "artificial intelligence", "ChatGPT", "OpenAI"]
FILTRO = os.environ.get("FILTRO", "CAMSAggD")  # mais vistos da semana; "CAMSAggC" = só de hoje
TOP_N = int(os.environ.get("TOP_N", 10))
DURACAO_FONTE = (180, 2400)  # só vídeos de 3 a 40 min (material pra cortar)
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
    if nav := os.environ.get("COOKIES_DO_NAVEGADOR"):  # ex: chrome, firefox, edge
        o["cookiesfrombrowser"] = (nav,)
    return o


def buscar(feitos):
    import yt_dlp
    achados = {}
    with yt_dlp.YoutubeDL(opts_ytdlp(extract_flat=True, playlistend=40)) as ydl:
        for q in BUSCAS:
            url = f"https://www.youtube.com/results?search_query={quote(q)}&sp={FILTRO}"
            for v in ydl.extract_info(url, download=False).get("entries") or []:
                if v.get("id") not in feitos and DURACAO_FONTE[0] <= (v.get("duration") or 0) <= DURACAO_FONTE[1]:
                    achados[v["id"]] = v
    return sorted(achados.values(), key=lambda v: v.get("view_count") or 0, reverse=True)[:TOP_N]


def baixar(vid):
    import yt_dlp
    with yt_dlp.YoutubeDL(opts_ytdlp(format="bv*[height<=1080]+ba/b", merge_output_format="mp4",
                                     outtmpl=str(TRAB / "%(id)s.%(ext)s"))) as ydl:
        info = ydl.extract_info(f"https://www.youtube.com/watch?v={vid}")
    return TRAB / f"{vid}.mp4", info


# ---------- 2. ler (transcrever) e escolher o corte ----------

@cache
def whisper():
    from faster_whisper import WhisperModel
    return WhisperModel(WHISPER, device="cpu", compute_type="int8")


def transcrever(video):
    import numpy as np  # áudio decodificado pelo ffmpeg: o decoder do faster-whisper quebra com PyAV novo
    pcm = subprocess.check_output(["ffmpeg", "-v", "error", "-i", str(video), "-ac", "1", "-ar", "16000", "-f", "f32le", "-"])
    segs, info = whisper().transcribe(np.frombuffer(pcm, np.float32), word_timestamps=True, vad_filter=True)
    segs = [{"start": s.start, "end": s.end, "text": s.text.strip(),
             "words": [(w.start, w.end, w.word.strip()) for w in s.words or []]} for s in segs]
    return segs, info.language


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
    prompt = f"""Você edita cortes virais para um canal brasileiro de cortes sobre IA (YouTube Shorts).
Vídeo: "{info['title']}" ({info['duration']:.0f} s). {picos}

Transcrição ([início-fim] texto, em segundos do vídeo original):
{transcricao}

Responda com:
- start/end: o melhor trecho contínuo de {TOTAL - 8} a {TOTAL - 3} s. O momento mais forte, que se entende sozinho, começando e terminando em fim de frase.
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
    s, fim = encaixar(palavras, max(0.0, e.start), min(e.end, dur, e.start + TOTAL - hl))
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


def montar(video, nome, segs, e, s, fim, hs, he):
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

    entradas = ["-ss", f"{hs:.2f}", "-t", f"{hl:.2f}", "-i", str(video),
                "-ss", f"{s:.2f}", "-t", f"{fim - s:.2f}", "-i", str(video)]
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
        "-movflags", "+faststart", str(saida)], cwd=TRAB)
    return saida


def processar(video, info):
    nome = re.sub(r"[^\w-]", "_", info["id"])
    segs, lang = transcrever(video)
    e = escolher(segs, lang, info)
    palavras = [w for sg in segs for w in sg["words"]]
    s, fim, hs, he = ajustar(e, palavras, info["duration"])
    print(f"{nome}: corte {s:.1f}-{fim:.1f}s, gancho {hs:.1f}-{he:.1f}s, {e.clima} | {e.titulo}")
    return montar(video, nome, segs, e, s, fim, hs, he), e


# ---------- 4. postar ----------

def postar(arquivo, e, info):
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    from googleapiclient.http import MediaFileUpload
    escopo = ["https://www.googleapis.com/auth/youtube.upload"]
    token = AQUI / "token.json"
    cred = Credentials.from_authorized_user_file(str(token), escopo) if token.exists() else None
    if not cred or not cred.valid:
        if cred and cred.expired and cred.refresh_token:
            cred.refresh(Request())
        else:  # 1ª vez: abre o navegador pra você autorizar o canal
            cred = InstalledAppFlow.from_client_secrets_file(str(AQUI / "client_secret.json"), escopo).run_local_server(port=0)
        token.write_text(cred.to_json())
    corpo = {
        "snippet": {"title": e.titulo[:100], "categoryId": "28",
                    "description": f"{e.descricao}\n\nFonte: {info['title']} - https://youtu.be/{info['id']}",
                    "tags": ["IA", "inteligência artificial", "cortes", "shorts"]},
        "status": {"privacyStatus": PRIVACIDADE, "selfDeclaredMadeForKids": False},
    }
    req = build("youtube", "v3", credentials=cred).videos().insert(
        part="snippet,status", body=corpo, media_body=MediaFileUpload(str(arquivo), resumable=True))
    resp = None
    while resp is None:
        _, resp = req.next_chunk()
    return f"https://youtube.com/shorts/{resp['id']}"


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--no-upload", action="store_true", help="só gera os cortes, não posta")
    ap.add_argument("--video", help="edita um arquivo local em vez de buscar no YouTube")
    a = ap.parse_args()
    for d in (TRAB, SAIDA, SFX):
        d.mkdir(exist_ok=True)

    if a.video:
        p = Path(a.video).resolve()
        meta = p.with_suffix(".info.json")
        info = json.loads(meta.read_text()) if meta.exists() else {"id": p.stem, "title": p.stem}
        info["duration"] = info.get("duration") or duracao(p)
        print(processar(p, info)[0])
        return

    feitos = set(json.loads(HISTORICO.read_text())) if HISTORICO.exists() else set()
    for v in buscar(feitos):
        try:
            video, info = baixar(v["id"])
            arquivo, e = processar(video, info)
            if not a.no_upload:
                print("  postado:", postar(arquivo, e, info))
            feitos.add(v["id"])
            HISTORICO.write_text(json.dumps(sorted(feitos)))
            video.unlink(missing_ok=True)
        except Exception as err:  # um vídeo ruim não derruba o lote
            print(f"  falhou {v['id']}: {err}", file=sys.stderr)


if __name__ == "__main__":
    main()
