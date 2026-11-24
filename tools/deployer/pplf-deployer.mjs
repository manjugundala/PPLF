// Power Platform Logging Framework - Dataverse deployer
// -----------------------------------------------------------------------------
// Builds the PPLF solution in a Dataverse environment straight from
// schema/pplf.schema.json and src/flows/*.json. Zero dependencies.
//
// It is idempotent: every step checks whether the component already exists and
// only creates what is missing, so you can run it again after a failure.
//
// Runs in two places:
//   * Node 22+   : node tools/deployer/cli.mjs --env https://org.crm.dynamics.com
//   * A browser  : open https://org.crm.dynamics.com, paste dist/pplf-deployer.browser.js
//                  into the dev tools console, then run PplfDeployer.deploy()
//
// NOTE: keep top-level declarations as `export function` / `export const` so the
// build script can turn this file into a browser bundle.
// -----------------------------------------------------------------------------

export const LANGUAGE = 1033;

export const ENV_VAR_TYPES = {
  String: 100000000,
  Number: 100000001,
  Boolean: 100000002,
  JSON: 100000003,
  DataSource: 100000004,
  Secret: 100000005
};

export const COMPONENT_TYPES = { Entity: 1, OptionSet: 9, Role: 20, Workflow: 29, EnvironmentVariableDefinition: 380 };

export function label(text) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.Label',
    LocalizedLabels: [{ '@odata.type': 'Microsoft.Dynamics.CRM.LocalizedLabel', Label: text ?? '', LanguageCode: LANGUAGE }]
  };
}

// ---------------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------------

/**
 * Creates a tiny Dataverse Web API client.
 * @param {object} o
 * @param {string} o.envUrl          e.g. https://org.crm.dynamics.com
 * @param {string} [o.token]          Bearer token. Omit in a browser on the same origin.
 * @param {string} [o.solution]       Solution unique name; components created are added to it.
 * @param {(msg:string)=>void} [o.log]
 * @param {typeof fetch} [o.fetchImpl]
 */
export function createClient({ envUrl, token, solution, log = console.log, fetchImpl }) {
  const base = envUrl.replace(/\/+$/, '') + '/api/data/v9.2/';
  const doFetch = fetchImpl || globalThis.fetch.bind(globalThis);

  async function request(method, path, body, extraHeaders = {}) {
    const headers = {
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
      'Content-Type': 'application/json; charset=utf-8',
      ...extraHeaders
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    if (solution && method !== 'GET') headers['MSCRM.SolutionUniqueName'] = solution;
    const res = await doFetch(base + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: token ? 'omit' : 'include'
    });
    if (res.status === 204) {
      return { status: 204, entityId: parseEntityId(res.headers.get('OData-EntityId')) };
    }
    const text = await res.text();
    const json = text ? safeJson(text) : null;
    if (!res.ok) {
      const err = new Error(`${method} ${path} -> ${res.status}: ${json?.error?.message || text}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  }

  return {
    base,
    log,
    get: (p) => request('GET', p),
    post: (p, b, h) => request('POST', p, b, h),
    patch: (p, b, h) => request('PATCH', p, b, h),
    del: (p) => request('DELETE', p),
    /** GET that returns null on 404 instead of throwing. */
    async tryGet(p) {
      try { return await request('GET', p); } catch (e) { if (e.status === 404) return null; throw e; }
    }
  };
}

export function parseEntityId(header) {
  if (!header) return null;
  const m = /\(([0-9a-fA-F-]{36})\)/.exec(header);
  return m ? m[1] : null;
}

export function safeJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

export function odataString(s) {
  return String(s).replace(/'/g, "''");
}

// ---------------------------------------------------------------------------
// Pure builders (unit tested)
// ---------------------------------------------------------------------------

export function choiceOptions(schema, globalChoice) {
  if (globalChoice.fromLevels) return schema.levels.map((l) => ({ label: l.name, value: l.value }));
  return globalChoice.options.map((o) => ({ label: o.label, value: o.value }));
}

export function buildGlobalChoice(schema, gc) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.OptionSetMetadata',
    Name: gc.schemaName,
    DisplayName: label(gc.displayName),
    Description: label(gc.description),
    IsGlobal: true,
    OptionSetType: 'Picklist',
    Options: choiceOptions(schema, gc).map((o) => ({ Value: o.value, Label: label(o.label) }))
  };
}

export function buildPrimaryName(table) {
  const p = table.primaryName;
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
    SchemaName: p.schemaName,
    IsPrimaryName: true,
    MaxLength: p.maxLength,
    FormatName: { Value: 'Text' },
    RequiredLevel: { Value: 'ApplicationRequired', CanBeChanged: true },
    DisplayName: label(p.displayName),
    Description: label(p.description)
  };
}

export function buildTable(table) {
  return {
    '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata',
    SchemaName: table.schemaName,
    DisplayName: label(table.displayName),
    DisplayCollectionName: label(table.displayCollectionName),
    Description: label(table.description),
    OwnershipType: table.ownership,
    IsActivity: false,
    HasActivities: false,
    HasNotes: false,
    Attributes: [buildPrimaryName(table)]
  };
}

/**
 * Builds the attribute metadata for one column.
 * @param {object} col  column from the schema
 * @param {Record<string,string>} choiceIds  global choice name -> MetadataId
 */
export function buildColumn(col, choiceIds = {}) {
  const common = {
    SchemaName: col.schemaName,
    DisplayName: label(col.displayName),
    Description: label(col.description || ''),
    RequiredLevel: { Value: col.required ? 'ApplicationRequired' : 'None', CanBeChanged: true }
  };
  switch (col.type) {
    case 'String':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata',
        ...common,
        MaxLength: col.maxLength,
        FormatName: { Value: col.format === 'Url' ? 'Url' : 'Text' }
      };
    case 'Memo':
      return { '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata', ...common, MaxLength: col.maxLength, Format: 'TextArea' };
    case 'Integer':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata',
        ...common,
        Format: 'None',
        MinValue: col.min ?? -2147483648,
        MaxValue: col.max ?? 2147483647
      };
    case 'DateTime':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata',
        ...common,
        Format: 'DateAndTime',
        DateTimeBehavior: { Value: 'UserLocal' }
      };
    case 'Boolean':
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.BooleanAttributeMetadata',
        ...common,
        DefaultValue: col.default ?? false,
        OptionSet: {
          '@odata.type': 'Microsoft.Dynamics.CRM.BooleanOptionSetMetadata',
          TrueOption: { Value: 1, Label: label('Yes') },
          FalseOption: { Value: 0, Label: label('No') },
          OptionSetType: 'Boolean'
        }
      };
    case 'Choice': {
      const id = choiceIds[col.globalChoice];
      if (!id) throw new Error(`Global choice ${col.globalChoice} has no MetadataId yet`);
      return {
        '@odata.type': 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata',
        ...common,
        'GlobalOptionSet@odata.bind': `/GlobalOptionSetDefinitions(${id})`
      };
    }
    default:
      throw new Error(`Unsupported column type ${col.type} on ${col.schemaName}`);
  }
}

export function buildEnvironmentVariable(ev, parentIds = {}) {
  const body = {
    schemaname: ev.schemaName,
    displayname: ev.displayName,
    description: ev.description,
    type: ENV_VAR_TYPES[ev.type]
  };
  if (ev.type === 'DataSource') {
    body.apiid = `/providers/Microsoft.PowerApps/apis/${ev.connector}`;
    body.parameterkey = ev.parameter;
    if (ev.parentParameter) {
      const pid = parentIds[ev.parentParameter];
      if (!pid) throw new Error(`Parent environment variable ${ev.parentParameter} must be created before ${ev.schemaName}`);
      body['ParentDefinitionId@odata.bind'] = `/environmentvariabledefinitions(${pid})`;
    }
  } else if (ev.default !== undefined) {
    body.defaultvalue = String(ev.default);
  }
  return body;
}

/**
 * Replaces {{flow:Flow Name}} placeholders in a flow definition with workflow ids,
 * so child-flow calls point at the flows created in this environment.
 */
export function resolveFlowPlaceholders(clientdataText, flowIds) {
  return clientdataText.replace(/\{\{flow:([^}]+)\}\}/g, (_, name) => {
    const id = flowIds[name.trim()];
    if (!id) throw new Error(`Flow "${name}" is referenced but has not been created yet`);
    return id;
  });
}

/** Orders flows so every child flow is created before the flows that call it. */
export function orderFlows(flows) {
  const byName = new Map(flows.map((f) => [f.name, f]));
  const deps = (f) => [...JSON.stringify(f.clientdata).matchAll(/\{\{flow:([^}]+)\}\}/g)].map((m) => m[1].trim());
  const ordered = [];
  const state = new Map();
  const visit = (f) => {
    if (state.get(f.name) === 'done') return;
    if (state.get(f.name) === 'visiting') throw new Error(`Circular child-flow reference at ${f.name}`);
    state.set(f.name, 'visiting');
    for (const d of deps(f)) {
      const child = byName.get(d);
      if (!child) throw new Error(`${f.name} calls unknown flow "${d}"`);
      visit(child);
    }
    state.set(f.name, 'done');
    ordered.push(f);
  };
  flows.forEach(visit);
  return ordered;
}

// ---------------------------------------------------------------------------
// Steps (talk to Dataverse)
// ---------------------------------------------------------------------------

export async function ensurePublisher(c, schema) {
  const p = schema.publisher;
  const found = await c.get(`publishers?$select=publisherid&$filter=uniquename eq '${odataString(p.uniqueName)}'`);
  if (found.value.length) { c.log(`✓ publisher ${p.uniqueName}`); return found.value[0].publisherid; }
  const r = await c.post('publishers', {
    uniquename: p.uniqueName,
    friendlyname: p.friendlyName,
    customizationprefix: p.customizationPrefix,
    customizationoptionvalueprefix: p.customizationOptionValuePrefix,
    description: p.description
  });
  c.log(`+ publisher ${p.uniqueName}`);
  return r.entityId;
}

export async function ensureSolution(c, schema, publisherId) {
  const s = schema.solution;
  const found = await c.get(`solutions?$select=solutionid&$filter=uniquename eq '${odataString(s.uniqueName)}'`);
  if (found.value.length) { c.log(`✓ solution ${s.uniqueName}`); return found.value[0].solutionid; }
  const r = await c.post('solutions', {
    uniquename: s.uniqueName,
    friendlyname: s.friendlyName,
    description: s.description,
    version: `${schema.version}.0`,
    'publisherid@odata.bind': `/publishers(${publisherId})`
  });
  c.log(`+ solution ${s.uniqueName}`);
  return r.entityId;
}

export async function addToSolution(c, schema, componentId, componentType) {
  try {
    await c.post('AddSolutionComponent', {
      ComponentId: componentId,
      ComponentType: componentType,
      SolutionUniqueName: schema.solution.uniqueName,
      AddRequiredComponents: false
    });
  } catch (e) {
    // Already in the solution, or the header already added it. Not fatal.
    c.log(`  (AddSolutionComponent skipped: ${e.message.slice(0, 120)})`);
  }
}

export async function ensureGlobalChoices(c, schema) {
  const ids = {};
  for (const gc of schema.globalChoices) {
    let found = await c.tryGet(`GlobalOptionSetDefinitions(Name='${gc.schemaName}')?$select=MetadataId`);
    if (!found) {
      await c.post('GlobalOptionSetDefinitions', buildGlobalChoice(schema, gc));
      found = await c.get(`GlobalOptionSetDefinitions(Name='${gc.schemaName}')?$select=MetadataId`);
      c.log(`+ choice ${gc.schemaName}`);
    } else {
      c.log(`✓ choice ${gc.schemaName}`);
    }
    ids[gc.schemaName] = found.MetadataId;
  }
  return ids;
}

export async function ensureTables(c, schema, choiceIds) {
  for (const t of schema.tables) {
    const found = await c.tryGet(`EntityDefinitions(LogicalName='${t.logicalName}')?$select=MetadataId`);
    if (!found) {
      await c.post('EntityDefinitions', buildTable(t));
      c.log(`+ table ${t.logicalName}`);
    } else {
      c.log(`✓ table ${t.logicalName}`);
    }
    for (const col of t.columns) {
      const logical = col.schemaName.toLowerCase();
      const exists = await c.tryGet(`EntityDefinitions(LogicalName='${t.logicalName}')/Attributes(LogicalName='${logical}')?$select=LogicalName`);
      if (exists) { c.log(`  ✓ ${logical}`); continue; }
      await c.post(`EntityDefinitions(LogicalName='${t.logicalName}')/Attributes`, buildColumn(col, choiceIds));
      c.log(`  + ${logical}`);
    }
  }
}

export async function publish(c, schema) {
  const entities = schema.tables.map((t) => `<entity>${t.logicalName}</entity>`).join('');
  const optionsets = schema.globalChoices.map((g) => `<optionset>${g.schemaName}</optionset>`).join('');
  await c.post('PublishXml', { ParameterXml: `<importexportxml><entities>${entities}</entities><optionsets>${optionsets}</optionsets></importexportxml>` });
  c.log('✓ published tables and choices');
}

export async function ensureEnvironmentVariables(c, schema) {
  const ids = {};
  for (const ev of schema.environmentVariables) {
    const found = await c.get(`environmentvariabledefinitions?$select=environmentvariabledefinitionid&$filter=schemaname eq '${ev.schemaName}'`);
    if (found.value.length) {
      ids[ev.schemaName] = found.value[0].environmentvariabledefinitionid;
      c.log(`✓ env var ${ev.schemaName}`);
      continue;
    }
    const r = await c.post('environmentvariabledefinitions', buildEnvironmentVariable(ev, ids));
    ids[ev.schemaName] = r.entityId;
    await addToSolution(c, schema, r.entityId, COMPONENT_TYPES.EnvironmentVariableDefinition);
    c.log(`+ env var ${ev.schemaName}`);
  }
  return ids;
}

/** Sets the current value of an environment variable in this environment. */
export async function setEnvironmentVariableValue(c, schemaName, value) {
  const def = await c.get(`environmentvariabledefinitions?$select=environmentvariabledefinitionid&$filter=schemaname eq '${schemaName}'&$expand=environmentvariabledefinition_environmentvariablevalue($select=environmentvariablevalueid)`);
  if (!def.value.length) throw new Error(`Environment variable ${schemaName} not found`);
  const d = def.value[0];
  const existing = d.environmentvariabledefinition_environmentvariablevalue?.[0];
  if (existing) {
    await c.patch(`environmentvariablevalues(${existing.environmentvariablevalueid})`, { value: String(value) });
  } else {
    await c.post('environmentvariablevalues', {
      schemaname: `${schemaName}_value`,
      value: String(value),
      'EnvironmentVariableDefinitionId@odata.bind': `/environmentvariabledefinitions(${d.environmentvariabledefinitionid})`
    });
  }
  c.log(`✓ ${schemaName} = ${value}`);
}

export async function ensureConnectionReferences(c, schema) {
  const ids = {};
  for (const cr of schema.connectionReferences) {
    const found = await c.get(`connectionreferences?$select=connectionreferenceid&$filter=connectionreferencelogicalname eq '${cr.logicalName}'`);
    if (found.value.length) { ids[cr.logicalName] = found.value[0].connectionreferenceid; c.log(`✓ connection reference ${cr.logicalName}`); continue; }
    const r = await c.post('connectionreferences', {
      connectionreferencelogicalname: cr.logicalName,
      connectionreferencedisplayname: cr.displayName,
      connectorid: cr.connectorId,
      description: `Used by the PPLF flows (${cr.displayName}).`
    });
    ids[cr.logicalName] = r.entityId;
    c.log(`+ connection reference ${cr.logicalName}`);
  }
  return ids;
}

/** Binds connection references to existing connections, e.g. { pplf_sharedsharepointonline: 'shared-sharepointonl-...'}. */
export async function bindConnections(c, bindings) {
  for (const [logicalName, connectionId] of Object.entries(bindings)) {
    const found = await c.get(`connectionreferences?$select=connectionreferenceid&$filter=connectionreferencelogicalname eq '${logicalName}'`);
    if (!found.value.length) throw new Error(`Connection reference ${logicalName} not found`);
    await c.patch(`connectionreferences(${found.value[0].connectionreferenceid})`, { connectionid: connectionId });
    c.log(`✓ ${logicalName} -> ${connectionId}`);
  }
}

export async function ensureSecurityRoles(c, schema) {
  const who = await c.get('WhoAmI');
  const bu = who.BusinessUnitId;
  for (const role of schema.securityRoles) {
    let roleId;
    const found = await c.get(`roles?$select=roleid&$filter=name eq '${odataString(role.name)}' and _businessunitid_value eq ${bu}`);
    if (found.value.length) {
      roleId = found.value[0].roleid;
      c.log(`✓ role ${role.name}`);
    } else {
      const r = await c.post('roles', { name: role.name, description: role.description, 'businessunitid@odata.bind': `/businessunits(${bu})` });
      roleId = r.entityId;
      await addToSolution(c, schema, roleId, COMPONENT_TYPES.Role);
      c.log(`+ role ${role.name}`);
    }
    const privileges = [];
    for (const p of role.privileges) {
      for (const right of p.rights) {
        const name = `prv${right}${p.table}`;
        const priv = await c.get(`privileges?$select=privilegeid&$filter=name eq '${name}'`);
        if (!priv.value.length) throw new Error(`Privilege ${name} not found. Publish the tables first.`);
        privileges.push({ '@odata.type': 'Microsoft.Dynamics.CRM.RolePrivilege', PrivilegeId: priv.value[0].privilegeid, Depth: p.depth, BusinessUnitId: bu });
      }
    }
    await c.post(`roles(${roleId})/Microsoft.Dynamics.CRM.AddPrivilegesRole`, { Privileges: privileges });
    c.log(`  ✓ ${privileges.length} privileges`);
  }
}

/**
 * Creates (or updates) cloud flows. Each flow file is
 * { name, description, clientdata: { properties: {...}, schemaVersion } }.
 * Flows are created off; activate them after binding connection references.
 */
export async function ensureFlows(c, schema, flows, { update = true } = {}) {
  const ids = {};
  for (const f of orderFlows(flows)) {
    const text = resolveFlowPlaceholders(JSON.stringify(f.clientdata), ids);
    const found = await c.get(`workflows?$select=workflowid,statecode&$filter=name eq '${odataString(f.name)}' and category eq 5`);
    if (found.value.length) {
      const id = found.value[0].workflowid;
      ids[f.name] = id;
      if (update) {
        if (found.value[0].statecode === 1) await c.patch(`workflows(${id})`, { statecode: 0, statuscode: 1 });
        await c.patch(`workflows(${id})`, { clientdata: text, description: f.description });
        c.log(`~ flow ${f.name} (updated)`);
      } else {
        c.log(`✓ flow ${f.name}`);
      }
      continue;
    }
    const r = await c.post('workflows', {
      category: 5,
      name: f.name,
      type: 1,
      primaryentity: 'none',
      description: f.description,
      clientdata: text
    });
    ids[f.name] = r.entityId;
    await addToSolution(c, schema, r.entityId, COMPONENT_TYPES.Workflow);
    c.log(`+ flow ${f.name}`);
  }
  return ids;
}

/** Turns flows on, children first. Returns the names that failed. */
export async function activateFlows(c, flows) {
  const failed = [];
  for (const f of orderFlows(flows)) {
    const found = await c.get(`workflows?$select=workflowid,statecode&$filter=name eq '${odataString(f.name)}' and category eq 5`);
    if (!found.value.length) continue;
    if (found.value[0].statecode === 1) { c.log(`✓ on: ${f.name}`); continue; }
    try {
      await c.patch(`workflows(${found.value[0].workflowid})`, { statecode: 1, statuscode: 2 });
      c.log(`✓ turned on: ${f.name}`);
    } catch (e) {
      failed.push(f.name);
      c.log(`✗ could not turn on ${f.name}: ${e.message}`);
    }
  }
  return failed;
}

/** Creates the default * config row if the table is empty. */
export async function seedConfig(c) {
  const rows = await c.get(`pplf_logconfigs?$select=pplf_logconfigid&$filter=pplf_name eq '*'`);
  if (rows.value.length) { c.log('✓ default config row'); return; }
  await c.post('pplf_logconfigs', {
    pplf_name: '*',
    pplf_minimumlevel: 917000002,
    pplf_minimumseverity: 2,
    pplf_enabled: true,
    pplf_retentiondays: 30,
    pplf_notes: 'Default settings for every source without its own row.'
  });
  c.log('+ default config row (*)');
}

/** Full deployment. Safe to run repeatedly. */
export async function deploy({ client, schema, flows = [], seed = true, skipRoles = false }) {
  const c = client;
  c.log(`Deploying ${schema.solution.friendlyName} ${schema.version} to ${c.base}`);
  const publisherId = await ensurePublisher(c, schema);
  await ensureSolution(c, schema, publisherId);
  const choiceIds = await ensureGlobalChoices(c, schema);
  await ensureTables(c, schema, choiceIds);
  await publish(c, schema);
  await ensureEnvironmentVariables(c, schema);
  await ensureConnectionReferences(c, schema);
  if (!skipRoles) await ensureSecurityRoles(c, schema);
  if (flows.length) await ensureFlows(c, schema, flows);
  if (seed) await seedConfig(c);
  c.log('Done. Next: bind connection references, then activate flows (see docs/getting-started.md).');
}
