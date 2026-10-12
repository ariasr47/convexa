// Compatibility/test fixture wrapper; browser runtime uses the retryable JSON asset loader.
import { makeScenario } from './shared';
import seed from './tsla.seed.json';
export default makeScenario('TSLA', seed.base, seed.step, seed.phase);
