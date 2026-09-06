// Static iframe effects retain their own dependency realm and load near the viewport.
// Their canonical source lives with its chapter; public/effects is disposable output.
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
export async function prepareEffects(root = new URL('../', import.meta.url)) {
  const destination = new URL('apps/site/public/effects/', root);
  const rootPath = path.resolve(fileURLToPath(root));
  const destinationPath = path.resolve(fileURLToPath(destination));
  if (!destinationPath.startsWith(rootPath+path.sep)) throw new Error('Effect output must stay inside the repository');
  await rm(destinationPath, {recursive:true,force:true});
  await mkdir(destination, { recursive: true });
  for (const chapter of ['about', 'outputs']) {
    await cp(new URL(`plugins/${chapter}/effect/`, root), new URL(`${chapter}/`, destination), { recursive: true, filter:file=>!file.endsWith('.md') });
  }
  await cp(new URL('packages/kernel/effect-budget.js', root), new URL('effect-budget.js', destination));
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await prepareEffects();
