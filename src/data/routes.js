// ⚠️  LES PRIX NE SONT PLUS ICI.
//     Pour changer un tarif, ouvrez → src/config/prices.js
//
//     PRICING NO LONGER LIVES HERE.
//     To change a price, open → src/config/prices.js
//
// This file keeps the non-price route metadata (which places can be picked
// as an origin / destination, vehicle capacities) and re-exports the pricing
// values so existing imports keep working unchanged.

export { PRICES, ROUND_TRIP_DISCOUNT, ROUND_TRIP_DISCOUNT_PERCENT, HOURLY_RATE } from '../config/prices.js';

export const PICKUP_POINTS = ['CDG', 'Orly', 'Beauvais', 'Paris', 'Disneyland', 'Paris Train Station', 'Versailles'];
export const DROP_POINTS = ['Paris', 'Disneyland', 'Versailles', 'Paris Train Station', 'CDG', 'Orly', 'Beauvais'];

// Informational vehicle metadata. Used only for human-readable summaries.
export const VEHICLE_CAPACITY = {
  car: { min: 1, max: 3, model: 'Tesla Model Y' },
  van: { min: 4, max: 8, model: 'Mercedes Vito / Renault Trafic' },
};
