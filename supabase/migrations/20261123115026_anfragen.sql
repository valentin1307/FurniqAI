-- Anfragen von der Kundenseite, gelesen und bearbeitet auf der Tischlerseite.
--
-- Zugriff nur über die Edge Function `anfragen` (service role, geschützt durch den Demo-Code).
-- RLS ist an und es gibt bewusst KEINE Policies: Mit dem öffentlichen anon key aus js/config.js
-- kann niemand Anfragen lesen oder ändern.

create table public.anfragen (
  id uuid primary key default gen_random_uuid(),
  erstellt timestamptz not null default now(),

  -- Bearbeitung durch die Tischlerei
  status text not null default 'neu' check (status in ('neu', 'angenommen', 'abgelehnt')),
  ablehnungsgrund text,
  bearbeitet timestamptz,

  -- Kundendaten: { name, email, telefon, ort, nachricht }
  kunde jsonb not null,

  -- Tisch: { form, laenge, breite, hoehe, materialId, gestellId, oberflaecheId, optionIds,
  --          sonderwuensche, namen: { form, material, gestell, oberflaeche } }
  konfiguration jsonb not null,
  -- Ergebnis von berechnePreis(): { positionen, summe, rahmen: { von, bis }, sonderwuensche, flaeche }
  preis jsonb not null,

  -- Raum und Markierung
  raum jsonb,                       -- { laenge, breite } in cm, optional
  freier_platz jsonb not null,      -- { laenge, breite } in cm
  wunschmasse jsonb,                -- { laenge, breite, hoehe }, optional
  referenz jsonb,                   -- { p1:{x,y}, p2:{x,y}, laengeCm }
  tisch_position jsonb,             -- { x, y }
  passt_in_freien_platz boolean,

  -- Bilder im privaten Storage-Bucket anfrage-bilder
  foto_pfad text,
  ki_bild_pfad text,
  ki_info jsonb                     -- { modell, dauerMs, eingabe, ergebnis, passt }
);

create index anfragen_erstellt_idx on public.anfragen (erstellt desc);

alter table public.anfragen enable row level security;
-- Keine Policies (siehe oben). anon/authenticated haben damit keinen Zugriff.
revoke all on public.anfragen from anon, authenticated;

-- Privater Bucket für Raumfoto und KI-Bild je Anfrage (Pfad: <id>/foto.jpg, <id>/ki-bild.jpg).
-- Angezeigt wird über kurzlebige signierte URLs aus der Edge Function.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('anfrage-bilder', 'anfrage-bilder', false, 10485760, array['image/jpeg', 'image/png'])
on conflict (id) do nothing;
