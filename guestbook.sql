-- =====================================================================
--  GUESTBOOK  -  run this whole file once in Supabase > SQL Editor
--  Discord login only. Every message waits for your approval.
--  The word filter lives HERE (server side), so it can't be bypassed.
-- =====================================================================

create extension if not exists unaccent with schema extensions;

-- ---------- tables ----------------------------------------------------
create table if not exists public.guestbook (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  discord_id  text,
  name        text not null,
  avatar      text,
  message     text not null,
  pinned      boolean not null default false,
  approved    boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists guestbook_feed_idx on public.guestbook (approved, pinned desc, created_at desc);

create table if not exists public.guestbook_bans (
  discord_id text primary key,
  reason     text,
  created_at timestamptz not null default now()
);

create table if not exists public.guestbook_blocked_words (
  id   bigint generated always as identity primary key,
  word text not null,
  tier text not null default 'word' check (tier in ('word', 'sub'))
  -- 'word' = must appear as a whole word (safe default, avoids false positives)
  -- 'sub'  = blocked even inside other words (only for unambiguous terms)
);

-- ---------- text normalizer -------------------------------------------
-- Same cleaning is applied to the message AND to each blocked word:
-- lowercase, no accents, Arabic marks/letter variants unified, look-alike
-- letters fixed, symbols/numbers un-leeted, repeated letters collapsed.
-- mode 'latin'  : 3->e, 1->i, 0->o, 7->t ... (English, French, Spanish, Italian)
-- mode 'arabizi': keeps 2 3 5 6 7 8 9 (Darija written with numbers)
create or replace function public.gb_norm(txt text, mode text)
returns text
language plpgsql
stable
set search_path = public, extensions
as $$
declare t text;
begin
  t := lower(extensions.unaccent(coalesce(txt, '')));
  t := regexp_replace(t, E'[\\u064B-\\u065F\\u0670\\u0640\\u200B-\\u200F\\u2060\\uFEFF]', '', 'g');
  t := translate(t, 'أإآٱىةؤئ', 'اااايهوي');
  t := translate(t, 'аеорсху', 'aeopcxy');          -- Cyrillic look-alikes
  if mode = 'latin' then
    t := translate(t, '@4310!$57+8', 'aaeioissttb');
  else
    t := translate(t, '@!$y', 'aisi');
  end if;
  t := regexp_replace(t, '[^a-z0-9\u0600-\u06FF]+', ' ', 'g');
  t := regexp_replace(t, '(.)\1+', '\1', 'g');       -- fuuuck -> fuck
  return btrim(regexp_replace(t, ' +', ' ', 'g'));
end $$;

create or replace function public.gb_has_blocked(msg text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare m text; nm text;
begin
  foreach m in array array['latin', 'arabizi'] loop
    nm := gb_norm(msg, m);
    if nm = '' then continue; end if;
    if exists (
      select 1
      from guestbook_blocked_words w
      where gb_norm(w.word, m) <> ''
        and (
          (w.tier = 'word' and (' ' || nm || ' ') like ('% ' || gb_norm(w.word, m) || ' %'))
          or
          (w.tier = 'sub' and replace(nm, ' ', '') like ('%' || replace(gb_norm(w.word, m), ' ', '') || '%'))
        )
    ) then
      return true;
    end if;
  end loop;
  return false;
end $$;

-- ---------- insert guard ----------------------------------------------
-- Runs on every new message: fills name/avatar from the Discord login (so
-- nobody can fake them), forces "waiting for approval", and enforces length,
-- links, bans, rate limit and the word filter. Error codes start with "gb:".
create or replace function public.guestbook_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare meta jsonb;
begin
  if auth.uid() is null then raise exception 'gb:auth'; end if;

  select raw_user_meta_data into meta from auth.users where id = auth.uid();

  new.user_id    := auth.uid();
  new.discord_id := meta->>'provider_id';
  new.name       := left(coalesce(
                      nullif(meta #>> '{custom_claims,global_name}', ''),
                      nullif(meta->>'full_name', ''),
                      nullif(meta->>'name', ''),
                      'Visitor'), 40);
  new.avatar     := meta->>'avatar_url';
  new.approved   := false;
  new.pinned     := false;
  new.created_at := now();
  new.message    := btrim(regexp_replace(coalesce(new.message, ''), '\s+', ' ', 'g'));

  if char_length(new.message) < 2   then raise exception 'gb:short'; end if;
  if char_length(new.message) > 200 then raise exception 'gb:long';  end if;

  if exists (select 1 from guestbook_bans b where b.discord_id = new.discord_id) then
    raise exception 'gb:banned';
  end if;

  if (select count(*) from guestbook g
      where g.user_id = new.user_id and g.created_at > now() - interval '1 hour') >= 3 then
    raise exception 'gb:rate';
  end if;

  if lower(new.message) ~ '(https?:|www\.|discord\.gg|\w\.(com|net|org|io|gg|ma|fr|es|it|me|co|xyz|ly|tv|app|dev|info|ru|cn)\y)' then
    raise exception 'gb:links';
  end if;

  if gb_has_blocked(new.name) then raise exception 'gb:name'; end if;
  if gb_has_blocked(new.message) then raise exception 'gb:blocked'; end if;

  return new;
end $$;

drop trigger if exists guestbook_before_insert on public.guestbook;
create trigger guestbook_before_insert
  before insert on public.guestbook
  for each row execute function public.guestbook_before_insert();

-- ---------- security (RLS) --------------------------------------------
alter table public.guestbook               enable row level security;
alter table public.guestbook_bans          enable row level security;
alter table public.guestbook_blocked_words enable row level security;
-- (no policies on bans / blocked_words = nobody can read them from the site)

drop policy if exists "gb read approved" on public.guestbook;
drop policy if exists "gb read own"      on public.guestbook;
drop policy if exists "gb insert own"    on public.guestbook;
drop policy if exists "gb delete own"    on public.guestbook;

create policy "gb read approved" on public.guestbook for select to anon, authenticated using (approved);
create policy "gb read own"      on public.guestbook for select to authenticated using (user_id = auth.uid());
create policy "gb insert own"    on public.guestbook for insert to authenticated with check (user_id = auth.uid());
create policy "gb delete own"    on public.guestbook for delete to authenticated using (user_id = auth.uid());

revoke all on public.guestbook from anon, authenticated;
grant select (id, user_id, name, avatar, message, pinned, approved, created_at) on public.guestbook to anon, authenticated;
grant insert (message) on public.guestbook to authenticated;
grant delete on public.guestbook to authenticated;

-- ---------- starter blocklist (English, French, Arabic/Darija, Spanish, Italian)
-- Add more any time:  insert into guestbook_blocked_words (word, tier) values ('example', 'word');
-- Or use Table Editor > guestbook_blocked_words > Insert row.
insert into public.guestbook_blocked_words (word, tier) values
-- English: blocked even inside other words
('fuck','sub'),('fuk','word'),('fck','sub'),('fvck','sub'),('phuck','sub'),
('nigger','sub'),('faggot','sub'),
-- English: whole words
('shit','word'),('shits','word'),('shitty','word'),('bullshit','word'),('bitch','word'),('bitches','word'),('bitchy','word'),
('cunt','word'),('cunts','word'),('whore','word'),('whores','word'),('slut','word'),('sluts','word'),
('bastard','word'),('bastards','word'),('asshole','word'),('assholes','word'),('dumbass','word'),('jackass','word'),
('dick','word'),('dicks','word'),('dickhead','word'),('cock','word'),('cocks','word'),('pussy','word'),('pussies','word'),
('wanker','word'),('twat','word'),('retard','word'),('retarded','word'),('fag','word'),('fags','word'),
('nigga','word'),('niggas','word'),('tranny','word'),('motherfucker','word'),
-- French
('merde','word'),('putain','word'),('pute','word'),('putes','word'),('salope','word'),('salopes','word'),('salopard','word'),
('connard','word'),('connards','word'),('connasse','word'),('enculer','word'),('encule','word'),('encules','word'),
('nique','word'),('niquer','word'),('ntm','word'),('fdp','word'),('batard','word'),('bordel','word'),
('couille','word'),('couilles','word'),('branleur','word'),('salaud','word'),('trouduc','word'),('trou du cul','word'),
('tapette','word'),('gouine','word'),('negre','word'),('bougnoule','word'),('youpin','word'),
('nique ta mere','word'),('nique sa mere','word'),('ta gueule','word'),('ferme ta gueule','word'),
('fils de pute','word'),('va te faire foutre','word'),('va te faire enculer','word'),('sale pute','word'),
-- Spanish
('puta','word'),('putas','word'),('puto','word'),('putos','word'),('mierda','word'),('joder','word'),('jodete','word'),
('coño','word'),('cabron','word'),('cabrones','word'),('pendejo','word'),('pendeja','word'),('gilipollas','word'),
('hijo de puta','word'),('hijoputa','word'),('hdp','word'),('verga','word'),('culero','word'),('culera','word'),
('chingar','word'),('chingada','word'),('chinga tu madre','word'),('marica','word'),('maricon','word'),('zorra','word'),
('cojones','word'),('follar','word'),('puta madre','word'),('hijo de la gran puta','word'),('mamon','word'),('joto','word'),('sudaca','word'),
-- Italian
('cazzo','word'),('cazzi','word'),('minchia','word'),('vaffanculo','word'),('fanculo','word'),('stronzo','word'),('stronza','word'),
('stronzi','word'),('puttana','word'),('puttane','word'),('troia','word'),('troie','word'),('merda','word'),('merdoso','word'),
('figa','word'),('fica','word'),('coglione','word'),('coglioni','word'),('rompicoglioni','word'),('bastardo','word'),
('culo','word'),('porco dio','word'),('porcodio','word'),('dio cane','word'),('dio porco','word'),('madonna puttana','word'),
('mignotta','word'),('zoccola','word'),('pompino','word'),('frocio','word'),('ricchione','word'),('sborra','word'),
('testa di cazzo','word'),('figlio di puttana','word'),
-- Darija written in Latin letters / numbers (variants are merged automatically: zebi = zeby = zebbi)
('zebi','word'),('zbi','word'),('zok','word'),('zok mok','word'),('zokmok','word'),
('nikmok','word'),('nik mok','word'),('nik omk','word'),('nikomk','word'),('nik oumk','word'),('nik ommk','word'),('nik rasek','word'),('nik rask','word'),
('nayek','word'),('nayk','word'),('mnayek','word'),('mniok','word'),
('9a7ba','word'),('9ahba','word'),('qa7ba','word'),('qahba','word'),('kahba','word'),('k7ba','word'),('l9a7ba','word'),
('wld l9a7ba','word'),('wld 9a7ba','word'),('weld l9a7ba','word'),('wld lqahba','word'),('bnt l9a7ba','word'),
('9lawi','word'),('qlawi','word'),('zamel','word'),('zaml','word'),('khawal','word'),
('tabon mok','word'),('tbon mok','word'),('t7wa','word'),('sir t7wa','word'),
-- Arabic script (Darija and Arabic)
('قحبة','word'),('ولد القحبة','word'),('بنت القحبة','word'),('لقحبة','word'),
('زب','word'),('زبي','word'),('نيك','word'),('نيك امك','word'),('نيكمك','word'),('منيوك','word'),('منيوكة','word'),
('كس','word'),('كسك','word'),('كس امك','word'),('كسمك','word'),
('عاهرة','word'),('شرموطة','word'),('شرموط','word'),('متناك','word'),('متناكة','word'),
('زامل','word'),('قلاوي','word'),('خرا','word'),('طبون','word'),('ولد الحرام','word');

-- =====================================================================
--  HOW YOU MODERATE (Supabase > Table Editor > guestbook)
--   approve a message : tick  approved
--   pin a message     : tick  pinned   (shows first, with a glow)
--   remove a message  : delete the row
--   ban someone       : insert into guestbook_bans (discord_id, reason)
--                       values ('<their discord_id from the guestbook row>', 'spam');
-- =====================================================================
