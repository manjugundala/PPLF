// Generates the PPLF cloud flow definitions (src/flows/*.json) from the schema.
//
// Why generated? Every writer maps the same wire format (schema/log-entry.schema.json)
// to Dataverse columns and SharePoint fields. Generating the flows from
// schema/pplf.schema.json keeps those mappings, the choice values and the
// environment variable names identical everywhere. Edit this file or the schema,
// then run `npm run build`.

const DV = 'shared_commondataserviceforapps';
const SP = 'shared_sharepointonline';
const OUTLOOK = 'shared_office365';

const CONN_REFS = {
  [DV]: 'pplf_sharedcommondataserviceforapps',
  [SP]: 'pplf_sharedsharepointonline',
  [OUTLOOK]: 'pplf_sharedoffice365'
};

/** Parameter name as Power Automate writes it for an environment variable. */
export function envParamName(schema, schemaName) {
  const ev = schema.environmentVariables.find((e) => e.schemaName === schemaName);
  if (!ev) throw new Error(`Unknown env var ${schemaName}`);
  return `${ev.displayName} (${ev.schemaName})`;
}

export const p = (schema, name) => `parameters('${envParamName(schema, name)}')`;

function envParams(schema, names) {
  const out = {
    $connections: { defaultValue: {}, type: 'Object' },
    $authentication: { defaultValue: {}, type: 'SecureObject' }
  };
  for (const n of names) {
    const ev = schema.environmentVariables.find((e) => e.schemaName === n);
    out[envParamName(schema, n)] = {
      defaultValue: ev.default ?? '',
      type: 'String',
      metadata: { schemaName: ev.schemaName, description: ev.description }
    };
  }
  return out;
}

function connectionReferences(apis) {
  const refs = {};
  for (const api of apis) {
    refs[api] = {
      runtimeSource: 'embedded',
      connection: { connectionReferenceLogicalName: CONN_REFS[api] },
      api: { name: api }
    };
  }
  return refs;
}

function flow({ name, description, apis = [], env = [], triggers, actions, schema }) {
  return {
    name,
    description,
    clientdata: {
      properties: {
        connectionReferences: connectionReferences(apis),
        definition: {
          $schema: 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
          contentVersion: '1.0.0.0',
          parameters: envParams(schema, env),
          triggers,
          actions,
          outputs: {}
        },
        templateName: ''
      },
      schemaVersion: '1.0.0.0'
    }
  };
}

function op(api, operationId, parameters, runAfter = {}) {
  return {
    type: 'OpenApiConnection',
    inputs: {
      host: { connectionName: api, operationId, apiId: `/providers/Microsoft.PowerApps/apis/${api}` },
      parameters,
      authentication: "@parameters('$authentication')"
    },
    runAfter
  };
}

function textInputSchema(fields, required) {
  const properties = {};
  for (const [key, title, description, type = 'string'] of fields) {
    properties[key] = {
      title,
      type,
      'x-ms-dynamically-added': true,
      description,
      'x-ms-content-hint': type === 'number' ? 'NUMBER' : 'TEXT'
    };
  }
  return { type: 'object', properties, required };
}

const LOGS_INPUT = textInputSchema([['text', 'LogsJson', 'JSON array of PPLF log entries (see schema/log-entry.schema.json)']], ['text']);

const childTrigger = (schema) => ({ manual: { type: 'Request', kind: 'Button', inputs: { schema } } });
const powerAppsTrigger = (schema) => ({ manual: { type: 'Request', kind: 'PowerAppV2', inputs: { schema } } });

function respond(body, runAfter, kind = 'PowerApp') {
  const properties = {};
  for (const k of Object.keys(body)) properties[k] = { title: k, 'x-ms-dynamically-added': true, type: 'string' };
  return {
    type: 'Response',
    kind,
    inputs: { statusCode: 200, body, schema: { type: 'object', properties } },
    runAfter
  };
}

function runChild(flowName, body, runAfter = {}) {
  return {
    type: 'Workflow',
    inputs: { host: { workflowReferenceName: `{{flow:${flowName}}}` }, body },
    runAfter
  };
}

export function severityMapJson(schema) {
  const m = Object.fromEntries(schema.levels.map((l) => [l.name, l.severity]));
  m.None = 99;
  return m;
}

export function sourceTypeMapJson(schema) {
  const gc = schema.globalChoices.find((g) => g.schemaName === 'pplf_sourcetype');
  return Object.fromEntries(gc.options.map((o) => [o.label, o.value]));
}

const maps = (schema) => ({
  Severity_Map: { type: 'Compose', inputs: severityMapJson(schema), runAfter: {} },
  SourceType_Map: { type: 'Compose', inputs: sourceTypeMapJson(schema), runAfter: {} }
});

const SEV = (expr) => `coalesce(outputs('Severity_Map')?[${expr}], 2)`;

// ---------------------------------------------------------------------------
// Flow: Log Router
// ---------------------------------------------------------------------------
export const ROUTER = 'PPLF - Log Router';
export const WRITER_DV = 'PPLF - Writer Dataverse';
export const WRITER_SP = 'PPLF - Writer SharePoint';
export const WRITE_LOG = 'PPLF - Write Log';

function router(schema) {
  const target = p(schema, 'pplf_LogTarget');
  const alertLevel = p(schema, 'pplf_AlertMinimumLevel');
  const recipients = p(schema, 'pplf_AlertRecipients');
  const passThrough = { text: "@{triggerBody()?['text']}" };
  return flow({
    schema,
    name: ROUTER,
    description: 'Child flow. Receives a JSON array of log entries and sends it to the writer(s) chosen by the PPLF Log Target environment variable. Sends an email alert for entries at or above PPLF Alert Minimum Level.',
    apis: [OUTLOOK],
    env: ['pplf_LogTarget', 'pplf_AlertMinimumLevel', 'pplf_AlertRecipients'],
    triggers: childTrigger(LOGS_INPUT),
    actions: {
      ...maps(schema),
      Entries: { type: 'Compose', inputs: "@json(triggerBody()?['text'])", runAfter: { Severity_Map: ['Succeeded'], SourceType_Map: ['Succeeded'] } },
      Route_by_target: {
        type: 'Switch',
        expression: `@${target}`,
        cases: {
          SharePoint: { case: 'SharePoint', actions: { Write_to_SharePoint: runChild(WRITER_SP, passThrough) } },
          Both: {
            case: 'Both',
            actions: {
              Write_to_Dataverse_both: runChild(WRITER_DV, passThrough),
              Write_to_SharePoint_both: runChild(WRITER_SP, passThrough)
            }
          }
        },
        default: { actions: { Write_to_Dataverse: runChild(WRITER_DV, passThrough) } },
        runAfter: { Entries: ['Succeeded'] }
      },
      Alert_entries: {
        type: 'Query',
        inputs: {
          from: "@outputs('Entries')",
          where: `@and(not(equals(${alertLevel}, 'None')), greaterOrEquals(${SEV("item()?['level']")}, ${SEV(alertLevel)}))`
        },
        runAfter: { Entries: ['Succeeded'] }
      },
      Send_alert_if_needed: {
        type: 'If',
        expression: { and: [{ greater: ["@length(body('Alert_entries'))", 0] }, { not: { equals: [`@trim(${recipients})`, ''] } }] },
        actions: {
          Alert_table: {
            type: 'Table',
            inputs: {
              from: "@body('Alert_entries')",
              format: 'HTML',
              columns: [
                { header: 'Level', value: "@item()?['level']" },
                { header: 'Source', value: "@item()?['sourceName']" },
                { header: 'Component', value: "@item()?['component']" },
                { header: 'Message', value: "@item()?['message']" },
                { header: 'Correlation Id', value: "@item()?['correlationId']" },
                { header: 'When (UTC)', value: "@coalesce(item()?['clientTimestamp'], utcNow())" }
              ]
            },
            runAfter: {}
          },
          Send_alert_email: op(OUTLOOK, 'SendEmailV2', {
            'emailMessage/To': `@${recipients}`,
            'emailMessage/Subject': `[PPLF] @{length(body('Alert_entries'))} alert(s) from @{first(body('Alert_entries'))?['sourceName']}`,
            'emailMessage/Body': "<p>The Power Platform Logging Framework recorded entries at or above the alert level.</p>@{body('Alert_table')}",
            'emailMessage/Importance': 'High'
          }, { Alert_table: ['Succeeded'] })
        },
        else: { actions: {} },
        runAfter: { Alert_entries: ['Succeeded'] }
      },
      Respond: respond({ accepted: "@{length(outputs('Entries'))}", target: `@{${target}}` }, { Route_by_target: ['Succeeded', 'Failed', 'Skipped'], Send_alert_if_needed: ['Succeeded', 'Failed', 'Skipped'] })
    }
  });
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------

function effectiveConfig(defaultSev, srcConfig, defConfig, enabledKey, sevKey) {
  // First matching source row, else the * row, else env var default.
  return `@if(greater(length(body('${srcConfig}')), 0), first(body('${srcConfig}')), if(greater(length(body('${defConfig}')), 0), first(body('${defConfig}')), json(concat('{"${enabledKey}":true,"${sevKey}":', string(${defaultSev}), '}'))))`;
}

const E = (k) => `items('For_each_entry')?['${k}']`;

function writerDataverse(schema) {
  const defaultSev = SEV(p(schema, 'pplf_DefaultMinimumLevel'));
  return flow({
    schema,
    name: WRITER_DV,
    description: 'Child flow. Writes a JSON array of log entries to the PPLF Log Dataverse table, applying the per-source minimum level from PPLF Log Configuration.',
    apis: [DV],
    env: ['pplf_DefaultMinimumLevel'],
    triggers: childTrigger(LOGS_INPUT),
    actions: {
      ...maps(schema),
      Written: { type: 'InitializeVariable', inputs: { variables: [{ name: 'Written', type: 'integer', value: 0 }] }, runAfter: {} },
      Entries: { type: 'Compose', inputs: "@json(triggerBody()?['text'])", runAfter: { Severity_Map: ['Succeeded'], SourceType_Map: ['Succeeded'], Written: ['Succeeded'] } },
      List_config: op(DV, 'ListRecords', {
        entityName: 'pplf_logconfigs',
        $select: 'pplf_name,pplf_minimumseverity,pplf_enabled',
        $filter: 'statecode eq 0'
      }, { Entries: ['Succeeded'] }),
      Default_config: {
        type: 'Query',
        inputs: { from: "@outputs('List_config')?['body/value']", where: "@equals(item()?['pplf_name'], '*')" },
        runAfter: { List_config: ['Succeeded'] }
      },
      For_each_entry: {
        type: 'Foreach',
        foreach: "@outputs('Entries')",
        runtimeConfiguration: { concurrency: { repetitions: 20 } },
        actions: {
          Source_config: {
            type: 'Query',
            inputs: { from: "@outputs('List_config')?['body/value']", where: `@equals(toLower(item()?['pplf_name']), toLower(${E('sourceName')}))` },
            runAfter: {}
          },
          Effective_config: {
            type: 'Compose',
            inputs: effectiveConfig(defaultSev, 'Source_config', 'Default_config', 'pplf_enabled', 'pplf_minimumseverity'),
            runAfter: { Source_config: ['Succeeded'] }
          },
          Should_write: {
            type: 'If',
            expression: {
              and: [
                { equals: ["@outputs('Effective_config')?['pplf_enabled']", true] },
                { greaterOrEquals: [`@${SEV(E('level'))}`, "@outputs('Effective_config')?['pplf_minimumseverity']"] }
              ]
            },
            actions: {
              Add_log_row: op(DV, 'CreateRecord', {
                entityName: 'pplf_logs',
                'item/pplf_name': `@take(coalesce(${E('message')}, '(no message)'), 200)`,
                'item/pplf_level': `@add(${schema.levels[0].value}, ${SEV(E('level'))})`,
                'item/pplf_severity': `@${SEV(E('level'))}`,
                'item/pplf_sourcetype': `@coalesce(outputs('SourceType_Map')?[${E('sourceType')}], ${sourceTypeMapJson(schema).Custom})`,
                'item/pplf_sourcename': `@take(${E('sourceName')}, 200)`,
                'item/pplf_component': `@take(coalesce(${E('component')}, ''), 200)`,
                'item/pplf_operation': `@take(coalesce(${E('operation')}, ''), 200)`,
                'item/pplf_message': `@take(coalesce(${E('message')}, '(no message)'), 4000)`,
                'item/pplf_details': `@take(coalesce(${E('details')}, ''), 100000)`,
                'item/pplf_correlationid': `@coalesce(${E('correlationId')}, '')`,
                'item/pplf_sessionid': `@coalesce(${E('sessionId')}, '')`,
                'item/pplf_userprincipalname': `@coalesce(${E('userPrincipalName')}, '')`,
                'item/pplf_environment': `@coalesce(${E('environment')}, workflow()?['tags']?['environmentName'])`,
                'item/pplf_appversion': `@coalesce(${E('appVersion')}, '')`,
                'item/pplf_runurl': `@coalesce(${E('runUrl')}, '')`,
                'item/pplf_durationms': `@${E('durationMs')}`,
                'item/pplf_errorcode': `@coalesce(${E('errorCode')}, '')`,
                'item/pplf_clienttimestamp': `@coalesce(${E('clientTimestamp')}, utcNow())`,
                'item/pplf_clientinfo': `@take(coalesce(${E('clientInfo')}, ''), 500)`
              }),
              Count_written: { type: 'IncrementVariable', inputs: { name: 'Written', value: 1 }, runAfter: { Add_log_row: ['Succeeded'] } }
            },
            else: { actions: {} },
            runAfter: { Effective_config: ['Succeeded'] }
          }
        },
        runAfter: { Default_config: ['Succeeded'] }
      },
      Respond: respond({ written: "@{variables('Written')}" }, { For_each_entry: ['Succeeded', 'Failed'] })
    }
  });
}

function writerSharePoint(schema) {
  const defaultSev = SEV(p(schema, 'pplf_DefaultMinimumLevel'));
  const site = `@${p(schema, 'pplf_SharePointSite')}`;
  return flow({
    schema,
    name: WRITER_SP,
    description: 'Child flow. Writes a JSON array of log entries to the PPLF Logs SharePoint list, applying the per-source minimum level from the PPLF Log Config list. Uses standard connectors only.',
    apis: [SP],
    env: ['pplf_DefaultMinimumLevel', 'pplf_SharePointSite', 'pplf_SharePointLogList', 'pplf_SharePointConfigList'],
    triggers: childTrigger(LOGS_INPUT),
    actions: {
      ...maps(schema),
      Written: { type: 'InitializeVariable', inputs: { variables: [{ name: 'Written', type: 'integer', value: 0 }] }, runAfter: {} },
      Entries: { type: 'Compose', inputs: "@json(triggerBody()?['text'])", runAfter: { Severity_Map: ['Succeeded'], SourceType_Map: ['Succeeded'], Written: ['Succeeded'] } },
      Get_config: op(SP, 'GetItems', {
        dataset: site,
        table: `@${p(schema, 'pplf_SharePointConfigList')}`,
        $top: 500
      }, { Entries: ['Succeeded'] }),
      Config_rows: {
        type: 'Select',
        inputs: {
          from: "@outputs('Get_config')?['body/value']",
          select: { name: "@item()?['Title']", enabled: "@item()?['PplfEnabled']", minSeverity: "@coalesce(item()?['PplfMinimumSeverity'], 2)" }
        },
        runAfter: { Get_config: ['Succeeded'] }
      },
      Default_config: {
        type: 'Query',
        inputs: { from: "@body('Config_rows')", where: "@equals(item()?['name'], '*')" },
        runAfter: { Config_rows: ['Succeeded'] }
      },
      For_each_entry: {
        type: 'Foreach',
        foreach: "@outputs('Entries')",
        runtimeConfiguration: { concurrency: { repetitions: 20 } },
        actions: {
          Source_config: {
            type: 'Query',
            inputs: { from: "@body('Config_rows')", where: `@equals(toLower(item()?['name']), toLower(${E('sourceName')}))` },
            runAfter: {}
          },
          Effective_config: {
            type: 'Compose',
            inputs: effectiveConfig(defaultSev, 'Source_config', 'Default_config', 'enabled', 'minSeverity'),
            runAfter: { Source_config: ['Succeeded'] }
          },
          Should_write: {
            type: 'If',
            expression: {
              and: [
                { equals: ["@outputs('Effective_config')?['enabled']", true] },
                { greaterOrEquals: [`@${SEV(E('level'))}`, "@int(outputs('Effective_config')?['minSeverity'])"] }
              ]
            },
            actions: {
              Add_log_item: op(SP, 'PostItem', {
                dataset: site,
                table: `@${p(schema, 'pplf_SharePointLogList')}`,
                'item/Title': `@take(coalesce(${E('message')}, '(no message)'), 200)`,
                'item/PplfLevel/Value': `@${E('level')}`,
                'item/PplfSeverity': `@${SEV(E('level'))}`,
                'item/PplfSourceType/Value': `@coalesce(${E('sourceType')}, 'Custom')`,
                'item/PplfSourceName': `@take(${E('sourceName')}, 200)`,
                'item/PplfComponent': `@take(coalesce(${E('component')}, ''), 200)`,
                'item/PplfOperation': `@take(coalesce(${E('operation')}, ''), 200)`,
                'item/PplfMessage': `@take(coalesce(${E('message')}, '(no message)'), 4000)`,
                'item/PplfDetails': `@take(coalesce(${E('details')}, ''), 60000)`,
                'item/PplfCorrelationId': `@coalesce(${E('correlationId')}, '')`,
                'item/PplfSessionId': `@coalesce(${E('sessionId')}, '')`,
                'item/PplfUser': `@coalesce(${E('userPrincipalName')}, '')`,
                'item/PplfEnvironment': `@coalesce(${E('environment')}, workflow()?['tags']?['environmentName'])`,
                'item/PplfAppVersion': `@coalesce(${E('appVersion')}, '')`,
                'item/PplfRunUrl': `@coalesce(${E('runUrl')}, '')`,
                'item/PplfDurationMs': `@${E('durationMs')}`,
                'item/PplfErrorCode': `@coalesce(${E('errorCode')}, '')`,
                'item/PplfClientTimestamp': `@coalesce(${E('clientTimestamp')}, utcNow())`,
                'item/PplfClientInfo': `@take(coalesce(${E('clientInfo')}, ''), 255)`
              }),
              Count_written: { type: 'IncrementVariable', inputs: { name: 'Written', value: 1 }, runAfter: { Add_log_item: ['Succeeded'] } }
            },
            else: { actions: {} },
            runAfter: { Effective_config: ['Succeeded'] }
          }
        },
        runAfter: { Default_config: ['Succeeded'] }
      },
      Respond: respond({ written: "@{variables('Written')}" }, { For_each_entry: ['Succeeded', 'Failed'] })
    }
  });
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

function writeLog(schema) {
  const input = textInputSchema([
    ['text', 'Level', 'Trace, Debug, Information, Warning, Error or Critical'],
    ['text_1', 'Message', 'What happened'],
    ['text_2', 'SourceName', 'Name of the calling flow, e.g. workflow()?[\'tags\']?[\'flowDisplayName\']'],
    ['text_3', 'Component', 'Step or scope name (optional)'],
    ['text_4', 'Operation', 'What was being attempted (optional)'],
    ['text_5', 'Details', 'JSON text with extra context (optional)'],
    ['text_6', 'CorrelationId', 'Pass through from the app that started the work (optional)'],
    ['text_7', 'RunUrl', 'Link to the calling run (optional)'],
    ['text_8', 'ErrorCode', 'Error code (optional)'],
    ['number', 'DurationMs', 'Duration in milliseconds (optional)', 'number']
  ], ['text', 'text_1', 'text_2']);
  return flow({
    schema,
    name: WRITE_LOG,
    description: 'Child flow for flow makers. Call it with "Run a Child Flow" to write one log entry with plain inputs. It routes through PPLF - Log Router.',
    triggers: childTrigger(input),
    actions: {
      Build_entry: {
        type: 'Compose',
        inputs: [{
          level: "@{triggerBody()?['text']}",
          message: "@{triggerBody()?['text_1']}",
          sourceName: "@{triggerBody()?['text_2']}",
          sourceType: 'Cloud Flow',
          component: "@{triggerBody()?['text_3']}",
          operation: "@{triggerBody()?['text_4']}",
          details: "@{triggerBody()?['text_5']}",
          correlationId: "@{coalesce(triggerBody()?['text_6'], guid())}",
          runUrl: "@{triggerBody()?['text_7']}",
          errorCode: "@{triggerBody()?['text_8']}",
          durationMs: "@if(empty(triggerBody()?['number']), null, int(triggerBody()?['number']))",
          clientTimestamp: '@{utcNow()}',
          clientInfo: 'Power Automate'
        }],
        runAfter: {}
      },
      Route: runChild(ROUTER, { text: "@{string(outputs('Build_entry'))}" }, { Build_entry: ['Succeeded'] }),
      Respond: respond({ accepted: "@{body('Route')?['accepted']}" }, { Route: ['Succeeded'] })
    }
  });
}

function fromPowerApps(schema) {
  return flow({
    schema,
    name: 'PPLF - Ingest from Power Apps',
    description: 'Called by canvas apps in Router mode: PPLFIngestfromPowerApps.Run(JSON(colPplfBuffer)). Target-agnostic: the Log Target environment variable decides where entries go.',
    triggers: powerAppsTrigger(LOGS_INPUT),
    actions: {
      Route: runChild(ROUTER, { text: "@{triggerBody()?['text']}" }),
      Respond: respond({ accepted: "@{body('Route')?['accepted']}" }, { Route: ['Succeeded'] })
    }
  });
}

function fromPowerPages(schema) {
  return flow({
    schema,
    name: 'PPLF - Ingest from Power Pages',
    description: 'Called by the PPLF Power Pages logger through the site cloud-flow API. Add it to the site under Set up > Cloud flows and secure it with a web role.',
    triggers: { manual: { type: 'Request', kind: 'PowerPages', inputs: { schema: LOGS_INPUT } } },
    actions: {
      Stamp_source_type: {
        type: 'Select',
        inputs: { from: "@json(triggerBody()?['text'])", select: "@setProperty(item(), 'sourceType', 'Power Pages')" },
        runAfter: {}
      },
      Route: runChild(ROUTER, { text: "@{string(body('Stamp_source_type'))}" }, { Stamp_source_type: ['Succeeded'] }),
      Respond: respond({ accepted: "@{body('Route')?['accepted']}" }, { Route: ['Succeeded'] }, 'PowerPages')
    }
  });
}

// ---------------------------------------------------------------------------
// SharePoint provisioning
// ---------------------------------------------------------------------------

export function spFieldXml(schema, col) {
  const sp = col.sp;
  const n = sp.internalName;
  const attrs = `Name="${n}" StaticName="${n}" DisplayName="${col.displayName}"${col.required ? ' Required="FALSE"' : ''}${sp.indexed ? ' Indexed="TRUE"' : ''}`;
  switch (sp.type) {
    case 'Text':
      return `<Field Type="Text" ${attrs} MaxLength="255" />`;
    case 'Note':
      return `<Field Type="Note" ${attrs} NumLines="6" RichText="FALSE" UnlimitedLengthInDocumentLibrary="TRUE" />`;
    case 'Number':
      return `<Field Type="Number" ${attrs} Decimals="0"${col.min !== undefined ? ` Min="${col.min}"` : ''}${col.max !== undefined && col.max < 2147483647 ? ` Max="${col.max}"` : ''} />`;
    case 'DateTime':
      return `<Field Type="DateTime" ${attrs} Format="DateTime" />`;
    case 'Boolean':
      return `<Field Type="Boolean" ${attrs}><Default>${col.default === false ? 0 : 1}</Default></Field>`;
    case 'Choice': {
      const gc = schema.globalChoices.find((g) => g.schemaName === col.globalChoice);
      const options = gc.fromLevels ? schema.levels.map((l) => l.name) : gc.options.map((o) => o.spChoice || o.label);
      return `<Field Type="Choice" ${attrs} Format="Dropdown"><CHOICES>${options.map((o) => `<CHOICE>${o}</CHOICE>`).join('')}</CHOICES></Field>`;
    }
    default:
      throw new Error(`Unsupported SharePoint type ${sp.type}`);
  }
}

export function spListDefinitions(schema) {
  return schema.tables.map((t) => ({
    key: t.logicalName,
    title: t.sharePointList.title,
    url: t.sharePointList.url,
    description: t.description,
    fields: t.columns.map((c) => ({ internalName: c.sp.internalName, schemaXml: spFieldXml(schema, c) }))
  }));
}

function provisionSharePoint(schema) {
  const input = textInputSchema([['text', 'SiteUrl', 'Absolute URL of the SharePoint site, e.g. https://contoso.sharepoint.com/sites/ops']], ['text']);
  const site = "@triggerBody()?['text']";
  const json = { Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=nometadata' };
  const L = (k) => `items('For_each_list')?['${k}']`;
  const spHttp = (method, uri, body, runAfter = {}, headers = json) => op(SP, 'HttpRequest', {
    dataset: site,
    'parameters/method': method,
    'parameters/uri': uri,
    'parameters/headers': headers,
    ...(body !== undefined ? { 'parameters/body': body } : {})
  }, runAfter);

  return flow({
    schema,
    name: 'PPLF - Provision SharePoint',
    description: 'Called by the PPLF Admin app setup wizard. Creates the PPLF Logs and PPLF Log Config lists, their columns and indexes on the given site, and adds the default * config row. Safe to run again.',
    apis: [SP],
    triggers: powerAppsTrigger(input),
    actions: {
      List_definitions: { type: 'Compose', inputs: spListDefinitions(schema), runAfter: {} },
      List_ids: { type: 'InitializeVariable', inputs: { variables: [{ name: 'ListIds', type: 'object', value: {} }] }, runAfter: { List_definitions: ['Succeeded'] } },
      For_each_list: {
        type: 'Foreach',
        foreach: "@outputs('List_definitions')",
        runtimeConfiguration: { concurrency: { repetitions: 1 } },
        actions: {
          Find_list: spHttp('GET', `_api/web/lists?$select=Id,Title&$filter=RootFolder/Name eq '@{${L('url')}}'`),
          Create_list_if_missing: {
            type: 'If',
            expression: { equals: ["@length(body('Find_list')?['value'])", 0] },
            actions: {
              Create_list: spHttp('POST', '_api/web/lists', { Title: `@{${L('url')}}`, Description: `@{${L('description')}}`, BaseTemplate: 100, AllowContentTypes: false }),
              Rename_list: spHttp('POST', `_api/web/lists(guid'@{body('Create_list')?['Id']}')`, { Title: `@{${L('title')}}` }, { Create_list: ['Succeeded'] }, { ...json, 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' })
            },
            else: { actions: {} },
            runAfter: { Find_list: ['Succeeded'] }
          },
          List_id: {
            type: 'Compose',
            inputs: "@if(equals(length(body('Find_list')?['value']), 0), body('Create_list')?['Id'], first(body('Find_list')?['value'])?['Id'])",
            runAfter: { Create_list_if_missing: ['Succeeded'] }
          },
          For_each_field: {
            type: 'Foreach',
            foreach: `@${L('fields')}`,
            runtimeConfiguration: { concurrency: { repetitions: 1 } },
            actions: {
              Find_field: spHttp('GET', "_api/web/lists(guid'@{outputs('List_id')}')/fields?$select=Id&$filter=InternalName eq '@{items('For_each_field')?['internalName']}'"),
              Create_field_if_missing: {
                type: 'If',
                expression: { equals: ["@length(body('Find_field')?['value'])", 0] },
                actions: {
                  Create_field: spHttp('POST', "_api/web/lists(guid'@{outputs('List_id')}')/fields/createfieldasxml", {
                    parameters: { SchemaXml: "@{items('For_each_field')?['schemaXml']}", Options: 24 }
                  })
                },
                else: { actions: {} },
                runAfter: { Find_field: ['Succeeded'] }
              }
            },
            runAfter: { List_id: ['Succeeded'] }
          },
          Index_Created: spHttp('POST', "_api/web/lists(guid'@{outputs('List_id')}')/fields/getbyinternalnameortitle('Created')", { Indexed: true }, { For_each_field: ['Succeeded'] }, { ...json, 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' }),
          Remember_list_id: {
            type: 'SetVariable',
            inputs: { name: 'ListIds', value: `@setProperty(variables('ListIds'), ${L('key')}, outputs('List_id'))` },
            runAfter: { Index_Created: ['Succeeded', 'Failed'] }
          }
        },
        runAfter: { List_ids: ['Succeeded'] }
      },
      Find_default_config: spHttp('GET', "_api/web/lists(guid'@{variables('ListIds')?['pplf_logconfig']}')/items?$select=Id&$filter=Title eq '*'", undefined, { For_each_list: ['Succeeded'] }),
      Seed_default_config: {
        type: 'If',
        expression: { equals: ["@length(body('Find_default_config')?['value'])", 0] },
        actions: {
          Add_default_config: spHttp('POST', "_api/web/lists(guid'@{variables('ListIds')?['pplf_logconfig']}')/items", {
            Title: '*', PplfMinimumLevel: 'Information', PplfMinimumSeverity: 2, PplfEnabled: true, PplfRetentionDays: 30,
            PplfNotes: 'Default settings for every source without its own row.'
          })
        },
        else: { actions: {} },
        runAfter: { Find_default_config: ['Succeeded'] }
      },
      Respond: respond({
        siteUrl: "@{triggerBody()?['text']}",
        logListId: "@{variables('ListIds')?['pplf_log']}",
        configListId: "@{variables('ListIds')?['pplf_logconfig']}"
      }, { Seed_default_config: ['Succeeded'] })
    }
  });
}

// ---------------------------------------------------------------------------
// Retention, forwarding, template
// ---------------------------------------------------------------------------

function retention(schema) {
  const target = p(schema, 'pplf_LogTarget');
  const defaultDays = `int(${p(schema, 'pplf_DefaultRetentionDays')})`;
  const site = `@${p(schema, 'pplf_SharePointSite')}`;
  const cutoff = (days) => `@{addDays(utcNow(), mul(-1, ${days}), 'yyyy-MM-ddTHH:mm:ssZ')}`;
  return flow({
    schema,
    name: 'PPLF - Retention Cleanup',
    description: 'Runs daily. Deletes log entries older than the retention period. The * row (or PPLF Default Retention Days) is the maximum age for all entries; a source row can set a shorter period for that source. Deletes up to 5,000 entries per store per rule per run.',
    apis: [DV, SP],
    env: ['pplf_LogTarget', 'pplf_DefaultRetentionDays', 'pplf_SharePointSite', 'pplf_SharePointLogList', 'pplf_SharePointConfigList'],
    triggers: { Daily: { type: 'Recurrence', recurrence: { frequency: 'Day', interval: 1, startTime: '2026-01-01T07:00:00Z' } } },
    actions: {
      Clean_Dataverse: {
        type: 'If',
        expression: { not: { equals: [`@${target}`, 'SharePoint'] } },
        actions: {
          DV_config: op(DV, 'ListRecords', { entityName: 'pplf_logconfigs', $select: 'pplf_name,pplf_retentiondays', $filter: 'statecode eq 0 and pplf_retentiondays ne null' }),
          DV_default_days: {
            type: 'Compose',
            inputs: `@coalesce(first(body('DV_default_row'))?['pplf_retentiondays'], ${defaultDays})`,
            runAfter: { DV_default_row: ['Succeeded'] }
          },
          DV_default_row: { type: 'Query', inputs: { from: "@outputs('DV_config')?['body/value']", where: "@equals(item()?['pplf_name'], '*')" }, runAfter: { DV_config: ['Succeeded'] } },
          DV_old_rows: op(DV, 'ListRecords', {
            entityName: 'pplf_logs', $select: 'pplf_logid', $top: 5000,
            $filter: `createdon lt ${cutoff("outputs('DV_default_days')")}`
          }, { DV_default_days: ['Succeeded'] }),
          DV_delete_old: {
            type: 'Foreach', foreach: "@outputs('DV_old_rows')?['body/value']", runtimeConfiguration: { concurrency: { repetitions: 50 } },
            actions: { DV_delete: op(DV, 'DeleteRecord', { entityName: 'pplf_logs', recordId: "@items('DV_delete_old')?['pplf_logid']" }) },
            runAfter: { DV_old_rows: ['Succeeded'] }
          },
          DV_per_source: {
            type: 'Foreach', foreach: "@outputs('DV_config')?['body/value']", runtimeConfiguration: { concurrency: { repetitions: 1 } },
            actions: {
              DV_is_source_row: {
                type: 'If',
                expression: { not: { equals: ["@items('DV_per_source')?['pplf_name']", '*'] } },
                actions: {
                  DV_source_rows: op(DV, 'ListRecords', {
                    entityName: 'pplf_logs', $select: 'pplf_logid', $top: 5000,
                    $filter: `pplf_sourcename eq '@{replace(items('DV_per_source')?['pplf_name'], '''', '''''')}' and createdon lt ${cutoff("items('DV_per_source')?['pplf_retentiondays']")}`
                  }),
                  DV_delete_source: {
                    type: 'Foreach', foreach: "@outputs('DV_source_rows')?['body/value']", runtimeConfiguration: { concurrency: { repetitions: 50 } },
                    actions: { DV_delete_s: op(DV, 'DeleteRecord', { entityName: 'pplf_logs', recordId: "@items('DV_delete_source')?['pplf_logid']" }) },
                    runAfter: { DV_source_rows: ['Succeeded'] }
                  }
                },
                else: { actions: {} },
                runAfter: {}
              }
            },
            runAfter: { DV_delete_old: ['Succeeded', 'Failed'] }
          }
        },
        else: { actions: {} },
        runAfter: {}
      },
      Clean_SharePoint: {
        type: 'If',
        expression: { not: { equals: [`@${target}`, 'Dataverse'] } },
        actions: {
          SP_config: op(SP, 'GetItems', { dataset: site, table: `@${p(schema, 'pplf_SharePointConfigList')}`, $top: 500 }),
          SP_default_row: { type: 'Query', inputs: { from: "@outputs('SP_config')?['body/value']", where: "@equals(item()?['Title'], '*')" }, runAfter: { SP_config: ['Succeeded'] } },
          SP_default_days: { type: 'Compose', inputs: `@coalesce(first(body('SP_default_row'))?['PplfRetentionDays'], ${defaultDays})`, runAfter: { SP_default_row: ['Succeeded'] } },
          SP_old_items: op(SP, 'GetItems', {
            dataset: site, table: `@${p(schema, 'pplf_SharePointLogList')}`, $top: 5000,
            $filter: `Created lt '${cutoff("outputs('SP_default_days')")}'`
          }, { SP_default_days: ['Succeeded'] }),
          SP_delete_old: {
            type: 'Foreach', foreach: "@outputs('SP_old_items')?['body/value']", runtimeConfiguration: { concurrency: { repetitions: 20 } },
            actions: { SP_delete: op(SP, 'DeleteItem', { dataset: site, table: `@${p(schema, 'pplf_SharePointLogList')}`, id: "@items('SP_delete_old')?['ID']" }) },
            runAfter: { SP_old_items: ['Succeeded'] }
          },
          SP_per_source: {
            type: 'Foreach', foreach: "@outputs('SP_config')?['body/value']", runtimeConfiguration: { concurrency: { repetitions: 1 } },
            actions: {
              SP_is_source_row: {
                type: 'If',
                expression: { and: [{ not: { equals: ["@items('SP_per_source')?['Title']", '*'] } }, { not: { equals: ["@items('SP_per_source')?['PplfRetentionDays']", null] } }] },
                actions: {
                  SP_source_items: op(SP, 'GetItems', {
                    dataset: site, table: `@${p(schema, 'pplf_SharePointLogList')}`, $top: 5000,
                    $filter: `PplfSourceName eq '@{replace(items('SP_per_source')?['Title'], '''', '''''')}' and Created lt '${cutoff("items('SP_per_source')?['PplfRetentionDays']")}'`
                  }),
                  SP_delete_source: {
                    type: 'Foreach', foreach: "@outputs('SP_source_items')?['body/value']", runtimeConfiguration: { concurrency: { repetitions: 20 } },
                    actions: { SP_delete_s: op(SP, 'DeleteItem', { dataset: site, table: `@${p(schema, 'pplf_SharePointLogList')}`, id: "@items('SP_delete_source')?['ID']" }) },
                    runAfter: { SP_source_items: ['Succeeded'] }
                  }
                },
                else: { actions: {} },
                runAfter: {}
              }
            },
            runAfter: { SP_delete_old: ['Succeeded', 'Failed'] }
          }
        },
        else: { actions: {} },
        runAfter: {}
      }
    }
  });
}

function forwardToSharePoint(schema) {
  const site = `@${p(schema, 'pplf_SharePointSite')}`;
  const T = (k) => `triggerOutputs()?['body/${k}']`;
  return flow({
    schema,
    name: 'PPLF - Forward Dataverse Logs to SharePoint',
    description: 'When Log Target is SharePoint, entries that pro-code sources (plug-ins, model-driven JavaScript, Custom API) write straight to the PPLF Log table are copied to the SharePoint list and removed from Dataverse.',
    apis: [DV, SP],
    env: ['pplf_LogTarget', 'pplf_SharePointSite', 'pplf_SharePointLogList'],
    triggers: {
      When_a_log_row_is_added: {
        type: 'OpenApiConnectionWebhook',
        inputs: {
          host: { connectionName: DV, operationId: 'SubscribeWebhookTrigger', apiId: `/providers/Microsoft.PowerApps/apis/${DV}` },
          parameters: { 'subscriptionRequest/message': 1, 'subscriptionRequest/entityname': 'pplf_log', 'subscriptionRequest/scope': 4 },
          authentication: "@parameters('$authentication')"
        },
        conditions: [{ expression: `@equals(${p(schema, 'pplf_LogTarget')}, 'SharePoint')` }]
      }
    },
    actions: {
      Severity_Names: { type: 'Compose', inputs: schema.levels.map((l) => l.name), runAfter: {} },
      Copy_to_SharePoint: op(SP, 'PostItem', {
        dataset: site,
        table: `@${p(schema, 'pplf_SharePointLogList')}`,
        'item/Title': `@${T('pplf_name')}`,
        'item/PplfLevel/Value': `@outputs('Severity_Names')[${T('pplf_severity')}]`,
        'item/PplfSeverity': `@${T('pplf_severity')}`,
        'item/PplfSourceType/Value': `@coalesce(triggerOutputs()?['body/_pplf_sourcetype_label'], 'Custom')`,
        'item/PplfSourceName': `@${T('pplf_sourcename')}`,
        'item/PplfComponent': `@${T('pplf_component')}`,
        'item/PplfOperation': `@${T('pplf_operation')}`,
        'item/PplfMessage': `@${T('pplf_message')}`,
        'item/PplfDetails': `@take(coalesce(${T('pplf_details')}, ''), 60000)`,
        'item/PplfCorrelationId': `@${T('pplf_correlationid')}`,
        'item/PplfSessionId': `@${T('pplf_sessionid')}`,
        'item/PplfUser': `@${T('pplf_userprincipalname')}`,
        'item/PplfEnvironment': `@${T('pplf_environment')}`,
        'item/PplfAppVersion': `@${T('pplf_appversion')}`,
        'item/PplfRunUrl': `@${T('pplf_runurl')}`,
        'item/PplfDurationMs': `@${T('pplf_durationms')}`,
        'item/PplfErrorCode': `@${T('pplf_errorcode')}`,
        'item/PplfClientTimestamp': `@coalesce(${T('pplf_clienttimestamp')}, ${T('createdon')})`,
        'item/PplfClientInfo': `@take(coalesce(${T('pplf_clientinfo')}, ''), 255)`
      }, { Severity_Names: ['Succeeded'] }),
      Remove_from_Dataverse: op(DV, 'DeleteRecord', { entityName: 'pplf_logs', recordId: `@${T('pplf_logid')}` }, { Copy_to_SharePoint: ['Succeeded'] })
    }
  });
}

function tryCatchTemplate(schema) {
  const runUrl = "@{concat('https://make.powerautomate.com/environments/', workflow()?['tags']?['environmentName'], '/flows/', workflow()?['name'], '/runs/', workflow()?['run']?['name'])}";
  const logInputs = (level, message, component, details, extra = {}) => ({
    text: level,
    text_1: message,
    text_2: "@{workflow()?['tags']?['flowDisplayName']}",
    text_3: component,
    text_5: details,
    text_6: "@{variables('CorrelationId')}",
    text_7: runUrl,
    ...extra
  });
  return flow({
    schema,
    name: 'PPLF - Template Try Catch',
    description: 'Copy this flow to start a new one with PPLF logging built in: Try / Catch / Finally scopes, a correlation id, failure details and a run link.',
    triggers: { manual: { type: 'Request', kind: 'Button', inputs: { schema: textInputSchema([['text', 'CorrelationId', 'Optional. Pass one in to tie this run to the app action that started it.']], []) } } },
    actions: {
      CorrelationId: { type: 'InitializeVariable', inputs: { variables: [{ name: 'CorrelationId', type: 'string', value: "@{coalesce(triggerBody()?['text'], guid())}" }] }, runAfter: {} },
      Started: { type: 'InitializeVariable', inputs: { variables: [{ name: 'Started', type: 'string', value: '@{utcNow()}' }] }, runAfter: { CorrelationId: ['Succeeded'] } },
      Try: {
        type: 'Scope',
        actions: {
          Your_steps_go_here: { type: 'Compose', inputs: 'Replace this with the real work.', runAfter: {} }
        },
        runAfter: { Started: ['Succeeded'] }
      },
      Catch: {
        type: 'Scope',
        actions: {
          Failed_actions: {
            type: 'Query',
            inputs: { from: "@result('Try')", where: "@contains(createArray('Failed', 'TimedOut'), item()?['status'])" },
            runAfter: {}
          },
          Log_error: runChild(WRITE_LOG, logInputs(
            'Error',
            "@{coalesce(first(body('Failed_actions'))?['error']?['message'], first(body('Failed_actions'))?['outputs']?['body']?['error']?['message'], 'A step in Try failed')}",
            "@{first(body('Failed_actions'))?['name']}",
            "@{string(body('Failed_actions'))}",
            { text_8: "@{first(body('Failed_actions'))?['code']}" }
          ), { Failed_actions: ['Succeeded'] }),
          Fail_the_run: {
            type: 'Terminate',
            inputs: { runStatus: 'Failed', runError: { code: 'PPLF_TRY_FAILED', message: "@{first(body('Failed_actions'))?['name']} failed. See the PPLF log for details." } },
            runAfter: { Log_error: ['Succeeded', 'Failed'] }
          }
        },
        runAfter: { Try: ['Failed', 'TimedOut'] }
      },
      Finally: {
        type: 'Scope',
        actions: {
          Log_completed: runChild(WRITE_LOG, logInputs('Information', 'Run completed', 'Finally', ''), {})
        },
        runAfter: { Try: ['Succeeded'] }
      }
    }
  });
}

export function buildFlows(schema) {
  return [
    writerDataverse(schema),
    writerSharePoint(schema),
    router(schema),
    writeLog(schema),
    fromPowerApps(schema),
    fromPowerPages(schema),
    provisionSharePoint(schema),
    retention(schema),
    forwardToSharePoint(schema),
    tryCatchTemplate(schema)
  ];
}

export function flowFileName(name) {
  return name.replace(/^PPLF - /, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '.json';
}
