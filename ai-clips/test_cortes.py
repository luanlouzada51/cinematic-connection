from cortes import Escolha, ajustar, melhor_janela, para_saida, picotar

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
print("ok")
