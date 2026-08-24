-- ============ ENUM / ROLES ============
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- ============ GENRES / TITLES ============
CREATE TABLE public.genres (
  slug text PRIMARY KEY,
  name_pt text NOT NULL,
  name_en text NOT NULL,
  name_es text NOT NULL,
  sort int NOT NULL DEFAULT 0
);
GRANT SELECT ON public.genres TO anon, authenticated;
GRANT ALL ON public.genres TO service_role;
ALTER TABLE public.genres ENABLE ROW LEVEL SECURITY;
CREATE POLICY "genres public read" ON public.genres FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('movie','series')),
  year int,
  overview text,
  poster_url text,
  cast_list text,
  genre_slugs text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.titles TO anon, authenticated;
GRANT ALL ON public.titles TO service_role;
ALTER TABLE public.titles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "titles public read" ON public.titles FOR SELECT TO anon, authenticated USING (true);

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  avatar_url text,
  age int,
  city text,
  bio text,
  gender text,
  favorite_genres text[] NOT NULL DEFAULT '{}',
  language text NOT NULL DEFAULT 'pt',
  is_premium boolean NOT NULL DEFAULT false,
  onboarding_done boolean NOT NULL DEFAULT false,
  taste_vector jsonb NOT NULL DEFAULT '{}'::jsonb,
  streak_count int NOT NULL DEFAULT 0,
  last_rating_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by signed in" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
          NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RATINGS / WATCHLIST / SWIPES ============
CREATE TABLE public.ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id uuid NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  stars int NOT NULL CHECK (stars BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, title_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratings TO authenticated;
GRANT ALL ON public.ratings TO service_role;
ALTER TABLE public.ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ratings readable by signed in" ON public.ratings FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage own ratings" ON public.ratings FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.watchlist (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id uuid NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_id)
);
GRANT SELECT, INSERT, DELETE ON public.watchlist TO authenticated;
GRANT ALL ON public.watchlist TO service_role;
ALTER TABLE public.watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own watchlist" ON public.watchlist FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.content_swipes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id uuid NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  interested boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, title_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_swipes TO authenticated;
GRANT ALL ON public.content_swipes TO service_role;
ALTER TABLE public.content_swipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own content swipes" ON public.content_swipes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.recalc_taste() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid; vec jsonb; last_d date; cur int;
BEGIN
  uid := COALESCE(NEW.user_id, OLD.user_id);
  SELECT COALESCE(jsonb_object_agg(g, avg_stars), '{}'::jsonb) INTO vec FROM (
    SELECT unnest(t.genre_slugs) AS g, AVG(r.stars)::numeric(4,2) AS avg_stars
    FROM public.ratings r JOIN public.titles t ON t.id = r.title_id
    WHERE r.user_id = uid GROUP BY 1
  ) s;
  SELECT last_rating_date, streak_count INTO last_d, cur FROM public.profiles WHERE id = uid;
  IF TG_OP <> 'DELETE' THEN
    IF last_d IS NULL THEN cur := 1;
    ELSIF last_d = CURRENT_DATE THEN cur := GREATEST(cur, 1);
    ELSIF last_d = CURRENT_DATE - 1 THEN cur := cur + 1;
    ELSE cur := 1;
    END IF;
    UPDATE public.profiles SET taste_vector = vec, streak_count = cur, last_rating_date = CURRENT_DATE WHERE id = uid;
  ELSE
    UPDATE public.profiles SET taste_vector = vec WHERE id = uid;
  END IF;
  RETURN NULL;
END; $$;
CREATE TRIGGER ratings_taste AFTER INSERT OR UPDATE OR DELETE ON public.ratings FOR EACH ROW EXECUTE FUNCTION public.recalc_taste();

CREATE OR REPLACE VIEW public.title_scores WITH (security_invoker = true) AS
SELECT t.id AS title_id, COALESCE(AVG(r.stars), 0)::numeric(4,2) AS avg_stars, COUNT(r.id) AS ratings_count
FROM public.titles t LEFT JOIN public.ratings r ON r.title_id = t.id GROUP BY t.id;
GRANT SELECT ON public.title_scores TO anon, authenticated;

-- ============ PEOPLE / MATCHES / CHAT ============
CREATE TABLE public.person_swipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  liked boolean NOT NULL,
  super_like boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (swiper_id, target_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_swipes TO authenticated;
GRANT ALL ON public.person_swipes TO service_role;
ALTER TABLE public.person_swipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read swipes involving me" ON public.person_swipes FOR SELECT TO authenticated USING (auth.uid() = swiper_id OR auth.uid() = target_id);
CREATE POLICY "manage own swipes" ON public.person_swipes FOR ALL TO authenticated USING (auth.uid() = swiper_id) WITH CHECK (auth.uid() = swiper_id);

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_a, user_b)
);
GRANT SELECT, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own matches" ON public.matches FOR SELECT TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "delete own matches" ON public.matches FOR DELETE TO authenticated USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read messages of my matches" ON public.messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid()))
);
CREATE POLICY "send messages in my matches" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid()))
);

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  body text NOT NULL,
  link text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own notifications" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_person_swipe() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reciprocal boolean; a uuid; b uuid; mid uuid; me_name text; other_name text;
BEGIN
  IF NOT NEW.liked THEN RETURN NEW; END IF;
  SELECT EXISTS (SELECT 1 FROM public.person_swipes s WHERE s.swiper_id = NEW.target_id AND s.target_id = NEW.swiper_id AND s.liked) INTO reciprocal;
  IF NOT reciprocal THEN RETURN NEW; END IF;
  a := LEAST(NEW.swiper_id, NEW.target_id); b := GREATEST(NEW.swiper_id, NEW.target_id);
  INSERT INTO public.matches (user_a, user_b) VALUES (a, b) ON CONFLICT DO NOTHING RETURNING id INTO mid;
  IF mid IS NULL THEN RETURN NEW; END IF;
  SELECT display_name INTO me_name FROM public.profiles WHERE id = NEW.swiper_id;
  SELECT display_name INTO other_name FROM public.profiles WHERE id = NEW.target_id;
  INSERT INTO public.notifications (user_id, kind, body, link)
  VALUES (NEW.swiper_id, 'match', 'Novo match com ' || COALESCE(other_name,'alguém') || '!', '/chat/' || mid),
         (NEW.target_id, 'match', 'Novo match com ' || COALESCE(me_name,'alguém') || '!', '/chat/' || mid);
  RETURN NEW;
END; $$;
CREATE TRIGGER person_swipes_match AFTER INSERT OR UPDATE ON public.person_swipes FOR EACH ROW EXECUTE FUNCTION public.handle_person_swipe();

CREATE OR REPLACE FUNCTION public.notify_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE other uuid; sname text;
BEGIN
  SELECT CASE WHEN m.user_a = NEW.sender_id THEN m.user_b ELSE m.user_a END INTO other FROM public.matches m WHERE m.id = NEW.match_id;
  SELECT display_name INTO sname FROM public.profiles WHERE id = NEW.sender_id;
  INSERT INTO public.notifications (user_id, kind, body, link)
  VALUES (other, 'message', 'Nova mensagem de ' || COALESCE(sname,'alguém'), '/chat/' || NEW.match_id);
  RETURN NEW;
END; $$;
CREATE TRIGGER messages_notify AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.notify_message();

CREATE TABLE public.blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
GRANT SELECT, INSERT, DELETE ON public.blocks TO authenticated;
GRANT ALL ON public.blocks TO service_role;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "manage own blocks" ON public.blocks FOR ALL TO authenticated USING (auth.uid() = blocker_id) WITH CHECK (auth.uid() = blocker_id);

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  context text,
  reason text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "create own reports" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "read own reports" ON public.reports FOR SELECT TO authenticated USING (auth.uid() = reporter_id OR public.has_role(auth.uid(),'admin'));

-- ============ COMMUNITIES ============
CREATE TABLE public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  genre_slug text NOT NULL REFERENCES public.genres(slug) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('movie','series')),
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  score int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT SELECT ON public.posts TO anon;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts public read" ON public.posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "create own posts" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "edit own posts" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "delete own posts" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(),'moderator'));

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.comments TO authenticated;
GRANT SELECT ON public.comments TO anon;
GRANT ALL ON public.comments TO service_role;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments public read" ON public.comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "create own comments" ON public.comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "delete own comments" ON public.comments FOR DELETE TO authenticated USING (auth.uid() = author_id OR public.has_role(auth.uid(),'moderator'));

CREATE TABLE public.votes (
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value int NOT NULL CHECK (value IN (-1,1)),
  PRIMARY KEY (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.votes TO authenticated;
GRANT ALL ON public.votes TO service_role;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes readable by signed in" ON public.votes FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage own votes" ON public.votes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.recalc_post_score() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  pid := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.posts SET score = COALESCE((SELECT SUM(value) FROM public.votes WHERE post_id = pid), 0) WHERE id = pid;
  RETURN NULL;
END; $$;
CREATE TRIGGER votes_score AFTER INSERT OR UPDATE OR DELETE ON public.votes FOR EACH ROW EXECUTE FUNCTION public.recalc_post_score();

-- ============ LISTS ============
CREATE TABLE public.lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lists TO authenticated;
GRANT ALL ON public.lists TO service_role;
ALTER TABLE public.lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read public or own lists" ON public.lists FOR SELECT TO authenticated USING (is_public OR auth.uid() = owner_id);
CREATE POLICY "manage own lists" ON public.lists FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE public.list_items (
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  title_id uuid NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (list_id, title_id)
);
GRANT SELECT, INSERT, DELETE ON public.list_items TO authenticated;
GRANT ALL ON public.list_items TO service_role;
ALTER TABLE public.list_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read items of visible lists" ON public.list_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND (l.is_public OR l.owner_id = auth.uid()))
);
CREATE POLICY "manage items of own lists" ON public.list_items FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.lists l WHERE l.id = list_id AND l.owner_id = auth.uid())
);

CREATE TABLE public.list_likes (
  list_id uuid NOT NULL REFERENCES public.lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (list_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.list_likes TO authenticated;
GRANT ALL ON public.list_likes TO service_role;
ALTER TABLE public.list_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "list likes readable by signed in" ON public.list_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage own list likes" ON public.list_likes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ WATCH PARTIES ============
CREATE TABLE public.watch_parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_id uuid NOT NULL REFERENCES public.titles(id) ON DELETE CASCADE,
  scheduled_at timestamptz NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_parties TO authenticated;
GRANT ALL ON public.watch_parties TO service_role;
ALTER TABLE public.watch_parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "watch parties readable by signed in" ON public.watch_parties FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage own watch parties" ON public.watch_parties FOR ALL TO authenticated USING (auth.uid() = host_id) WITH CHECK (auth.uid() = host_id);

CREATE TABLE public.watch_party_members (
  party_id uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (party_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.watch_party_members TO authenticated;
GRANT ALL ON public.watch_party_members TO service_role;
ALTER TABLE public.watch_party_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "party members readable by signed in" ON public.watch_party_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage own participation" ON public.watch_party_members FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.watch_party_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.watch_parties(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.watch_party_messages TO authenticated;
GRANT ALL ON public.watch_party_messages TO service_role;
ALTER TABLE public.watch_party_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read party messages as member" ON public.watch_party_messages FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.watch_party_members m WHERE m.party_id = watch_party_messages.party_id AND m.user_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.watch_parties p WHERE p.id = watch_party_messages.party_id AND p.host_id = auth.uid())
);
CREATE POLICY "send party messages as member" ON public.watch_party_messages FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid() AND (
    EXISTS (SELECT 1 FROM public.watch_party_members m WHERE m.party_id = watch_party_messages.party_id AND m.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.watch_parties p WHERE p.id = watch_party_messages.party_id AND p.host_id = auth.uid())
  )
);

-- ============ ACHIEVEMENTS ============
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, code)
);
GRANT SELECT, INSERT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "achievements readable by signed in" ON public.achievements FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert own achievements" ON public.achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.watch_party_messages;

-- ============ SEED ============
INSERT INTO public.genres (slug, name_pt, name_en, name_es, sort) VALUES
 ('acao','Ação','Action','Acción',1),
 ('aventura','Aventura','Adventure','Aventura',2),
 ('comedia','Comédia','Comedy','Comedia',3),
 ('drama','Drama','Drama','Drama',4),
 ('terror','Terror','Horror','Terror',5),
 ('suspense','Suspense','Thriller','Suspenso',6),
 ('ficcao','Ficção','Sci-Fi','Ciencia ficción',7),
 ('fantasia','Fantasia','Fantasy','Fantasía',8),
 ('romance','Romance','Romance','Romance',9),
 ('animacao','Animação','Animation','Animación',10),
 ('crime','Crime','Crime','Crimen',11),
 ('misterio','Mistério','Mystery','Misterio',12),
 ('musical','Musical','Musical','Musical',13);

INSERT INTO public.titles (title, kind, year, overview, poster_url, cast_list, genre_slugs) VALUES
('Inception','movie',2010,'Um ladrão que invade sonhos recebe a missão de plantar uma ideia na mente de um herdeiro.','https://upload.wikimedia.org/wikipedia/en/2/2e/Inception_%282010%29_theatrical_poster.jpg','Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page',ARRAY['acao','ficcao']::text[]),
('The Dark Knight','movie',2008,'Batman enfrenta o Coringa, um criminoso anárquico que quer mergulhar Gotham no caos.','https://upload.wikimedia.org/wikipedia/en/1/1c/The_Dark_Knight_%282008_film%29.jpg','Christian Bale, Heath Ledger, Aaron Eckhart',ARRAY['acao','crime']::text[]),
('Parasite','movie',2019,'Uma família pobre se infiltra na casa de uma família rica com consequências devastadoras.','https://upload.wikimedia.org/wikipedia/en/5/53/Parasite_%282019_film%29.png','Song Kang-ho, Lee Sun-kyun, Cho Yeo-jeong',ARRAY['drama','suspense']::text[]),
('Interstellar','movie',2014,'Exploradores atravessam um buraco de minhoca em busca de um novo lar para a humanidade.','https://upload.wikimedia.org/wikipedia/en/b/bc/Interstellar_film_poster.jpg','Matthew McConaughey, Anne Hathaway, Jessica Chastain',ARRAY['ficcao','drama']::text[]),
('Pulp Fiction','movie',1994,'Histórias entrelaçadas de gângsteres, boxeadores e assaltantes em Los Angeles.','https://upload.wikimedia.org/wikipedia/en/3/3b/Pulp_Fiction_%281994%29_poster.jpg','John Travolta, Uma Thurman, Samuel L. Jackson',ARRAY['crime','drama']::text[]),
('The Godfather','movie',1972,'O patriarca de uma dinastia do crime transfere o controle do império ao filho relutante.','https://upload.wikimedia.org/wikipedia/en/1/1c/Godfather_ver1.jpg','Marlon Brando, Al Pacino, James Caan',ARRAY['crime','drama']::text[]),
('Get Out','movie',2017,'Um jovem negro descobre um segredo perturbador ao visitar a família da namorada.','https://upload.wikimedia.org/wikipedia/en/a/a3/Get_Out_poster.png','Daniel Kaluuya, Allison Williams',ARRAY['terror','suspense']::text[]),
('Hereditary','movie',2018,'Após a morte da avó, uma família começa a desvendar segredos terríveis de sua linhagem.','https://upload.wikimedia.org/wikipedia/en/d/d9/Hereditary.png','Toni Collette, Alex Wolff, Milly Shapiro',ARRAY['terror']::text[]),
('The Shining','movie',1980,'Um escritor enlouquece enquanto cuida de um hotel isolado no inverno.','https://upload.wikimedia.org/wikipedia/en/1/1d/The_Shining_%281980%29_U.K._release_poster_-_The_tide_of_terror_that_swept_America_IS_HERE.jpg','Jack Nicholson, Shelley Duvall',ARRAY['terror','suspense']::text[]),
('Whiplash','movie',2014,'Um jovem baterista é levado ao limite por um professor implacável.','https://upload.wikimedia.org/wikipedia/en/0/01/Whiplash_poster.jpg','Miles Teller, J.K. Simmons',ARRAY['drama']::text[]),
('Spirited Away','movie',2001,'Uma menina entra num mundo de espíritos e precisa trabalhar para salvar os pais.','https://upload.wikimedia.org/wikipedia/en/d/db/Spirited_Away_Japanese_poster.png','Rumi Hiiragi, Miyu Irino',ARRAY['animacao','fantasia']::text[]),
('Your Name','movie',2016,'Dois adolescentes descobrem que trocam de corpo misteriosamente.','https://upload.wikimedia.org/wikipedia/en/0/0b/Your_Name_poster.png','Ryunosuke Kamiki, Mone Kamishiraishi',ARRAY['animacao','romance']::text[]),
('La La Land','movie',2016,'Uma atriz e um pianista de jazz se apaixonam enquanto perseguem seus sonhos.','https://upload.wikimedia.org/wikipedia/en/a/ab/La_La_Land_%28film%29.png','Ryan Gosling, Emma Stone',ARRAY['romance','musical']::text[]),
('Everything Everywhere All at Once','movie',2022,'Uma dona de lavanderia descobre que precisa salvar o multiverso.','https://upload.wikimedia.org/wikipedia/en/1/1e/Everything_Everywhere_All_at_Once.jpg','Michelle Yeoh, Ke Huy Quan, Stephanie Hsu',ARRAY['ficcao','comedia']::text[]),
('Mad Max: Fury Road','movie',2015,'Numa terra devastada, dois rebeldes fogem de um tirano em uma perseguição brutal.','https://upload.wikimedia.org/wikipedia/en/6/6e/Mad_Max_Fury_Road.jpg','Tom Hardy, Charlize Theron',ARRAY['acao','ficcao']::text[]),
('Dune','movie',2021,'O herdeiro de uma casa nobre luta pelo controle do planeta deserto Arrakis.','https://upload.wikimedia.org/wikipedia/en/8/8e/Dune_%282021_film%29.jpg','Timothée Chalamet, Rebecca Ferguson, Zendaya',ARRAY['ficcao','aventura']::text[]),
('The Grand Budapest Hotel','movie',2014,'Um concierge lendário e seu protegido se envolvem no roubo de uma pintura.','https://upload.wikimedia.org/wikipedia/en/1/1c/The_Grand_Budapest_Hotel.png','Ralph Fiennes, Tony Revolori',ARRAY['comedia','drama']::text[]),
('Knives Out','movie',2019,'Um detetive investiga a morte suspeita de um escritor rico.','https://upload.wikimedia.org/wikipedia/en/1/1f/Knives_Out_poster.jpeg','Daniel Craig, Ana de Armas, Chris Evans',ARRAY['misterio','comedia']::text[]),
('Se7en','movie',1995,'Dois detetives caçam um serial killer inspirado nos sete pecados capitais.','https://upload.wikimedia.org/wikipedia/en/6/68/Seven_%28movie%29_poster.jpg','Brad Pitt, Morgan Freeman, Kevin Spacey',ARRAY['crime','suspense']::text[]),
('Cidade de Deus','movie',2002,'A ascensão do crime organizado numa favela do Rio de Janeiro.','https://upload.wikimedia.org/wikipedia/en/1/10/CidadedeDeus.jpg','Alexandre Rodrigues, Leandro Firmino',ARRAY['crime','drama']::text[]),
('Coco','movie',2017,'Um menino viaja à Terra dos Mortos para descobrir o segredo de sua família.','https://upload.wikimedia.org/wikipedia/en/9/98/Coco_%282017_film%29_poster.jpg','Anthony Gonzalez, Gael García Bernal',ARRAY['animacao','fantasia']::text[]),
('Barbie','movie',2023,'Barbie sai da Barbieland e descobre o mundo real.','https://upload.wikimedia.org/wikipedia/en/0/0b/Barbie_2023_poster.jpg','Margot Robbie, Ryan Gosling',ARRAY['comedia','fantasia']::text[]),
('Oppenheimer','movie',2023,'A história do físico que liderou a criação da bomba atômica.','https://upload.wikimedia.org/wikipedia/en/4/4a/Oppenheimer_%28film%29.jpg','Cillian Murphy, Emily Blunt, Robert Downey Jr.',ARRAY['drama']::text[]),
('Superbad','movie',2007,'Dois amigos tentam comprar bebida para uma festa antes da formatura.','https://upload.wikimedia.org/wikipedia/en/8/8b/Superbad_Poster.png','Jonah Hill, Michael Cera',ARRAY['comedia']::text[]),
('Breaking Bad','series',2008,'Um professor de química com câncer passa a produzir metanfetamina.','https://upload.wikimedia.org/wikipedia/commons/thumb/8/8e/Breaking_Bad_official_logo.svg/1280px-Breaking_Bad_official_logo.svg.png','Bryan Cranston, Aaron Paul',ARRAY['crime','drama']::text[]),
('Stranger Things','series',2016,'Crianças enfrentam forças sobrenaturais numa cidade pequena dos anos 80.','https://upload.wikimedia.org/wikipedia/commons/3/38/Stranger_Things_logo.png','Millie Bobby Brown, Finn Wolfhard',ARRAY['ficcao','terror']::text[]),
('Chernobyl','series',2019,'A reconstituição do desastre nuclear de 1986 e seu encobrimento.','https://upload.wikimedia.org/wikipedia/en/a/a7/Chernobyl_2019_Miniseries.jpg','Jared Harris, Stellan Skarsgård',ARRAY['drama']::text[]),
('The Bear','series',2022,'Um chef premiado assume a lanchonete caótica da família.','https://upload.wikimedia.org/wikipedia/commons/d/d7/The_Bear_Title_Card.jpg','Jeremy Allen White, Ayo Edebiri',ARRAY['drama','comedia']::text[]),
('Fleabag','series',2016,'Uma mulher caótica navega luto, sexo e família em Londres.','https://upload.wikimedia.org/wikipedia/commons/0/08/Fleabag_titlecard.png','Phoebe Waller-Bridge, Olivia Colman',ARRAY['comedia','drama']::text[]),
('Game of Thrones','series',2011,'Famílias nobres disputam o Trono de Ferro em Westeros.','https://upload.wikimedia.org/wikipedia/en/d/d8/Game_of_Thrones_title_card.jpg','Emilia Clarke, Kit Harington, Peter Dinklage',ARRAY['fantasia','drama']::text[]),
('Squid Game','series',2021,'Endividados competem em jogos mortais por um prêmio milionário.','https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Squid_Game_2021_vector_logo_english.svg/3840px-Squid_Game_2021_vector_logo_english.svg.png','Lee Jung-jae, Park Hae-soo',ARRAY['suspense','acao']::text[]),
('True Detective','series',2014,'Detetives investigam crimes que atravessam décadas.','https://upload.wikimedia.org/wikipedia/en/5/5a/True_Detective_2014_Intertitle.jpg','Matthew McConaughey, Woody Harrelson',ARRAY['crime','misterio']::text[]);