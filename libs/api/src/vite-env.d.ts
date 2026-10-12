declare module '*.seed.json' {
  const seed: { symbol: string; base: number; step: number; phase: number };
  export default seed;
}

declare module '*.seed.json?url&no-inline' {
  const assetUrl: string;
  export default assetUrl;
}
