// Bewegung für Kunden- und Tischlerseite, angelehnt an die Landingpage (js/landing.js), aber zurückhaltender:
// - html.bewegt schaltet die Auftritte in css/style.css ein (nicht bei „Bewegung reduzieren“)
// - Kicker tippen sich ein, sobald ein Schritt oder Bereich erscheint
// - Karten gleiten beim Scrollen herein (--ein 0 … 1); angekommen tragen sie keine Verschiebung mehr,
//   damit Markierungen im Foto und feste Elemente unberührt bleiben
// - leuchtende Linie unter dem Kopf: Schrittfortschritt (Kundenseite) bzw. Lesefortschritt (Tischlerseite)
// - der Rasterboden im Hintergrund läuft beim Scrollen mit

const wurzel = document.documentElement;
const ruhig = matchMedia('(prefers-reduced-motion: reduce)');
const begrenze = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const weich = (t) => 1 - (1 - t) ** 3;
const leiste = document.querySelector('.schritte');

/** Bereiche, deren Erscheinen einen Auftritt auslöst: Schritte der Kundenseite, Bereiche der Tischlerseite. */
const bereiche = [...document.querySelectorAll('.schritt, .t-bereich, .t-zugang')];
const sichtbar = (el) => !el.closest('[hidden]') && el.getClientRects().length > 0;

// ---------- Kicker tippen ----------
function tippen(bereich) {
  if (ruhig.matches) return;
  bereich.querySelectorAll('.schritt-kopf .kicker').forEach((k) => {
    const text = k.textContent.trim();
    if (!text) return;
    k.style.setProperty('--n', String(text.length + 4));
    k.classList.remove('tippt');
    void k.offsetWidth; // Animation neu starten
    k.classList.add('tippt');
  });
}

// ---------- Fortschritt im Kopf ----------
function fortschrittSetzen() {
  if (leiste) {
    const knoepfe = [...leiste.querySelectorAll('li:not([hidden]) button')];
    const pos = knoepfe.findIndex((b) => b.getAttribute('aria-current') === 'step');
    wurzel.style.setProperty('--fortschritt', String(knoepfe.length ? (pos + 1) / knoepfe.length : 0));
  } else {
    const gesamt = wurzel.scrollHeight - innerHeight;
    wurzel.style.setProperty('--fortschritt', String(gesamt > 0 ? Math.round((scrollY / gesamt) * 1000) / 1000 : 0));
  }
}

// ---------- Karten gleiten herein ----------
let geplant = false;
let karten = [];

function kartenSammeln() {
  karten = [...document.querySelectorAll('main .karte, main .moebel-wahl')].filter(
    (k) => !k.parentElement.closest('.karte'),
  );
  karten.forEach((k, i) => k.style.setProperty('--seite', i % 2 ? '1' : '-1'));
}

function takt() {
  geplant = false;
  if (!leiste) fortschrittSetzen();
  document.body.style.setProperty('--rollen', String(Math.round(scrollY * 0.35) % 72));
  if (ruhig.matches) return;
  const vh = innerHeight;
  for (const k of karten) {
    if (!sichtbar(k)) continue;
    const r = k.getBoundingClientRect();
    // eine Karte ist angekommen, wenn ihre Oberkante 70 % der Bildschirmhöhe erreicht
    const ein = r.top > vh * 1.3 ? 0 : weich(begrenze((vh - r.top) / (vh * 0.3)));
    if (ein >= 0.999) {
      if (k.classList.contains('gleitet')) {
        k.classList.remove('gleitet');
        k.style.removeProperty('--ein');
      }
      continue;
    }
    k.classList.add('gleitet');
    k.style.setProperty('--ein', String(Math.round(ein * 1000) / 1000));
  }
}

function planen() {
  if (geplant) return;
  geplant = true;
  requestAnimationFrame(takt);
}

// ---------- Start ----------
function auftritt(bereich) {
  tippen(bereich);
  kartenSammeln();
  planen();
}

function start() {
  wurzel.classList.toggle('bewegt', !ruhig.matches);
  kartenSammeln();
  fortschrittSetzen();
  bereiche.filter((b) => !b.hidden).forEach(tippen);
  planen();

  // Ein Bereich wird sichtbar (hidden entfernt): Auftritt
  const beobachter = new MutationObserver((aenderungen) => {
    for (const a of aenderungen) {
      if (a.target.hidden) continue;
      if (bereiche.includes(a.target)) auftritt(a.target);
      else kartenSammeln(); // z. B. aufgeklappte Karte innerhalb eines Schritts
    }
    planen();
  });
  document.querySelectorAll('main').forEach((m) =>
    beobachter.observe(m, { subtree: true, attributes: true, attributeFilter: ['hidden'] }),
  );
  if (leiste) {
    new MutationObserver(fortschrittSetzen).observe(leiste, { subtree: true, attributes: true, attributeFilter: ['aria-current'] });
  }

  addEventListener('scroll', planen, { passive: true });
  addEventListener('resize', planen);
  ruhig.addEventListener('change', () => {
    wurzel.classList.toggle('bewegt', !ruhig.matches);
    karten.forEach((k) => {
      k.classList.remove('gleitet');
      k.style.removeProperty('--ein');
    });
    planen();
  });
}

start();
