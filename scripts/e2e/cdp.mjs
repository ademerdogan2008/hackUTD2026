// Minimal CDP helper: one Page per Chrome instance (separate profile = separate Spacetime identity).
export async function openPage(port, url) {
  const t = await (await fetch(`http://localhost:${port}/json/new?${url}`, { method: 'PUT' })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const logs = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
    if (d.method === 'Runtime.exceptionThrown') logs.push('[exception] ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).split('\n')[0]);
    if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warn'))
      logs.push(`[${d.params.type}] ` + d.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 300));
  };
  await new Promise((r) => (ws.onopen = r));
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable');
  await send('Page.enable');
  const evalJs = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value;
  const page = {
    logs,
    send,
    evalJs,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    text: () => evalJs('document.body.innerText'),
    async waitText(re, timeout = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const t = await page.text();
        if (new RegExp(re, 'i').test(t ?? '')) return true;
        await page.sleep(250);
      }
      throw new Error(`timeout waiting for /${re}/\n--- page text ---\n${(await page.text())?.slice(0, 1500)}\n--- logs ---\n${logs.join('\n')}`);
    },
    // Click the innermost visible element whose trimmed text matches exactly (case-insensitive) or aria-label matches.
    async click(label) {
      const ok = await evalJs(`(() => {
        const want = ${JSON.stringify(label)}.toLowerCase();
        const all = [...document.querySelectorAll('*')].filter(e => {
          const t = (e.innerText || '').trim().toLowerCase();
          const a = (e.getAttribute('aria-label') || '').trim().toLowerCase();
          return (t === want || a === want) && e.offsetParent !== null;
        });
        const leaf = all.filter(e => !all.some(o => o !== e && e.contains(o)));
        let el = leaf[leaf.length - 1];
        if (!el) return false;
        let c = el; while (c && !(c.getAttribute && (c.getAttribute('role') === 'button' || c.tagName === 'BUTTON' || c.getAttribute('tabindex') === '0'))) c = c.parentElement;
        (c || el).click();
        return true;
      })()`);
      if (!ok) throw new Error(`click: not found "${label}"\n--- page text ---\n${(await page.text())?.slice(0, 1500)}`);
      await page.sleep(400);
    },
    // Type into the nth visible input/textarea (by order) using React-compatible value setter.
    async type(value, nth = 0) {
      const ok = await evalJs(`(() => {
        const els = [...document.querySelectorAll('input, textarea')].filter(e => e.offsetParent !== null);
        const el = els[${nth}]; if (!el) return false;
        const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)});
        el.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      })()`);
      if (!ok) throw new Error(`type: input #${nth} not found`);
      await page.sleep(200);
    },
    async pin(digits) {
      for (const d of digits) await page.click(d);
    },
    async screenshot(path) {
      const { writeFileSync } = await import('node:fs');
      const r = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(path, Buffer.from(r.result.data, 'base64'));
    },
    close: () => ws.close(),
  };
  return page;
}
