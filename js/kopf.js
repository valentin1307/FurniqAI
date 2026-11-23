// Fester Kopf für Kunden- und Tischlerseite.
// - misst die sichtbare Höhe von Kopf + Schrittleiste als CSS-Variable --kopf-hoehe (ResizeObserver)
// - verdichtet den Kopf nach dem ersten Stück Scrollen (IntersectionObserver auf .kopf-sentinel)
// - am Handy (< 700 px): Kopfzeile fährt beim Runterscrollen weg, die Schrittleiste bleibt
// - rollt den aktiven Schritt in der Schrittleiste ins Bild
// - übernimmt eine optionale Akzentfarbe des Betriebs (BETRIEB.akzent)
import { BETRIEB } from './betrieb.js';

const wurzel = document.documentElement;
const bereich = document.querySelector('.kopfbereich');
const kopf = bereich?.querySelector('.kopf');
const leiste = bereich?.querySelector('.schritte'); // nur auf der Kundenseite
const sentinel = document.querySelector('.kopf-sentinel');
const preisleiste = document.querySelector('.preisleiste');

const schmal = window.matchMedia('(max-width: 700px)');
const niedrig = window.matchMedia('(max-height: 520px)'); // Handy quer: nicht fest
const wenigBewegung = window.matchMedia('(prefers-reduced-motion: reduce)');

const lage = {
  kopfWeg: false,
  hoeheVoll: 0, // Höhe des unverdichteten Kopfbereichs, für den Ausgleich
};

/** Akzentfarbe des Betriebs, wenn gesetzt und gültig. */
function akzentSetzen() {
  const farbe = BETRIEB.akzent;
  if (typeof farbe === 'string' && window.CSS?.supports?.('color', farbe)) {
    wurzel.style.setProperty('--akzent', farbe);
  }
}

/** --kopf-hoehe: was oben tatsächlich verdeckt wird. --kopf-ausgleich hält die Seitenhöhe beim Verdichten konstant. */
function hoeheSetzen() {
  if (!bereich) return;
  const fest = !niedrig.matches;
  const gesamt = bereich.offsetHeight;
  const zeile = kopf ? kopf.offsetHeight : 0;
  if (!bereich.classList.contains('verdichtet')) lage.hoeheVoll = gesamt;
  const ausgleich = Math.max(0, lage.hoeheVoll - gesamt);
  const sichtbar = fest ? gesamt - (lage.kopfWeg ? zeile : 0) : 0;
  wurzel.style.setProperty('--kopf-hoehe', `${Math.round(sichtbar)}px`);
  wurzel.style.setProperty('--kopfzeile-hoehe', `${Math.round(zeile)}px`);
  wurzel.style.setProperty('--kopf-ausgleich', `${Math.round(ausgleich)}px`);
  bereich.classList.toggle('nicht-fest', !fest);
}

function preisleisteMessen() {
  if (preisleiste) wurzel.style.setProperty('--preisleiste-hoehe', `${Math.round(preisleiste.offsetHeight)}px`);
}

function kopfWegSetzen(weg) {
  if (lage.kopfWeg === weg) return;
  lage.kopfWeg = weg;
  bereich.classList.toggle('kopf-weg', weg);
  hoeheSetzen();
}

// ---------- Verdichten (IntersectionObserver statt scroll-Listener) ----------

function verdichtenEinrichten() {
  if (!sentinel || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(([eintrag]) => {
    bereich.classList.toggle('verdichtet', !eintrag.isIntersecting);
    if (eintrag.isIntersecting) kopfWegSetzen(false);
  }).observe(sentinel);
}

// ---------- Handy: Kopfzeile beim Runterscrollen ausblenden ----------
// Ein passiver scroll-Listener, gedrosselt auf einen Durchlauf pro Bildschirmbild.

function wegfahrenEinrichten() {
  if (!leiste || !kopf) return; // Tischlerseite: Reiter sitzen im Kopf und bleiben sichtbar
  let letzteY = window.scrollY;
  let geplant = false;
  const pruefen = () => {
    geplant = false;
    const y = window.scrollY;
    if (!schmal.matches || niedrig.matches) {
      kopfWegSetzen(false);
      letzteY = y;
      return;
    }
    const d = y - letzteY;
    if (Math.abs(d) < 6) return;
    kopfWegSetzen(d > 0 && y > lage.hoeheVoll);
    letzteY = y;
  };
  window.addEventListener(
    'scroll',
    () => {
      if (geplant) return;
      geplant = true;
      requestAnimationFrame(pruefen);
    },
    { passive: true },
  );
  // Fokus per Tastatur in den Kopf holt ihn zurück
  bereich.addEventListener('focusin', () => kopfWegSetzen(false));
}

// ---------- Schrittleiste: aktiven Schritt ins Bild rollen ----------

function aktivenSchrittZeigen() {
  const liste = leiste?.querySelector('ol');
  const aktiv = liste?.querySelector('[aria-current="step"]');
  if (!liste || !aktiv || liste.scrollWidth <= liste.clientWidth) return;
  const ziel = aktiv.closest('li').offsetLeft - (liste.clientWidth - aktiv.closest('li').offsetWidth) / 2;
  liste.scrollTo({ left: Math.max(0, ziel), behavior: wenigBewegung.matches ? 'auto' : 'smooth' });
}

function schrittleisteEinrichten() {
  if (!leiste) return;
  new MutationObserver(aktivenSchrittZeigen).observe(leiste, {
    subtree: true,
    attributes: true,
    attributeFilter: ['aria-current'],
  });
  schmal.addEventListener('change', aktivenSchrittZeigen);
}

// ---------- Start ----------

function start() {
  akzentSetzen();
  if (!bereich) return;
  hoeheSetzen();
  preisleisteMessen();
  if ('ResizeObserver' in window) {
    new ResizeObserver(hoeheSetzen).observe(bereich);
    if (preisleiste) new ResizeObserver(preisleisteMessen).observe(preisleiste);
  } else {
    window.addEventListener('resize', () => {
      hoeheSetzen();
      preisleisteMessen();
    });
  }
  niedrig.addEventListener('change', () => {
    kopfWegSetzen(false);
    hoeheSetzen();
  });
  verdichtenEinrichten();
  wegfahrenEinrichten();
  schrittleisteEinrichten();
  aktivenSchrittZeigen();
}

start();
