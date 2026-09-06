import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

interface ChapterManifest {
  apiVersion: string; id: string; order: number; entry: string; demoEntry: string;
  consumes: string[]; operations: string[];
  navigation: { label: string; primaryLabel?: string; primaryOrder?: number; utilityLabel?: string };
}
const manifests = import.meta.glob<ChapterManifest>('../../../plugins/*/chapter.manifest.json', { eager: true, import: 'default' });
const components = import.meta.glob<AstroComponentFactory>('../../../plugins/*/Section.astro', { eager: true, import: 'default' });

// The manifest selects its real component and position in the built page.
export const chapters = Object.entries(manifests).map(([path, manifest]) => {
  const entry = path.replace('chapter.manifest.json', manifest.entry);
  const Component = components[entry];
  if (!Component) throw new Error(`Missing chapter entry: ${entry}`);
  return { ...manifest, Component };
}).sort((a, b) => a.order - b.order);
