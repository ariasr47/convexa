// Compatibility/test fixture wrapper; browser runtime uses the retryable JSON asset loader.
import { makeScenario } from './shared';
import seed from './spy.seed.json';
export default makeScenario('SPY', seed.base, seed.step, seed.phase);
