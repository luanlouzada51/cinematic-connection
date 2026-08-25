ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS interested_in text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS allow_matches boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_private_chats boolean NOT NULL DEFAULT true;

ALTER TABLE public.watchlist
  ADD COLUMN IF NOT EXISTS watched boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS watched_at timestamptz;

CREATE OR REPLACE FUNCTION public.claim_owner_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE is_owner boolean;
BEGIN
  SELECT lower(u.email) = 'luanlouzada51@gmail.com' INTO is_owner
  FROM auth.users u WHERE u.id = auth.uid();
  IF NOT COALESCE(is_owner, false) THEN RETURN false; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (auth.uid(), 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  UPDATE public.profiles SET is_premium = true WHERE id = auth.uid();
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_owner_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_owner_admin() FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_owner_admin() TO authenticated;

INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin' FROM auth.users u
WHERE lower(u.email) = 'luanlouzada51@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

UPDATE public.profiles p SET is_premium = true
FROM auth.users u WHERE u.id = p.id AND lower(u.email) = 'luanlouzada51@gmail.com';

CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all reports" ON public.reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.titles (title, year, kind, overview, poster_url, genre_slugs)
SELECT v.title, v.year, v.kind, v.overview, v.poster_url, v.genre_slugs FROM (VALUES
(CAST('Tropa de Elite' AS text),2007,'movie','Elite Squad is a 2007 Brazilian crime film based on the novel Elite da Tropa by Luiz Eduardo Soares, André Batista, and Rodrigo Pimentel.','https://upload.wikimedia.org/wikipedia/en/d/d7/Elite_Squad.png',ARRAY['acao','crime']),
('Central do Brasil',1998,'movie','Central Station is a 1998 road drama film directed by Walter Salles from a screenplay by João Emanuel Carneiro and Marcos Bernstein, based on an original idea by Salles.','https://upload.wikimedia.org/wikipedia/en/1/12/Central-do-brasil-poster04.jpg',ARRAY['drama']),
('O Auto da Compadecida',2000,'movie','O Auto da Compadecida é um filme brasileiro de comédia dramática, lançado em 2000, dirigido por Guel Arraes.','https://upload.wikimedia.org/wikipedia/pt/b/bf/O_auto_da_compadecida.jpg',ARRAY['comedia','aventura']),
('Bacurau',2019,'movie','Bacurau is a 2019 surreal Weird Western film written and directed by Kleber Mendonça Filho and Juliano Dornelles.','https://upload.wikimedia.org/wikipedia/en/9/92/Bacurau_poster.jpg',ARRAY['suspense','ficcao']),
('Aquarius',2016,'movie','Aquarius é um filme franco-brasileiro, dos gêneros drama e suspense, escrito e dirigido por Kleber Mendonça Filho.','https://upload.wikimedia.org/wikipedia/pt/8/80/Aquarius_%28filme%29.jpg',ARRAY['drama']),
('Que Horas Ela Volta?',2015,'movie','The Second Mother is a 2015 Brazilian drama film written and directed by Anna Muylaert.','https://upload.wikimedia.org/wikipedia/en/f/f3/The_Second_Mother_%282015_film%29_POSTER.jpg',ARRAY['drama']),
('Ainda Estou Aqui',2024,'movie','I''m Still Here is a 2024 political biographical drama film directed by Walter Salles.','https://upload.wikimedia.org/wikipedia/en/0/0a/I%27m_Still_Here_%282024_film%29_poster.jpg',ARRAY['drama']),
('Minha Mãe é uma Peça',2013,'movie','Longa-metragem de comédia brasileiro dirigido por André Pellenz, protagonizado por Paulo Gustavo.','https://upload.wikimedia.org/wikipedia/pt/d/da/Minha_M%C3%A3e_%C3%A9_uma_Pe%C3%A7a.jpg',ARRAY['comedia']),
('Cidade Invisível',2021,'series','Invisible City is a Brazilian fantasy television series created by Carlos Saldanha.','https://upload.wikimedia.org/wikipedia/en/3/33/Invisible_City_poster.png',ARRAY['fantasia','misterio']),
('O Mecanismo',2018,'series','O Mecanismo é uma série de televisão brasileira, criada por José Padilha e Elena Soarez.','https://upload.wikimedia.org/wikipedia/pt/8/88/O_Mecanismo.jpg',ARRAY['crime','drama']),
('Roma',2018,'movie','Roma é um filme de drama escrito e dirigido por Alfonso Cuarón.','https://upload.wikimedia.org/wikipedia/pt/f/f1/Roma_-_Poster.jpeg',ARRAY['drama']),
('Coco',2017,'movie','Coco is a 2017 American animated fantasy comedy-drama film produced by Pixar Animation Studios.','https://upload.wikimedia.org/wikipedia/en/9/98/Coco_%282017_film%29_poster.jpg',ARRAY['animacao']),
('El Secreto de sus Ojos',2009,'movie','Filme argentino de 2009, dirigido por Juan José Campanella.','https://upload.wikimedia.org/wikipedia/pt/5/5f/Segredo_Seus_Olhos.jpg',ARRAY['crime','romance']),
('Relatos Salvajes',2014,'movie','Wild Tales is a 2014 satirical absurdist dark comedy anthology film by Damián Szifron.','https://upload.wikimedia.org/wikipedia/en/5/5e/Relatos_salvajes.jpg',ARRAY['comedia','drama']),
('Whiplash',2014,'movie','Whiplash is a 2014 American drama film written and directed by Damien Chazelle.','https://upload.wikimedia.org/wikipedia/en/0/01/Whiplash_poster.jpg',ARRAY['drama','musical']),
('Fight Club',1999,'movie','Fight Club is a 1999 American film directed by David Fincher and starring Brad Pitt and Edward Norton.','https://upload.wikimedia.org/wikipedia/en/f/fc/Fight_Club_poster.jpg',ARRAY['drama','suspense']),
('The Matrix',1999,'movie','The Matrix is a 1999 science fiction action film written and directed by the Wachowskis.','https://upload.wikimedia.org/wikipedia/en/d/db/The_Matrix.png',ARRAY['acao','ficcao']),
('Blade Runner 2049',2017,'movie','Blade Runner 2049 is a 2017 American science fiction film directed by Denis Villeneuve.','https://upload.wikimedia.org/wikipedia/en/9/9b/Blade_Runner_2049_poster.png',ARRAY['ficcao','drama']),
('Arrival',2016,'movie','Arrival is a 2016 American science fiction drama film directed by Denis Villeneuve.','https://upload.wikimedia.org/wikipedia/en/d/df/Arrival%2C_Movie_Poster.jpg',ARRAY['ficcao','drama']),
('The Social Network',2010,'movie','The Social Network is a 2010 American biographical drama film directed by David Fincher.','https://upload.wikimedia.org/wikipedia/en/8/8c/The_Social_Network_film_poster.png',ARRAY['drama']),
('Joker',2019,'movie','Joker is a 2019 American psychological thriller film directed by Todd Phillips.','https://upload.wikimedia.org/wikipedia/en/e/e1/Joker_%282019_film%29_poster.jpg',ARRAY['crime','drama']),
('Spider-Man: Into the Spider-Verse',2018,'movie','A 2018 American animated superhero film based on the Marvel Comics character Spider-Man.','https://upload.wikimedia.org/wikipedia/en/f/fa/Spider-Man_Into_the_Spider-Verse_poster.png',ARRAY['animacao','acao']),
('Avengers: Endgame',2019,'movie','Filme de super-herói americano de 2019 baseado na equipe Vingadores da Marvel Comics.','https://upload.wikimedia.org/wikipedia/pt/9/9b/Avengers_Endgame.jpg',ARRAY['acao','aventura']),
('Top Gun: Maverick',2022,'movie','Top Gun: Maverick is a 2022 American action drama film directed by Joseph Kosinski.','https://upload.wikimedia.org/wikipedia/en/1/13/Top_Gun_Maverick_Poster.jpg',ARRAY['acao','drama']),
('John Wick',2014,'movie','John Wick is a 2014 American neo-noir action thriller starring Keanu Reeves.','https://upload.wikimedia.org/wikipedia/en/9/98/John_Wick_TeaserPoster.jpg',ARRAY['acao','crime']),
('Gladiator',2000,'movie','Gladiator is a 2000 epic action adventure drama film directed by Ridley Scott.','https://upload.wikimedia.org/wikipedia/en/f/fb/Gladiator_%282000_film_poster%29.png',ARRAY['acao','drama']),
('Forrest Gump',1994,'movie','Forrest Gump is a 1994 American comedy-drama film directed by Robert Zemeckis.','https://upload.wikimedia.org/wikipedia/en/6/67/Forrest_Gump_poster.jpg',ARRAY['drama','romance']),
('The Shawshank Redemption',1994,'movie','A 1994 American drama film written and directed by Frank Darabont, based on a Stephen King novella.','https://upload.wikimedia.org/wikipedia/en/8/81/ShawshankRedemptionMoviePoster.jpg',ARRAY['drama']),
('Titanic',1997,'movie','Titanic is a 1997 American epic historical romance film written and directed by James Cameron.','https://upload.wikimedia.org/wikipedia/en/1/18/Titanic_%281997_film%29_poster.png',ARRAY['romance','drama']),
('Eternal Sunshine of the Spotless Mind',2004,'movie','A 2004 American science fiction romantic comedy-drama film directed by Michel Gondry.','https://upload.wikimedia.org/wikipedia/en/a/a4/Eternal_Sunshine_of_the_Spotless_Mind.png',ARRAY['romance','ficcao']),
('Call Me by Your Name',2017,'movie','A 2017 coming-of-age romantic drama film directed by Luca Guadagnino.','https://upload.wikimedia.org/wikipedia/en/c/c9/CallMeByYourName2017.png',ARRAY['romance','drama']),
('Past Lives',2023,'movie','Past Lives is a 2023 romantic drama film written and directed by Celine Song.','https://upload.wikimedia.org/wikipedia/en/d/da/Past_Lives_film_poster.png',ARRAY['romance','drama']),
('Poor Things',2023,'movie','Pobres Criaturas é um longa-metragem de fantasia dirigido por Yorgos Lanthimos.','https://upload.wikimedia.org/wikipedia/pt/f/f3/Poor_Things_poster.jpg',ARRAY['fantasia','comedia']),
('Anatomy of a Fall',2023,'movie','A 2023 French legal drama film directed by Justine Triet.','https://upload.wikimedia.org/wikipedia/en/8/88/Anatomy_of_a_Fall_%282023%29_film_poster.jpg',ARRAY['misterio','drama']),
('The Substance',2024,'movie','The Substance is a 2024 body horror film written and directed by Coralie Fargeat.','https://upload.wikimedia.org/wikipedia/en/f/ff/The_Substance_poster.jpg',ARRAY['terror','ficcao']),
('Sinners',2025,'movie','Sinners is a 2025 American horror film written and directed by Ryan Coogler.','https://upload.wikimedia.org/wikipedia/en/5/5f/Sinners_%282025_film%29_poster.jpg',ARRAY['terror','drama']),
('Dune: Part Two',2024,'movie','Dune: Part Two is a 2024 American epic space opera film directed by Denis Villeneuve.','https://upload.wikimedia.org/wikipedia/en/5/52/Dune_Part_Two_poster.jpeg',ARRAY['ficcao','aventura']),
('Wicked',2024,'movie','Wicked is a 2024 American musical fantasy film directed by Jon M. Chu.','https://upload.wikimedia.org/wikipedia/en/3/3c/Wicked_%282024_film%29_poster.png',ARRAY['musical','fantasia']),
('Toy Story',1995,'movie','Toy Story is a 1995 American animated adventure comedy film directed by John Lasseter.','https://upload.wikimedia.org/wikipedia/en/1/13/Toy_Story.jpg',ARRAY['animacao','aventura']),
('Up',2009,'movie','Up is a 2009 American animated adventure comedy-drama film directed by Pete Docter.','https://upload.wikimedia.org/wikipedia/en/0/05/Up_%282009_film%29.jpg',ARRAY['animacao','aventura']),
('Your Name',2016,'movie','Your Name is a 2016 Japanese animated romantic fantasy film directed by Makoto Shinkai.','https://upload.wikimedia.org/wikipedia/en/0/0b/Your_Name_poster.png',ARRAY['animacao','romance']),
('Oldboy',2003,'movie','Oldboy is a 2003 South Korean action thriller film directed by Park Chan-wook.','https://upload.wikimedia.org/wikipedia/en/6/67/Oldboykoreanposter.jpg',ARRAY['suspense','crime']),
('The Lord of the Rings: The Fellowship of the Ring',2001,'movie','A 2001 epic fantasy film directed by Peter Jackson.','https://upload.wikimedia.org/wikipedia/en/f/fb/Lord_Rings_Fellowship_Ring.jpg',ARRAY['fantasia','aventura']),
('Harry Potter and the Philosopher''s Stone',2001,'movie','Filme britano-americano de 2001, dos gêneros aventura e fantasia, dirigido por Chris Columbus.','https://upload.wikimedia.org/wikipedia/pt/1/1d/Harry_Potter_Pedra_Filosofal_2001.jpg',ARRAY['fantasia','aventura']),
('The Silence of the Lambs',1991,'movie','A 1991 American psychological horror thriller film directed by Jonathan Demme.','https://upload.wikimedia.org/wikipedia/en/8/86/The_Silence_of_the_Lambs_poster.jpg',ARRAY['suspense','crime']),
('A Quiet Place',2018,'movie','Filme americano de 2018 dos gêneros terror pós-apocalíptico e suspense, dirigido por John Krasinski.','https://upload.wikimedia.org/wikipedia/pt/2/2f/Lugar_Silencioso_2018.png',ARRAY['terror','ficcao']),
('It',2017,'movie','Filme de terror sobrenatural norte-americano de 2017, dirigido por Andy Muschietti.','https://upload.wikimedia.org/wikipedia/pt/8/82/It_2017.jpg',ARRAY['terror']),
('The Conjuring',2013,'movie','Filme estadunidense do gênero terror dirigido por James Wan.','https://upload.wikimedia.org/wikipedia/pt/a/ac/The_Conjuring.jpg',ARRAY['terror','suspense']),
('The Last of Us',2023,'series','Série de drama pós-apocalíptico da HBO baseada no jogo da Naughty Dog.','https://upload.wikimedia.org/wikipedia/pt/b/be/The_Last_of_Us_capa.png',ARRAY['drama','ficcao']),
('Succession',2018,'series','Série de comédia dramática norte-americana criada por Jesse Armstrong.','https://upload.wikimedia.org/wikipedia/pt/0/07/Succession.png',ARRAY['drama']),
('Peaky Blinders',2013,'series','Peaky Blinders is a British historical crime drama television series created by Steven Knight.','https://upload.wikimedia.org/wikipedia/en/e/e8/Peaky_Blinders_titlecard.jpg',ARRAY['crime','drama']),
('The Crown',2016,'series','Série de televisão britânica-americana do gênero drama biográfico criada por Peter Morgan.','https://upload.wikimedia.org/wikipedia/pt/5/50/The-crown-theme-logo.jpg',ARRAY['drama'])
) AS v(title, year, kind, overview, poster_url, genre_slugs)
WHERE NOT EXISTS (SELECT 1 FROM public.titles t WHERE t.title = v.title);