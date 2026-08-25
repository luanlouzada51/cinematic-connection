ALTER TABLE public.titles ADD COLUMN IF NOT EXISTS country text;

UPDATE public.titles SET country = 'BR'
WHERE title IN (
  'Cidade de Deus','Tropa de Elite','Tropa de Elite 2','Central do Brasil','Bacurau',
  'Aquarius','O Auto da Compadecida','Que Horas Ela Volta?','Ainda Estou Aqui','Carandiru',
  'Cidade dos Homens','Minha Mãe é uma Peça','Os Normais','3%','Coisa Mais Linda'
);

UPDATE public.titles SET country = 'US' WHERE country IS NULL;