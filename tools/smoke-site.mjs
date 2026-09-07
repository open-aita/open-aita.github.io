import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { preview } from 'astro';
import { chromium } from 'playwright';
import { ROOT, chapterManifests } from '../packages/operations-core/index.mjs';
import { loadContent } from '../packages/content-loader-git/index.mjs';

// One existing-site journey, plus the migration's critical failure path.
export async function inspectSite({ outputDirectory = path.join(ROOT,'.work/smoke'), testFailure = true } = {}) {
  await fs.mkdir(outputDirectory, {recursive:true});
  const server = await preview({root:path.join(ROOT,'apps/site'),logLevel:'silent',server:{host:'127.0.0.1',port:0}});
  const url = `http://127.0.0.1:${server.port}`;
  let browser;
  const report = {ok:false,createdAt:new Date().toISOString(),pages:[],faultIsolation:null};
  try {
    browser = await chromium.launch({headless:true,channel:process.env.AITA_BROWSER_CHANNEL || (process.platform==='win32'?'msedge':undefined),args:['--enable-unsafe-swiftshader']});
    const content = loadContent();
    const chapters = await chapterManifests();
    for (const width of [1440,390]) {
      const page = await browser.newPage({viewport:{width,height:900},reducedMotion:width===390?'reduce':'no-preference'});
      const errors=[], remote=[], missing=[];
      const networkRequests=[];
      let releaseGba;
      const delayedGba=new Promise(resolve=>{releaseGba=resolve;});
      page.on('pageerror',error=>errors.push(error.message));
      page.on('response',response=>{if(response.status()>=400)missing.push(`${response.status()} ${response.url()}`);});
      await page.route('**/*',async route=>{
        const request=route.request().url();
        if (/^https?:/.test(request) && !request.startsWith(url+'/')) {remote.push(request);return route.abort();}
        if (request.includes('/assets/images/network-')) networkRequests.push(request);
        if (width===1440 && request.includes('/network-gba.webp')) await delayedGba;
        return route.continue();
      });
      await page.goto(url);
      await page.waitForFunction(()=>['top','about','research','projects','outputs','achievements','network','activities','join','main-content'].every(id=>document.getElementById(id)?.dataset.enhanced==='true'));
      if (width===1440) {
        // Fresh context/cache-disabled routing: prepare offscreen, but do not animate.
        await page.waitForFunction(()=>document.querySelector('#outputs iframe').classList.contains('is-loaded'),null,{timeout:20000});
        assert.equal(await page.frameLocator('#outputs iframe').locator('body').getAttribute('data-active'),'false');
        assert.equal(networkRequests.length,2,'Both maps should fetch before scrolling');
        await page.locator('#network').evaluate(el=>el.scrollIntoView({behavior:'instant'}));
        await page.waitForFunction(()=>document.querySelector('#main-map').classList.contains('is-ready'));
        assert.equal(await page.locator('#gba-map').evaluate(el=>el.classList.contains('is-ready')),false,'Slow regional map must not block the main map');
        releaseGba();
        await page.waitForFunction(()=>document.querySelector('#gba-map').classList.contains('is-ready'));
      } else {
        assert.equal(await page.locator('#outputs iframe').getAttribute('src'),null,'Reduced motion skips the dynamic effect');
      }
      for (const chapter of chapters) {
        await page.locator(chapter.demoEntry).scrollIntoViewIfNeeded();
        if (width===1440 && ['about','outputs'].includes(chapter.id)) {
          await page.locator(`${chapter.demoEntry} iframe`).evaluate(frame=>frame.scrollIntoView());
          await page.waitForFunction(id=>document.querySelector(`${id} iframe`).classList.contains('is-loaded'),chapter.demoEntry,{timeout:20000});
          if (chapter.id==='outputs') await page.frameLocator('#outputs iframe').locator('body[data-active="true"]').waitFor();
        }
      }
      const currentProjects=content.projects.filter(p=>p.status!=='archived');
      assert.equal(await page.locator('.project-card').count(),currentProjects.length);
      await page.locator('[data-filter="medical"]').click();
      assert.equal(await page.locator('.project-card:not([hidden])').count(),currentProjects.filter(p=>p.category==='medical').length);
      await page.locator('[data-filter="all"]').click();
      await page.locator('.gallery-card').first().click();
      assert.equal(await page.locator('#activities dialog[open]').count(),1);
      await page.locator('[data-lightbox-close]').click();
      await page.locator('#partner-search').fill('Datawhale');
      assert.equal(await page.locator('.partner-index-item:not([disabled])').count(),1);
      await page.locator('#partner-search').fill('');
      await page.locator('.award-records summary').click();
      assert.equal(await page.locator('.award-records[open] li').count(),content.achievements.filter(a=>['competition','award','grant'].includes(a.type)).length);
      await page.locator('.award-records summary').click();
      assert.deepEqual(await page.locator('[data-join-link]').evaluateAll(links=>links.map(link=>link.getAttribute('href'))),Array(3).fill(content.recruitment[0].formUrl||'#join'));
      assert.equal(await page.locator('.paths-careers li').count(),content['member-paths'].careers.length);
      assert.equal(await page.locator('.paths-study li').count(),content['member-paths'].furtherStudy.length);
      if (width===390) {
        await page.locator('[data-menu-toggle]').click();
        assert.equal(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded'),'true');
        await page.locator('.mobile-menu a[href="#paths"]').click();
        assert.equal(await page.locator('[data-menu-toggle]').getAttribute('aria-expanded'),'false');
      }
      await page.locator('#join a[href="#top"]').click();
      await page.waitForFunction(()=>scrollY<8);
      await page.evaluate(()=>document.activeElement?.blur());
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow');
      assert.deepEqual({errors,remote,missing},{errors:[],remote:[],missing:[]});
      // Finish every reveal before capturing a full-page view.
      await page.evaluate(()=>document.querySelectorAll('.reveal').forEach(el=>el.classList.add('is-visible')));
      const screenshot=path.join(outputDirectory,`page-${width}.png`);
      await page.screenshot({path:screenshot,fullPage:true,animations:'disabled'});
      report.pages.push({width,screenshot,errors,remoteRequests:remote,missingResources:missing});
      await page.close();
    }
    if (testFailure) {
      const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
      await page.addInitScript(()=>{
        const getContext=HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext=function(...args){
          if(this.id==='research-field')throw new Error('Injected Research initialization failure');
          return getContext.apply(this,args);
        };
      });
      await page.goto(url);
      await page.waitForFunction(()=>document.querySelector('#research').dataset.enhanced==='false' && ['outputs','join','projects','main-content'].every(id=>document.getElementById(id).dataset.enhanced==='true'));
      await page.locator('[data-filter="agents"]').click();
      assert.equal(await page.locator('.project-card:not([hidden])').count(),content.projects.filter(p=>p.category==='agents'&&p.status!=='archived').length);
      report.faultIsolation='Research failure is contained; navigation, project filter, Outputs and Join initialize.';
      await page.close();
    }
    report.ok=true;
    return report;
  } catch(error) {
    report.error=error.message;
    throw error;
  } finally {
    await browser?.close();
    await server.stop();
    await fs.writeFile(path.join(outputDirectory,'report.json'),JSON.stringify(report,null,2)+'\n');
  }
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href===import.meta.url) console.log(JSON.stringify(await inspectSite(),null,2));
