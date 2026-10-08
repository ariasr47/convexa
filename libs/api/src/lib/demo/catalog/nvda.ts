// Compatibility/test fixture wrapper; browser runtime uses the retryable JSON asset loader.
import seed from './nvda.seed.json';
import { makeScenario } from './shared';
export default makeScenario('NVDA', seed.base, seed.step, seed.phase);
