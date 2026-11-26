-- Nutzungszähler für die öffentlichen Functions ohne Demo-Code (Bild-KI, Chat, Anfrage anlegen).
--
-- Kunden brauchen in der Demo keinen Code mehr. Damit niemand hohe Kosten verursachen kann,
-- zählen die Functions jede Nutzung und lehnen ab, wenn das Tageslimit erreicht ist
-- (Grenzen in supabase/functions/_shared/limit.ts).
--
-- Gespeichert wird nur ein SHA-256-Hash der IP-Adresse (mit Server-Geheimnis gesalzen), kein Klartext.
-- Einträge älter als 2 Tage löschen die Functions selbst.
-- RLS ist an und es gibt bewusst KEINE Policies: Nur die Functions (service role) lesen und schreiben.

create table public.nutzung (
  id bigint generated always as identity primary key,
  zeit timestamptz not null default now(),
  art text not null check (art in ('bild', 'chat', 'anfrage')),
  geraet text not null check (char_length(geraet) = 64)
);

create index nutzung_art_zeit on public.nutzung (art, zeit desc);
create index nutzung_art_geraet_zeit on public.nutzung (art, geraet, zeit desc);

alter table public.nutzung enable row level security;

comment on table public.nutzung is 'Tageslimit für Bild-KI, Chat und Anfragen (Edge Functions, IP nur als Hash)';
