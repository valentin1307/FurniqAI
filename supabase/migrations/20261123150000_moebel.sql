-- Möbelart je Anfrage (Kundenseite: Schritt „Wählen Sie Ihr neues Herzstück“).
--
-- Bisher gab es nur den Couchtisch: Bestehende Zeilen bekommen 'couchtisch'. Ältere Kundenseiten,
-- die kein Möbel mitschicken, landen über den Standardwert ebenfalls beim Couchtisch.
--
-- Bewusst freier Text statt fester Liste oder Enum: Welche Möbel freigeschaltet sind, prüfen die
-- Edge Functions (supabase/functions/_shared/moebel.ts). Ein neues Möbel braucht so keine Migration.
-- Die Formatregel entspricht den IDs aus js/portfolio.js (auch eigene wie 'eigen-hocker').

alter table public.anfragen
  add column moebel text not null default 'couchtisch'
    constraint anfragen_moebel_format check (moebel ~ '^[a-z0-9][a-z0-9-]{0,60}$'),
  add column moebel_name text
    constraint anfragen_moebel_name_laenge check (moebel_name is null or char_length(moebel_name) <= 80);

update public.anfragen set moebel_name = 'Couchtisch' where moebel = 'couchtisch' and moebel_name is null;

comment on column public.anfragen.moebel is 'ID des Möbels aus dem Portfolio (js/portfolio.js), z. B. couchtisch';
comment on column public.anfragen.moebel_name is 'Anzeigename des Möbels zum Zeitpunkt der Anfrage';
comment on column public.anfragen.konfiguration is 'Konfiguration je Möbelart; geprüft in functions/anfragen/daten.ts (KONFIG_PRUEFUNG)';
comment on column public.anfragen.tisch_position is 'Markierter Standort des Möbelstücks im Foto { x, y } (Spaltenname aus der Couchtisch-Zeit)';

-- Für Posteingang und Auswertungen je Möbel
create index anfragen_moebel_erstellt_idx on public.anfragen (moebel, erstellt desc);
