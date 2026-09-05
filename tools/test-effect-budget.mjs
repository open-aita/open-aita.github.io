import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const scope = { window: {} };
vm.runInNewContext(fs.readFileSync(new URL('../assets/js/effect-budget.js', import.meta.url), 'utf8'), scope);
const create = scope.window.createAitaEffectBudget;
const run = (budget, fps, seconds, start = 0) => {
  for (let i = 0; i <= fps * seconds; i++) budget.sample(start + i * 1000 / fps);
};
for (const fps of [30, 20, 15, 10]) {
  const budget = create();
  run(budget, fps, 8);
  assert.equal(budget.level, 0, `Real ${fps} FPS must trigger downgrade`);
}
{
  const budget = create();
  run(budget, 60, 10);
  assert.equal(budget.level, 1, 'Short headroom must not upgrade');
  run(budget, 60, 20, 10001);
  assert.equal(budget.level, 2, 'Sustained headroom recovers one level');
}
{
  const budget = create();
  run(budget, 60, 5);
  budget.reset(); // Offscreen / background pause, then resume hours later.
  run(budget, 60, 5, 3600000);
  assert.equal(budget.level, 1, 'Paused time must not count as a slow frame');
}
{
  const budget = create();
  run(budget, 15, 3);
  run(budget, 60, 6, 3001);
  assert.equal(budget.level, 1, 'A short startup stall must not permanently downgrade');
}
{
  const budget = create({ initial: 0, min: 0, max: 0 });
  run(budget, 60, 60);
  assert.equal(budget.level, 0, 'Lite mode stays bounded');
}
console.log('Effect budget: real low FPS, recovery, pause/resume, transient stalls, and lite bounds passed.');
