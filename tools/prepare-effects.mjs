// Static iframe effects retain their own dependency realm and load near the viewport.
// Their canonical source lives with its chapter; public/effects is disposable output.
import { cp, mkdir } from 'node:fs/promises';
const destination = new URL('../apps/site/public/effects/', import.meta.url);
await mkdir(destination, { recursive: true });
for (const chapter of ['about', 'outputs']) {
  await cp(new URL(`../plugins/${chapter}/effect/`, import.meta.url), new URL(`${chapter}/`, destination), { recursive: true });
}
await cp(new URL('../packages/kernel/effect-budget.js', import.meta.url), new URL('effect-budget.js', destination));
