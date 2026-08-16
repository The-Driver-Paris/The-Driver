// ═══════════════════════════════════════════════════════════════════════
//
//   T A R I F S   —   L E   S E U L   F I C H I E R   À   M O D I F I E R
//
//   PRICING — THE ONLY FILE TO EDIT
//
// ═══════════════════════════════════════════════════════════════════════
//
// FR — Tous les prix du site sont ici. Modifiez un chiffre dans ce fichier,
//      enregistrez, et il change PARTOUT : calculateur de tarifs, grille
//      complète, cartes « Dès X € », formulaire de réservation, e-mails.
//      Ne modifiez aucun autre fichier pour changer un prix.
//
// EN — Every price on the site lives here. Change a number in this file,
//      save, and it updates EVERYWHERE: the rates calculator, the full
//      price grid, the "From €X" cards, the booking form and the emails.
//      No other file needs editing to change a price.
//
// ───────────────────────────────────────────────────────────────────────
//   RÈGLES / RULES
// ───────────────────────────────────────────────────────────────────────
//
//   1. Écrivez uniquement des NOMBRES, sans le symbole € et sans espace.
//      Numbers only — no € symbol, no spaces.
//         ✅  p1to3: 70          ❌  p1to3: "70 €"
//
//   2. Ne supprimez pas la virgule à la fin d'une ligne.
//      Don't remove the comma at the end of a line.
//
//   3. Ne renommez pas les clés (`p1to3`, `p4`, `p12`…) ni les villes.
//      Don't rename the keys (`p1to3`, `p4`, `p12`…) or the place names.
//
//   4. Après avoir enregistré : « Commit changes » sur GitHub. Le site se
//      met à jour tout seul en 1–2 minutes.
//      After saving: "Commit changes" on GitHub. The site redeploys itself
//      within 1–2 minutes.
//
// ═══════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────
//   1. MISE À DISPOSITION À L'HEURE / HOURLY HIRE
// ───────────────────────────────────────────────────────────────────────
//
// Prix d'une heure de mise à disposition, en euros.
// Affiché sur la page d'accueil, la page Tarifs et la carte « À l'heure ».
export const HOURLY_RATE = 50;

// ───────────────────────────────────────────────────────────────────────
//   2. REMISE ALLER-RETOUR / ROUND-TRIP DISCOUNT
// ───────────────────────────────────────────────────────────────────────
//
// Remise appliquée quand le client réserve un aller-retour, EN POURCENT.
// Écrivez 5 pour 5 %, 10 pour 10 %, 0 pour supprimer la remise.
//
// Calcul : prix aller-retour = prix aller × 2 − remise.
// Le chiffre affiché dans les textes du site (« −5 % », « Économisez 5 % »)
// suit automatiquement cette valeur, dans les 4 langues.
export const ROUND_TRIP_DISCOUNT_PERCENT = 5;

// Version décimale utilisée par le calculateur — ne pas modifier,
// elle se met à jour toute seule à partir de la ligne ci-dessus.
export const ROUND_TRIP_DISCOUNT = ROUND_TRIP_DISCOUNT_PERCENT / 100;

// ───────────────────────────────────────────────────────────────────────
//   3. GRILLE DES TRAJETS / ROUTE PRICE MATRIX
// ───────────────────────────────────────────────────────────────────────
//
// PRICES['Départ']['Arrivée'] = {
//   p1to3,                       // 1, 2 ou 3 passagers  (Tesla Model Y)
//   p4, p5, p6, p7, p8,          // 4 à 8 passagers      (Vito / Trafic)
//   p12, p16, p20, p24,          // grands groupes, plusieurs véhicules
// }
//
// Les nombres intermédiaires (9–11, 13–15, 17–19, 21–23) sont calculés
// automatiquement : le site combine les tarifs ci-dessus pour trouver la
// combinaison la moins chère. Vous n'avez rien à saisir pour ces cas.
//
// ATTENTION — les trajets ne sont PAS symétriques automatiquement.
// Si vous changez `Paris → CDG`, pensez à changer `CDG → Paris` aussi.
//
// Versailles est volontairement symétrique (mêmes prix dans les deux sens),
// et « Paris Train Station ↔ Versailles » utilise les prix de
// « Paris ↔ Versailles ».
export const PRICES = {
  Paris: {
    Paris:                 { p1to3: 60,  p4: 65,  p5: 70,  p6: 70,  p7: 80,  p8: 80,  p12: 145, p16: 160, p20: 225, p24: 240 }, // transfert dans Paris
    CDG:                   { p1to3: 65,  p4: 70,  p5: 75,  p6: 75,  p7: 85,  p8: 90,  p12: 160, p16: 180, p20: 250, p24: 270 },
    Disneyland:            { p1to3: 70,  p4: 75,  p5: 80,  p6: 85,  p7: 90,  p8: 100, p12: 170, p16: 200, p20: 270, p24: 300 },
    Orly:                  { p1to3: 65,  p4: 70,  p5: 75,  p6: 75,  p7: 85,  p8: 90,  p12: 160, p16: 180, p20: 250, p24: 270 },
    Beauvais:              { p1to3: 140, p4: 150, p5: 150, p6: 165, p7: 170, p8: 180, p12: 330, p16: 360, p20: 510, p24: 540 },
    'Paris Train Station': { p1to3: 60,  p4: 65,  p5: 70,  p6: 70,  p7: 80,  p8: 80,  p12: 145, p16: 160, p20: 225, p24: 240 },
    Versailles:            { p1to3: 75,  p4: 80,  p5: 80,  p6: 85,  p7: 85,  p8: 90,  p12: 170, p16: 180, p20: 260, p24: 270 },
  },
  CDG: {
    Paris:                 { p1to3: 65,  p4: 70,  p5: 80,  p6: 80,  p7: 85,  p8: 90,  p12: 160, p16: 180, p20: 250, p24: 270 },
    Disneyland:            { p1to3: 65,  p4: 70,  p5: 80,  p6: 80,  p7: 85,  p8: 90,  p12: 160, p16: 180, p20: 250, p24: 270 },
    Orly:                  { p1to3: 80,  p4: 80,  p5: 85,  p6: 90,  p7: 90,  p8: 100, p12: 180, p16: 200, p20: 280, p24: 300 },
    Beauvais:              { p1to3: 125, p4: 130, p5: 140, p6: 140, p7: 150, p8: 150, p12: 280, p16: 300, p20: 430, p24: 450 },
    'Paris Train Station': { p1to3: 65,  p4: 70,  p5: 80,  p6: 80,  p7: 85,  p8: 90,  p12: 160, p16: 180, p20: 250, p24: 270 },
    Versailles:            { p1to3: 85,  p4: 85,  p5: 90,  p6: 90,  p7: 95,  p8: 100, p12: 185, p16: 200, p20: 285, p24: 300 },
  },
  Orly: {
    Paris:                 { p1to3: 65,  p4: 70,  p5: 80,  p6: 80,  p7: 85,  p8: 90,  p12: 160, p16: 180, p20: 250, p24: 270 },
    CDG:                   { p1to3: 80,  p4: 80,  p5: 85,  p6: 90,  p7: 90,  p8: 100, p12: 180, p16: 200, p20: 280, p24: 300 },
    Disneyland:            { p1to3: 70,  p4: 80,  p5: 80,  p6: 85,  p7: 90,  p8: 95,  p12: 175, p16: 190, p20: 270, p24: 285 },
    Beauvais:              { p1to3: 160, p4: 160, p5: 170, p6: 170, p7: 180, p8: 190, p12: 350, p16: 380, p20: 540, p24: 570 },
    'Paris Train Station': { p1to3: 65,  p4: 70,  p5: 80,  p6: 80,  p7: 85,  p8: 90,  p12: 160, p16: 180, p20: 250, p24: 270 },
    Versailles:            { p1to3: 75,  p4: 80,  p5: 80,  p6: 85,  p7: 90,  p8: 90,  p12: 170, p16: 180, p20: 260, p24: 270 },
  },
  Beauvais: {
    Paris:                 { p1to3: 140, p4: 150, p5: 150, p6: 165, p7: 170, p8: 180, p12: 330, p16: 360, p20: 510, p24: 540 },
    Disneyland:            { p1to3: 140, p4: 150, p5: 160, p6: 165, p7: 170, p8: 180, p12: 330, p16: 360, p20: 510, p24: 540 },
    CDG:                   { p1to3: 125, p4: 130, p5: 140, p6: 140, p7: 150, p8: 150, p12: 280, p16: 300, p20: 430, p24: 450 },
    Orly:                  { p1to3: 160, p4: 160, p5: 170, p6: 170, p7: 180, p8: 190, p12: 350, p16: 380, p20: 540, p24: 570 },
    'Paris Train Station': { p1to3: 140, p4: 150, p5: 150, p6: 165, p7: 170, p8: 180, p12: 330, p16: 360, p20: 510, p24: 540 },
    Versailles:            { p1to3: 140, p4: 150, p5: 160, p6: 165, p7: 170, p8: 180, p12: 330, p16: 360, p20: 510, p24: 540 },
  },
  Disneyland: {
    Paris:                 { p1to3: 70,  p4: 75,  p5: 80,  p6: 85,  p7: 90,  p8: 100, p12: 170, p16: 200, p20: 270, p24: 300 },
    CDG:                   { p1to3: 65,  p4: 70,  p5: 80,  p6: 80,  p7: 85,  p8: 90,  p12: 160, p16: 180, p20: 250, p24: 270 },
    Orly:                  { p1to3: 70,  p4: 80,  p5: 80,  p6: 85,  p7: 90,  p8: 95,  p12: 175, p16: 190, p20: 270, p24: 285 },
    Beauvais:              { p1to3: 150, p4: 150, p5: 160, p6: 165, p7: 170, p8: 180, p12: 330, p16: 360, p20: 510, p24: 540 },
    'Paris Train Station': { p1to3: 70,  p4: 75,  p5: 80,  p6: 85,  p7: 90,  p8: 100, p12: 170, p16: 200, p20: 270, p24: 300 },
    Versailles:            { p1to3: 90,  p4: 90,  p5: 100, p6: 110, p7: 120, p8: 125, p12: 215, p16: 250, p20: 340, p24: 375 },
  },
  'Paris Train Station': {
    Paris:                 { p1to3: 60,  p4: 65,  p5: 70,  p6: 70,  p7: 80,  p8: 80,  p12: 145, p16: 160, p20: 225, p24: 240 },
    Disneyland:            { p1to3: 70,  p4: 75,  p5: 80,  p6: 85,  p7: 90,  p8: 100, p12: 170, p16: 200, p20: 270, p24: 300 },
    CDG:                   { p1to3: 65,  p4: 70,  p5: 80,  p6: 80,  p7: 85,  p8: 90,  p12: 160, p16: 180, p20: 250, p24: 270 },
    Orly:                  { p1to3: 65,  p4: 70,  p5: 80,  p6: 80,  p7: 85,  p8: 90,  p12: 160, p16: 180, p20: 250, p24: 270 },
    Beauvais:              { p1to3: 140, p4: 150, p5: 150, p6: 165, p7: 170, p8: 180, p12: 330, p16: 360, p20: 510, p24: 540 },
    Versailles:            { p1to3: 75,  p4: 80,  p5: 80,  p6: 85,  p7: 85,  p8: 90,  p12: 170, p16: 180, p20: 260, p24: 270 },
  },
  // DEPUIS Versailles — miroir symétrique des trajets VERS Versailles.
  Versailles: {
    Paris:                 { p1to3: 75,  p4: 80,  p5: 80,  p6: 85,  p7: 85,  p8: 90,  p12: 170, p16: 180, p20: 260, p24: 270 },
    CDG:                   { p1to3: 85,  p4: 85,  p5: 90,  p6: 90,  p7: 95,  p8: 100, p12: 185, p16: 200, p20: 285, p24: 300 },
    Orly:                  { p1to3: 75,  p4: 80,  p5: 80,  p6: 85,  p7: 90,  p8: 90,  p12: 170, p16: 180, p20: 260, p24: 270 },
    Beauvais:              { p1to3: 140, p4: 150, p5: 160, p6: 165, p7: 170, p8: 180, p12: 330, p16: 360, p20: 510, p24: 540 },
    Disneyland:            { p1to3: 90,  p4: 90,  p5: 100, p6: 110, p7: 120, p8: 125, p12: 215, p16: 250, p20: 340, p24: 375 },
    'Paris Train Station': { p1to3: 75,  p4: 80,  p5: 80,  p6: 85,  p7: 85,  p8: 90,  p12: 170, p16: 180, p20: 260, p24: 270 },
  },
};
