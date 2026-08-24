export const qualityManifest = {
  compatibility: {
    journeys: [
      'landing-ticker-navigation',
      'ticker-stream-loss',
      'signed-out-auth-dialog',
      'dense-positions',
      'dense-scanner',
    ],
  },
  accessibility: {
    scans: [
      'A11Y-1',
      'A11Y-2',
      'A11Y-3',
      'A11Y-4',
      'A11Y-5',
      'A11Y-6',
      'A11Y-7',
      'A11Y-8',
      'A11Y-9',
    ],
    behaviors: ['A11Y-B1', 'A11Y-B2', 'A11Y-B3', 'A11Y-B4', 'A11Y-B5', 'A11Y-B6', 'A11Y-B7'],
  },
  visual: {
    scenarios: [
      'landing',
      'ticker-desktop',
      'ticker-offline-mobile',
      'positions-dense',
      'scanner-dense',
      'ai-recommendation',
    ],
  },
} as const;
