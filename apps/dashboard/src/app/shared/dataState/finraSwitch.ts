/**
 * FINRA on the live site (owner, 2026-10-15, answer 4): Off until the owner confirms FINRA's display
 * terms (Q-2; docs/public-data/FINRA-TERMS-2026-10-15.md). A code constant the owner flips, not a
 * platform setting. The pages that list sources read it (/credits, /methodology#data), so they say
 * Off with the reason even before the API that stops asking FINRA deploys. The demo shows sample
 * data shaped like FINRA's either way. The API has the twin switch,
 * `finra::FINRA_DISPLAY_APPROVED` (apps/api/src/services/public_data/finra.rs): flip both together.
 */
export const FINRA_ON_PRODUCTION = false;

/** Why FINRA is off, said wherever the site lists it as off. */
export const FINRA_OFF_REASON =
  'Off on this site until FINRA’s terms for showing its data here are confirmed. The demo shows sample data shaped like it.';
