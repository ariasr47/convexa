export const ALLOWED = [
  'package.json',
  'package-lock.json',
  'apps/dashboard-e2e/',
  '.github/workflows/ci.yml',
  '.github/workflows/browser-visual-linux-candidates.yml',
  '.gitattributes',
];
export const D7_PRODUCT_ALLOWLIST = [
  'apps/dashboard/src/app/shared/ui/Widget/Widget.tsx',
  'apps/dashboard/src/app/pages/ticker/TickerDashboard.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/dealer-flow-projection/DealerFlowProjection.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/market-context/MarketContext.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/iv-rank/IvRank.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/straddle-move/StraddleMove.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/term-structure/TermStructure.tsx',
  'apps/dashboard/src/app/features/auth/SettingsPage.tsx',
  'apps/dashboard/src/app/shell/AppShell.tsx',
];
export const D8_PRODUCT_ALLOWLIST = [
  'apps/dashboard/src/app/pages/scanner/ScanCard.tsx',
  'apps/dashboard/src/app/pages/scanner/ScanCells.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.tsx',
  'apps/dashboard/src/app/features/trading/positions/PositionRow.tsx',
  'apps/dashboard/src/app/features/trading/positions/PlSparkline.tsx',
  'apps/dashboard/src/app/features/trading/positions/CustomizationToolbar.tsx',
  'apps/dashboard/src/app/features/trading/positions/PortfolioPanel.tsx',
  'apps/dashboard/src/app/features/trading/positions/PositionCard.tsx',
  'apps/dashboard/src/app/features/trading/positions/LegDisclosure.tsx',
  'apps/dashboard/src/app/features/trading/positions/PositionsPanel.tsx',
  'apps/dashboard/src/app/features/trading/outcomes/TrackRecordSection.tsx',
  'apps/dashboard/src/app/features/auth/RequireAuth.tsx',
  'apps/dashboard/src/app/features/auth/AuthDialogProvider.tsx',
  'apps/dashboard/src/app/features/auth/AuthDialog.tsx',
];
export const D8_TEST_ALLOWLIST = [
  'apps/dashboard/src/app/pages/scanner/scanner.risk.spec.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/fresh-positioning/FreshPositioning.spec.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/off-exchange-blocks/OffExchangeBlocks.spec.tsx',
  'apps/dashboard/src/app/pages/ticker/widgets/chrome/TapePulseStrip.spec.tsx',
  'apps/dashboard/src/app/features/trading/positions/PositionRow.a11y.spec.tsx',
  'apps/dashboard/src/app/features/trading/positions/positionCard.spec.tsx',
  'apps/dashboard/src/app/features/trading/positions/legDisclosure.spec.tsx',
  'apps/dashboard/src/app/features/trading/positions/positions.risk.spec.tsx',
  'apps/dashboard/src/app/features/trading/outcomes/track-record.flow.spec.tsx',
  'apps/dashboard/src/app/features/auth/auth.risk.spec.tsx',
];
export const D7_D8_PRODUCT_ALLOWLIST = [
  ...D7_PRODUCT_ALLOWLIST,
  ...D8_PRODUCT_ALLOWLIST,
  ...D8_TEST_ALLOWLIST,
];
const PRODUCT_ALLOWLIST = D7_D8_PRODUCT_ALLOWLIST;
export function isAllowedPath(file) {
  return (
    PRODUCT_ALLOWLIST.includes(file) ||
    ALLOWED.some((prefix) => (prefix.endsWith('/') ? file.startsWith(prefix) : file === prefix))
  );
}
export function assertIsolatedPaths(paths) {
  const forbidden = paths.filter(
    (file) =>
      !isAllowedPath(file) ||
      (file.startsWith('apps/dashboard/src/') && !PRODUCT_ALLOWLIST.includes(file)) ||
      (/^(apps\/dashboard\/src|apps\/dashboard\/public|libs\/api|apps\/api|libs\/quant-engine)(\/|$)/.test(
        file,
      ) &&
        !PRODUCT_ALLOWLIST.includes(file)),
  );
  if (forbidden.length) throw new Error(`forbidden changed paths: ${forbidden.join(', ')}`);
  return true;
}
