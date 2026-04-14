'use client';

import { useEffect, useRef, useState } from 'react';

const MAP_HTML_PATH = '/us-map.html';

function scopeMapCss(rawCss) {
  const scoped = rawCss
    .replace(/\bhtml\b/g, '.us-map-inline-root')
    .replace(/\bbody\b/g, '.us-map-inline-root');

  return `${scoped}

.us-map-inline-root {
  width: 100%;
}

.us-map-inline-root .app-container {
  width: 100% !important;
  max-width: none !important;
  margin: 0 auto !important;
  padding: 20px !important;
}
`;
}

async function loadScript(scriptDef, mountNode) {
  if (scriptDef.src) {
    const existing = document.querySelector(`script[data-inline-map-src="${scriptDef.src}"]`);
    if (existing) return;

    await new Promise((resolve, reject) => {
      const scriptEl = document.createElement('script');
      scriptEl.src = scriptDef.src;
      scriptEl.async = false;
      scriptEl.dataset.inlineMapSrc = scriptDef.src;
      scriptEl.onload = resolve;
      scriptEl.onerror = reject;
      document.body.appendChild(scriptEl);
    });
    return;
  }

  if (window.__avInlineMapScriptExecuted) return;
  window.__avInlineMapScriptExecuted = true;

  const inlineScript = document.createElement('script');
  inlineScript.text = scriptDef.text;
  mountNode.appendChild(inlineScript);
}

export default function InlineUsMap() {
  const hostRef = useRef(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let cancelled = false;

    const mountMap = async () => {
      try {
        const res = await fetch(MAP_HTML_PATH, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed to load ${MAP_HTML_PATH}`);

        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const scriptDefs = [...doc.querySelectorAll('script')].map((script) => ({
          src: script.src || '',
          text: script.textContent || '',
        }));

        doc.querySelectorAll('script').forEach((script) => script.remove());

        const styleBlocks = [...doc.querySelectorAll('style')]
          .map((style) => style.textContent || '')
          .join('\n');

        const scopedStyle = scopeMapCss(styleBlocks);
        const bodyMarkup = doc.body.innerHTML;

        if (cancelled || !hostRef.current) return;

        hostRef.current.innerHTML = `
          <div class="us-map-inline-root">
            <style>${scopedStyle}</style>
            ${bodyMarkup}
          </div>
        `;

        const root = hostRef.current.querySelector('.us-map-inline-root');
        for (const scriptDef of scriptDefs) {
          await loadScript(scriptDef, root);
        }

        if (!cancelled) setStatus('ready');
      } catch (error) {
        if (!cancelled) setStatus('error');
      }
    };

    mountMap();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="w-full border border-av-bone-faint overflow-hidden min-h-[760px]">
      {status === 'loading' && (
        <div className="min-h-[300px] flex items-center justify-center text-av-bone-muted text-sm tracking-wider">
          Loading interactive map...
        </div>
      )}
      {status === 'error' && (
        <div className="min-h-[300px] flex items-center justify-center text-av-bone-muted text-sm tracking-wider px-8 text-center">
          Unable to load map content. Please refresh and try again.
        </div>
      )}
      <div ref={hostRef} className={status === 'error' ? 'hidden' : 'block'} />
    </div>
  );
}
