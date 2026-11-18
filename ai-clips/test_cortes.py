from cortes import SOBRE_IA, Escolha, ajustar, melhor_janela, para_saida, picotar, regioes

# gancho (10-14s) toca primeiro, depois o corte (5-50s)
trechos = [(10, 14), (5, 50)]
assert para_saida(11, 12, trechos) == [(1, 2), (10, 11)]  # fala do gancho aparece 2x
assert para_saida(30, 31, trechos) == [(29, 30)]
assert para_saida(12, 12, trechos)[-1:] == [(11, 11)]  # efeito pontual: só no corte
assert para_saida(60, 61, trechos) == []

assert melhor_janela([0, 0, 5, 5, 0, 1], 2) == 2

assert picotar([(0, 3, "um dois tres quatro cinco seis")]) == [(0, 1.5, "um dois tres"), (1.5, 3, "quatro cinco seis")]

# IA devolve corte longo demais e gancho fora dele: ajustar põe tudo dentro de 60s
palavras = [(t, t + 0.5, "x") for t in range(200)]
e = Escolha(start=10, end=100, hook_start=150, hook_end=155, clima="humor", efeitos=[], titulo="", descricao="", legendas=[])
s, fim, hs, he = ajustar(e, palavras, 200)
assert (fim - s) + (he - hs) <= 61 and s <= hs < he <= fim, (s, fim, hs, he)
# títulos reais da busca: falam de IA x não falam
for titulo in ["A IA PODE DESTRUIR A HUMANIDADE? Sérgio Sacani", "AI Bubble: 'Circular financing is over' | Ed Zitron",
               "INTELIGÊNCIA ARTIFICIAL, TÉDIO E MORTE ft. Mario Sergio Cortella", "Jensen OUT as Nvidia CEO"]:
    assert SOBRE_IA.search(titulo), titulo
for titulo in ["VISAGENS E ASSOMBRAÇÕES - DAN PIRES - Inteligência Ltda. Podcast", "75% of Therapists Are Women",
               "Eu ia falar disso ontem"]:
    assert not SOBRE_IA.search(titulo), titulo

# episódio de 2 h: transcreve só os 3 picos de "mais repetidos", fora a abertura
hm = [{"start_time": i * 72, "end_time": (i + 1) * 72, "value": v} for i, v in enumerate([1.0] + [0.1] * 99)]
hm[50]["value"], hm[51]["value"], hm[80]["value"], hm[20]["value"] = 0.9, 0.8, 0.7, 0.6
r = regioes({"duration": 7200, "heatmap": hm})
assert len(r) == 3 and all(b - a == 240 for a, b in r) and r[0][0] > 60, r  # pico 51 fica junto do 50
assert regioes({"duration": 600}) == [(0, 600)]
print("ok")
