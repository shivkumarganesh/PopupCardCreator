/**
 * Export. Inside the Atomm platform the SDK renders the Export button into
 * [data-atomm-export-button] and calls the `export` lifecycle hook; opened
 * on its own (GitHub Pages, localhost) the page falls back to a plain download.
 */
import { hasErrors } from '../core/build';
import { layoutSheets, toLaserSvg, toPrintHtml } from '../core/sheet';
import { modelOf, useStore } from './store';

interface ExportFile {
  filename: string;
  blob: Blob;
}
interface AtommSdk {
  lifecycle?: { on: (event: 'export', handler: (ctx: { intent?: string }) => Promise<ExportFile | ExportFile[]>) => void };
}
declare global {
  interface Window {
    atomm?: AtommSdk;
  }
}

/** True when the page runs in a host frame (the platform), false when opened directly. */
export const embedded = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

function currentDoc() {
  const model = modelOf(useStore.getState().design);
  if (hasErrors(model)) {
    const first = model.issues.find((i) => i.severity === 'error')!;
    throw new Error(`Fix this before exporting — ${first.message} ${first.fix}`);
  }
  return layoutSheets(model);
}

export function laserFile(): ExportFile {
  return { filename: 'popup-card.svg', blob: new Blob([toLaserSvg(currentDoc())], { type: 'image/svg+xml' }) };
}
export function printFile(): ExportFile {
  return { filename: 'popup-card-print-template.html', blob: new Blob([toPrintHtml(currentDoc())], { type: 'text/html' }) };
}

export function registerExportHook(): boolean {
  const on = window.atomm?.lifecycle?.on;
  if (!on) return false;
  window.atomm!.lifecycle!.on('export', async ({ intent }) =>
    // Studio only wants the cutting file; a download also carries the scissors template.
    intent === 'download' ? [laserFile(), printFile()] : laserFile(),
  );
  return true;
}

export function download(file: ExportFile) {
  const url = URL.createObjectURL(file.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Print the scissors template at 1:1 through a hidden frame; fall back to a download. */
export function printTemplate() {
  const html = toPrintHtml(currentDoc());
  try {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    frame.srcdoc = html;
    frame.onload = () => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => frame.remove(), 60_000);
    };
    document.body.append(frame);
  } catch {
    download(printFile());
  }
}
