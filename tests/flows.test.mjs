import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildFlows, envParamName, spFieldXml } from '../tools/build/flows.mjs';
import { orderFlows } from '../tools/deployer/pplf-deployer.mjs';

const schema = JSON.parse(await readFile(new URL('../schema/pplf.schema.json', import.meta.url), 'utf8'));
const flows = buildFlows(schema);
const byName = new Map(flows.map((f) => [f.name, f]));

/** Walks every action map (including nested scopes, conditions, loops, switch cases). */
function* actionMaps(actions, path = 'root') {
  yield [path, actions];
  for (const [name, a] of Object.entries(actions)) {
    if (a.actions) yield* actionMaps(a.actions, `${path}/${name}`);
    if (a.else?.actions) yield* actionMaps(a.else.actions, `${path}/${name}/else`);
    if (a.cases) for (const [c, v] of Object.entries(a.cases)) yield* actionMaps(v.actions, `${path}/${name}/${c}`);
    if (a.default?.actions) yield* actionMaps(a.default.actions, `${path}/${name}/default`);
  }
}

function allActionNames(def) {
  const names = [];
  for (const [, map] of actionMaps(def.actions)) names.push(...Object.keys(map));
  return names;
}

test('flow names are unique and prefixed', () => {
  assert.equal(byName.size, flows.length);
  for (const f of flows) assert.match(f.name, /^PPLF \| [A-Za-z]+ \| /);
});

test('action names are unique within a flow', () => {
  for (const f of flows) {
    const names = allActionNames(f.clientdata.properties.definition);
    assert.equal(new Set(names).size, names.length, `${f.name} has duplicate action names`);
  }
});

test('runAfter only points at siblings in the same scope', () => {
  for (const f of flows) {
    for (const [path, map] of actionMaps(f.clientdata.properties.definition.actions)) {
      for (const [name, a] of Object.entries(map)) {
        for (const dep of Object.keys(a.runAfter ?? {})) assert.ok(dep in map, `${f.name} ${path}/${name} runs after missing sibling ${dep}`);
      }
    }
  }
});

test('every parameters(...) reference is declared in the flow', () => {
  for (const f of flows) {
    const def = f.clientdata.properties.definition;
    const text = JSON.stringify(def.actions) + JSON.stringify(def.triggers);
    for (const m of text.matchAll(/parameters\('([^']+)'\)/g)) {
      assert.ok(m[1] in def.parameters, `${f.name} uses undeclared parameter ${m[1]}`);
    }
  }
});

test('body/outputs/items references point at actions that exist', () => {
  for (const f of flows) {
    const def = f.clientdata.properties.definition;
    const names = new Set([...allActionNames(def), ...Object.keys(def.triggers)]);
    const text = JSON.stringify(def.actions);
    for (const m of text.matchAll(/(?:body|outputs|items|result)\('([^']+)'\)/g)) {
      assert.ok(names.has(m[1]), `${f.name} references unknown action ${m[1]}`);
    }
  }
});

test('connectors used are declared as connection references', () => {
  for (const f of flows) {
    const refs = f.clientdata.properties.connectionReferences;
    const text = JSON.stringify(f.clientdata.properties.definition);
    for (const m of text.matchAll(/"connectionName":"([^"]+)"/g)) assert.ok(m[1] in refs, `${f.name} uses ${m[1]} without a connection reference`);
    for (const r of Object.values(refs)) assert.ok(schema.connectionReferences.some((c) => c.logicalName === r.connection.connectionReferenceLogicalName));
  }
});

test('child flow calls resolve to flows in the set, with no cycles', () => {
  assert.doesNotThrow(() => orderFlows(flows));
  const order = orderFlows(flows).map((f) => f.name);
  assert.ok(order.indexOf('PPLF | Writers | Dataverse') < order.indexOf('PPLF | Router | Route Logs'));
  assert.ok(order.indexOf('PPLF | Router | Route Logs') < order.indexOf('PPLF | Logger | Write Log'));
  assert.ok(order.indexOf('PPLF | Logger | Write Log') < order.indexOf('PPLF | Templates | Try Catch'));
});

test('SharePoint writer uses standard connectors only (no Dataverse)', () => {
  const f = byName.get('PPLF | Writers | SharePoint');
  assert.ok(!JSON.stringify(f).includes('commondataservice'));
});

test('Dataverse writer sets every log column', () => {
  const f = byName.get('PPLF | Writers | Dataverse');
  const text = JSON.stringify(f);
  const log = schema.tables.find((t) => t.logicalName === 'pplf_log');
  for (const c of [log.primaryName, ...log.columns]) assert.ok(text.includes(`item/${c.schemaName.toLowerCase()}`), c.schemaName);
});

test('SharePoint writer sets every log field', () => {
  const text = JSON.stringify(byName.get('PPLF | Writers | SharePoint'));
  const log = schema.tables.find((t) => t.logicalName === 'pplf_log');
  for (const c of log.columns) assert.ok(text.includes(`item/${c.sp.internalName}`), c.sp.internalName);
});

test('environment parameter names follow the Power Automate convention', () => {
  assert.equal(envParamName(schema, 'pplf_LogTarget'), 'PPLF | Log Target (pplf_LogTarget)');
});

test('SharePoint field XML is well formed', () => {
  for (const t of schema.tables) for (const c of t.columns) {
    const xml = spFieldXml(schema, c);
    assert.match(xml, /^<Field [^>]*Name="Pplf\w+"/);
    assert.ok(xml.endsWith('/>') || xml.endsWith('</Field>'), xml);
  }
});

test('no SetVariable reads the variable it sets (Power Automate rejects self reference)', () => {
  for (const f of flows) {
    for (const [path, map] of actionMaps(f.clientdata.properties.definition.actions)) {
      for (const [name, a] of Object.entries(map)) {
        if (a.type !== 'SetVariable') continue;
        assert.ok(!JSON.stringify(a.inputs.value).includes(`variables('${a.inputs.name}')`), `${f.name} ${path}/${name} sets ${a.inputs.name} from itself`);
      }
    }
  }
});
