import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as D from '../tools/deployer/pplf-deployer.mjs';
import { buildFlows } from '../tools/build/flows.mjs';

const schema = JSON.parse(await readFile(new URL('../schema/pplf.schema.json', import.meta.url), 'utf8'));

test('label() builds a 1033 localized label', () => {
  const l = D.label('Hello');
  assert.equal(l.LocalizedLabels[0].Label, 'Hello');
  assert.equal(l.LocalizedLabels[0].LanguageCode, 1033);
});

test('buildGlobalChoice for levels has six options with prefixed values', () => {
  const gc = D.buildGlobalChoice(schema, schema.globalChoices[0]);
  assert.equal(gc.Options.length, 6);
  assert.equal(gc.Options[4].Value, 917000004);
  assert.equal(gc.IsGlobal, true);
});

test('buildColumn maps every schema type', () => {
  const ids = Object.fromEntries(schema.globalChoices.map((g) => [g.schemaName, '11111111-1111-1111-1111-111111111111']));
  for (const t of schema.tables) for (const c of t.columns) {
    const a = D.buildColumn(c, ids);
    assert.equal(a.SchemaName, c.schemaName);
    assert.match(a['@odata.type'], /^Microsoft\.Dynamics\.CRM\.\w+AttributeMetadata$/);
  }
});

test('buildColumn refuses a choice without its MetadataId', () => {
  const c = schema.tables[0].columns.find((x) => x.type === 'Choice');
  assert.throws(() => D.buildColumn(c, {}), /MetadataId/);
});

test('buildEnvironmentVariable handles string and data source types', () => {
  const s = D.buildEnvironmentVariable(schema.environmentVariables[0]);
  assert.equal(s.type, D.ENV_VAR_TYPES.String);
  assert.equal(s.defaultvalue, 'Dataverse');
  const list = schema.environmentVariables.find((e) => e.schemaName === 'pplf_SharePointLogList');
  assert.throws(() => D.buildEnvironmentVariable(list, {}), /Parent/);
  const b = D.buildEnvironmentVariable(list, { pplf_SharePointSite: 'abc' });
  assert.equal(b.parameterkey, 'table');
  assert.equal(b['ParentDefinitionId@odata.bind'], '/environmentvariabledefinitions(abc)');
});

test('resolveFlowPlaceholders swaps names for ids and fails on unknown flows', () => {
  assert.equal(D.resolveFlowPlaceholders('x {{flow:A}} y', { A: 'id-1' }), 'x id-1 y');
  assert.throws(() => D.resolveFlowPlaceholders('{{flow:B}}', {}), /has not been created/);
});

test('parseEntityId reads the id from OData-EntityId', () => {
  assert.equal(D.parseEntityId('https://x/api/data/v9.2/pplf_logs(0b6c1a2e-1111-2222-3333-444455556666)'), '0b6c1a2e-1111-2222-3333-444455556666');
});

test('full deploy runs end to end against a fake Dataverse', async () => {
  const calls = [];
  const seen = new Set();
  const fake = async (url, init) => {
    const path = url.replace(/^.*\/api\/data\/v9\.2\//, '');
    calls.push(`${init.method} ${path.split('?')[0]}`);
    // Metadata GETs return 404 the first time so the create path runs.
    const metaGet = init.method === 'GET' && /^(GlobalOptionSetDefinitions|EntityDefinitions)\(/.test(path);
    const notFound = metaGet && !seen.has(path);
    if (metaGet) seen.add(path);
    let body;
    if (init.method !== 'GET') body = '';
    else if (path.startsWith('WhoAmI')) body = JSON.stringify({ BusinessUnitId: 'bu' });
    else if (path.startsWith('privileges')) body = JSON.stringify({ value: [{ privilegeid: 'p' }] });
    else if (notFound && !path.startsWith('GlobalOptionSetDefinitions')) return { ok: false, status: 404, headers: { get: () => null }, text: async () => '{}' };
    else body = JSON.stringify({ value: [], MetadataId: 'm' });
    return { ok: true, status: init.method === 'GET' ? 200 : 204, headers: { get: () => '(00000000-0000-0000-0000-000000000001)' }, text: async () => body };
  };
  const logs = [];
  const client = D.createClient({ envUrl: 'https://x.crm.dynamics.com/', token: 't', solution: schema.solution.uniqueName, fetchImpl: fake, log: (m) => logs.push(m) });
  await D.deploy({ client, schema, flows: buildFlows(schema) });
  assert.ok(calls.includes('POST publishers'));
  assert.ok(calls.includes('POST solutions'));
  assert.ok(calls.includes('POST PublishXml'));
  assert.equal(calls.filter((c) => c === 'POST workflows').length, buildFlows(schema).length);
  assert.ok(logs.at(-1).startsWith('Done'));
});
