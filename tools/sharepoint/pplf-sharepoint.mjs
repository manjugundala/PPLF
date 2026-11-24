// Power Platform Logging Framework - SharePoint provisioning
// -----------------------------------------------------------------------------
// Creates the PPLF Logs and PPLF Log Config lists from src/sharepoint/lists.json.
// Same steps as the "PPLF | Setup | Provision SharePoint" flow, for admins who prefer a
// script. Idempotent. Zero dependencies.
//
//   Browser: open the target site, paste dist/pplf-deployer.browser.js into the
//            console, run: await PplfDeployer.provisionSharePoint()
//   Node:    PPLF_SP_TOKEN=<token for https://tenant.sharepoint.com> \
//            node tools/sharepoint/cli.mjs --site https://tenant.sharepoint.com/sites/ops
// -----------------------------------------------------------------------------

export function createSpClient({ siteUrl, token, fetchImpl, log = console.log }) {
  const base = siteUrl.replace(/\/+$/, '') + '/';
  const doFetch = fetchImpl || globalThis.fetch.bind(globalThis);
  let digest = null;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function call(method, uri, body, extra = {}) {
    // SharePoint throttles bursts of schema changes with 429/503; back off and retry.
    for (let attempt = 0; ; attempt++) {
      const headers = { Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata', ...extra };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (method !== 'GET' && !token) {
        if (!digest) {
          const r = await doFetch(base + '_api/contextinfo', { method: 'POST', headers: { Accept: 'application/json;odata=nometadata' }, credentials: 'include' });
          digest = (await r.json()).FormDigestValue;
        }
        headers['X-RequestDigest'] = digest;
      }
      const res = await doFetch(base + uri, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), credentials: token ? 'omit' : 'include' });
      const text = await res.text();
      if ((res.status === 429 || res.status === 503) && attempt < 6) {
        const retryAfter = Number(res.headers.get('Retry-After')) || 0;
        await sleep(Math.max(retryAfter * 1000, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`${method} ${uri} -> ${res.status}: ${text.slice(0, 300)}`);
      return text ? JSON.parse(text) : null;
    }
  }
  return { base, log, call };
}

export async function provisionLists({ siteUrl, lists, token, fetchImpl, log = console.log }) {
  const sp = createSpClient({ siteUrl, token, fetchImpl, log });
  const ids = {};
  for (const list of lists) {
    const found = await sp.call('GET', `_api/web/lists?$select=Id,Title&$filter=RootFolder/Name eq '${list.url}'`);
    let id;
    if (found.value.length) {
      id = found.value[0].Id;
      log(`✓ list ${list.title}`);
    } else {
      const created = await sp.call('POST', '_api/web/lists', { Title: list.url, Description: list.description, BaseTemplate: 100, AllowContentTypes: false });
      id = created.Id;
      await sp.call('POST', `_api/web/lists(guid'${id}')`, { Title: list.title }, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' });
      log(`+ list ${list.title}`);
    }
    for (const field of list.fields) {
      const f = await sp.call('GET', `_api/web/lists(guid'${id}')/fields?$select=Id&$filter=InternalName eq '${field.internalName}'`);
      if (f.value.length) { log(`  ✓ ${field.internalName}`); continue; }
      await sp.call('POST', `_api/web/lists(guid'${id}')/fields/createfieldasxml`, { parameters: { SchemaXml: field.schemaXml, Options: 24 } });
      log(`  + ${field.internalName}`);
    }
    await sp.call('POST', `_api/web/lists(guid'${id}')/fields/getbyinternalnameortitle('Created')`, { Indexed: true }, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' });
    ids[list.key] = id;
  }
  if (ids.pplf_logconfig) {
    const rows = await sp.call('GET', `_api/web/lists(guid'${ids.pplf_logconfig}')/items?$select=Id&$filter=Title eq '*'`);
    if (!rows.value.length) {
      await sp.call('POST', `_api/web/lists(guid'${ids.pplf_logconfig}')/items`, {
        Title: '*', PplfMinimumLevel: 'Information', PplfMinimumSeverity: 2, PplfEnabled: true, PplfRetentionDays: 30,
        PplfNotes: 'Default settings for every source without its own row.'
      });
      log('+ default config row (*)');
    }
  }
  log(`Done. Log list id ${ids.pplf_log}, config list id ${ids.pplf_logconfig}`);
  return ids;
}
