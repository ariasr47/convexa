import aaplSeedUrl from './aapl.seed.json?url&no-inline';
import msftSeedUrl from './msft.seed.json?url&no-inline';
import nvdaSeedUrl from './nvda.seed.json?url&no-inline';
import qqqSeedUrl from './qqq.seed.json?url&no-inline';
import type { ScenarioSeedAssets } from './scenario-loader';
import spySeedUrl from './spy.seed.json?url&no-inline';
import tslaSeedUrl from './tsla.seed.json?url&no-inline';

export const scenarioSeedAssets: ScenarioSeedAssets = {
  SPY: spySeedUrl,
  QQQ: qqqSeedUrl,
  AAPL: aaplSeedUrl,
  MSFT: msftSeedUrl,
  NVDA: nvdaSeedUrl,
  TSLA: tslaSeedUrl,
};
