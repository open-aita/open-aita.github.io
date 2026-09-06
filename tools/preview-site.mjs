import { build } from 'astro';
import path from 'node:path';
import { ROOT } from '../packages/operations-core/index.mjs';
import { prepareEffects } from './prepare-effects.mjs';
import { inspectSite } from './smoke-site.mjs';

export async function createPreview() {
  await prepareEffects();
  await build({root:path.join(ROOT,'apps/site'),logLevel:'silent'});
  const report=await inspectSite({outputDirectory:path.join(ROOT,'.work/preview'),testFailure:false});
  return {...report,mode:'fresh-astro-build',artifact:'dist/',nextActions:['review-current-screenshots']};
}
