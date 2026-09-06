import { validateContent } from '../domain/index.mjs';
import settings from '../../content/settings.json' with { type: 'json' };
import projects from '../../content/projects.json' with { type: 'json' };
import organizations from '../../content/organizations.json' with { type: 'json' };
import outputs from '../../content/outputs.json' with { type: 'json' };
import achievements from '../../content/achievements.json' with { type: 'json' };
import events from '../../content/events.json' with { type: 'json' };
import news from '../../content/news.json' with { type: 'json' };
import recruitment from '../../content/recruitment.json' with { type: 'json' };
import media from '../../content/media-assets.json' with { type: 'json' };
import evidence from '../../content/evidence.json' with { type: 'json' };
import redirects from '../../content/redirects.json' with { type: 'json' };
import paths from '../../content/member-paths.json' with { type: 'json' };

export function loadContent() {
  // Explicit imports are tracked by Astro/Vite, including in development and prerendering.
  // AJV remains the runtime authority; TS infers the populated collections from their JSON.
  const content = { settings, projects, organizations, outputs, achievements, events,
    news: /** @type {{id:string,title:{zh?:string,en?:string},summary?:{zh?:string,en?:string},status?:string}[]} */ (news),
    recruitment, 'media-assets': media, evidence, redirects, 'member-paths': paths };
  const errors = validateContent(content);
  if (errors.length) throw new Error(`Content validation failed:\n${JSON.stringify(errors, null, 2)}`);
  return content;
}
export const text = value => typeof value === 'string' ? value : value?.zh ?? value?.en ?? '';
export const number = (value, width = 2) => String(value).padStart(width, '0');
