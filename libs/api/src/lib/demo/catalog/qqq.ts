// Compatibility/test fixture wrapper; browser runtime uses the retryable JSON asset loader.
import seed from './qqq.seed.json';
import { makeScenario } from './shared';
export default makeScenario('QQQ', seed.base, seed.step, seed.phase);
