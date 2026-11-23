-- Anfragen von Tischlereien für die Pilotphase (Formular auf tischlereien.html).
--
-- Getrennt von public.anfragen: Dort landen Anfragen von Endkunden an eine Tischlerei,
-- hier Anfragen von Tischlereien an FurniqAI.
--
-- Das Formular ist öffentlich (kein Demo-Code). Geschrieben wird nur über die Edge Function `pilot`
-- (service role) mit Prüfung, Spamschutz und Mengenbegrenzung. Lesen im Supabase-Dashboard.
-- RLS ist an und es gibt bewusst KEINE Policies: Mit dem anon key kann niemand lesen oder schreiben.

create table public.pilot_anfragen (
  id uuid primary key default gen_random_uuid(),
  erstellt timestamptz not null default now(),

  name text not null check (char_length(name) between 1 and 200),
  betrieb text not null check (char_length(betrieb) between 1 and 200),
  ort text not null check (char_length(ort) between 1 and 200),
  email text not null check (char_length(email) between 3 and 200),
  telefon text check (telefon is null or char_length(telefon) <= 60),
  nachricht text check (nachricht is null or char_length(nachricht) <= 3000),

  -- Einwilligung zur Speicherung (Pflicht) und Zeitpunkt, zu dem sie gegeben wurde
  einwilligung boolean not null check (einwilligung),
  einwilligung_text text not null,

  -- Bearbeitung durch das FurniqAI-Team
  status text not null default 'neu' check (status in ('neu', 'kontaktiert', 'pilot', 'abgesagt')),
  notiz text
);

comment on table public.pilot_anfragen is 'Pilot-Anfragen von Tischlereien (Formular tischlereien.html, Edge Function pilot)';
comment on column public.pilot_anfragen.einwilligung_text is 'Wortlaut der Einwilligung zum Zeitpunkt der Anfrage';

create index pilot_anfragen_erstellt_idx on public.pilot_anfragen (erstellt desc);
create index pilot_anfragen_email_idx on public.pilot_anfragen (email, erstellt desc); -- E-Mail wird klein gespeichert

alter table public.pilot_anfragen enable row level security;
-- Keine Policies (siehe oben).
revoke all on public.pilot_anfragen from anon, authenticated;
