// Compatibility/test fixture wrapper; browser runtime uses the retryable JSON asset loader.
import seed from './msft.seed.json';
import { makeScenario } from './shared';
export default makeScenario('MSFT', seed.base, seed.step, seed.phase);
