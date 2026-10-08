// Compatibility/test fixture wrapper; browser runtime uses the retryable JSON asset loader.
import seed from './tsla.seed.json';
import { makeScenario } from './shared';
export default makeScenario('TSLA', seed.base, seed.step, seed.phase);
