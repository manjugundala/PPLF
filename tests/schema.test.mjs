import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const schema = JSON.parse(await readFile(new URL('../schema/pplf.schema.json', import.meta.url), 'utf8'));
const entrySchema = JSON.parse(await readFile(new URL('../schema/log-entry.schema.json', import.meta.url), 'utf8'));
const prefix = schema.publisher.customizationPrefix;

test('every schema name uses the publisher prefix', () => {
  const names = [
    ...schema.globalChoices.map((g) => g.schemaName),
    ...schema.tables.flatMap((t) => [t.schemaName, t.primaryName.schemaName, ...t.columns.map((c) => c.schemaName)]),
    ...schema.environmentVariables.map((e) => e.schemaName),
    ...schema.connectionReferences.map((c) => c.logicalName),
    ...schema.customApis.map((a) => a.uniqueName)
  ];
  for (const n of names) assert.ok(n.toLowerCase().startsWith(`${prefix}_`), `${n} must start with ${prefix}_`);
});

test('logical names match schema names', () => {
  for (const t of schema.tables) {
    assert.equal(t.logicalName, t.schemaName.toLowerCase());
    assert.equal(t.entitySetName, `${t.logicalName}s`);
  }
});

test('choice values use the option value prefix', () => {
  const p = schema.publisher.customizationOptionValuePrefix;
  const values = [...schema.levels.map((l) => l.value), ...schema.globalChoices.flatMap((g) => g.options?.map((o) => o.value) ?? [])];
  for (const v of values) assert.equal(Math.floor(v / 10000), p, `${v} must start with ${p}`);
});

test('level value = base + severity, severities 0..5 in order', () => {
  schema.levels.forEach((l, i) => {
    assert.equal(l.severity, i);
    assert.equal(l.value, schema.levels[0].value + i);
  });
});

test('column names are unique per table, SharePoint names unique too', () => {
  for (const t of schema.tables) {
    const dv = t.columns.map((c) => c.schemaName.toLowerCase());
    const sp = t.columns.map((c) => c.sp.internalName);
    assert.equal(new Set(dv).size, dv.length, `duplicate column in ${t.logicalName}`);
    assert.equal(new Set(sp).size, sp.length, `duplicate SharePoint field in ${t.logicalName}`);
    for (const n of sp) assert.match(n, /^Pplf[A-Za-z]+$/, `SharePoint internal name ${n} must be PplfXxx with no spaces`);
  }
});

test('choice columns point at a defined global choice', () => {
  const defined = new Set(schema.globalChoices.map((g) => g.schemaName));
  for (const t of schema.tables) for (const c of t.columns.filter((c) => c.type === 'Choice')) assert.ok(defined.has(c.globalChoice), c.schemaName);
});

test('wire format covers every log column', () => {
  const log = schema.tables.find((t) => t.logicalName === 'pplf_log');
  const wire = Object.keys(entrySchema.properties).map((k) => k.toLowerCase());
  const mapping = { pplf_severity: 'level', pplf_userprincipalname: 'userprincipalname' };
  for (const c of log.columns) {
    const key = mapping[c.schemaName.toLowerCase()] ?? c.schemaName.toLowerCase().replace(`${prefix}_`, '');
    assert.ok(wire.includes(key), `${c.schemaName} has no wire field (${key})`);
  }
});

test('wire format levels and source types match the schema', () => {
  assert.deepEqual(entrySchema.properties.level.enum, schema.levels.map((l) => l.name));
  const st = schema.globalChoices.find((g) => g.schemaName === 'pplf_sourcetype').options.map((o) => o.label);
  assert.deepEqual(entrySchema.properties.sourceType.enum, st);
});

test('data source environment variables reference a defined parent', () => {
  const names = schema.environmentVariables.map((e) => e.schemaName);
  schema.environmentVariables.forEach((e, i) => {
    if (e.parentParameter) assert.ok(names.indexOf(e.parentParameter) > -1 && names.indexOf(e.parentParameter) < i, `${e.schemaName} parent must be declared first`);
  });
});

test('security roles only reference schema tables', () => {
  const tables = new Set(schema.tables.map((t) => t.logicalName));
  for (const r of schema.securityRoles) for (const p of r.privileges) assert.ok(tables.has(p.table), p.table);
});
