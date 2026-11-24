#!/usr/bin/env node
// PPLF deployer command line.
//
//   export PPLF_TOKEN=$(az account get-access-token --resource https://org.crm.dynamics.com --query accessToken -o tsv)
//   node tools/deployer/cli.mjs deploy --env https://org.crm.dynamics.com
//   node tools/deployer/cli.mjs set-target --env https://org.crm.dynamics.com --target SharePoint
//   node tools/deployer/cli.mjs activate --env https://org.crm.dynamics.com
//
// Any command accepts --dry-run to print what it would send without calling Dataverse.

import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as D from './pplf-deployer.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const opts = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith('--')) opts[key] = true;
    else { opts[key] = next; i++; }
  }
  return { command, opts };
}

export async function loadSchema() {
  return JSON.parse(await readFile(path.join(root, 'schema', 'pplf.schema.json'), 'utf8'));
}

export async function loadFlows() {
  const dir = path.join(root, 'src', 'flows');
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), 'utf8'))));
}

function dryRunFetch(log) {
  return async (url, init) => {
    const method = init.method;
    log(`[dry-run] ${method} ${url.replace(/^.*\/api\/data\/v9\.2\//, '')}`);
    const isPriv = method === 'GET' && url.includes('/privileges?');
    const empty = isPriv ? { value: [{ privilegeid: '00000000-0000-0000-0000-000000000000' }] } : method === 'GET' ? { value: [], MetadataId: '00000000-0000-0000-0000-000000000000', BusinessUnitId: '00000000-0000-0000-0000-000000000000' } : null;
    return {
      ok: true,
      status: method === 'GET' ? 200 : 204,
      headers: { get: () => '(00000000-0000-0000-0000-000000000000)' },
      text: async () => (empty ? JSON.stringify(empty) : '')
    };
  };
}

async function main() {
  const { command, opts } = parseArgs(process.argv.slice(2));
  if (command === 'help' || !opts.env) {
    console.log(`Usage: node tools/deployer/cli.mjs <deploy|activate|set-target|bind> --env <url> [options]

  deploy       Create publisher, solution, choices, tables, env vars, connection references,
               security roles and flows. Idempotent.
                 --no-flows   skip flows      --no-roles   skip security roles
  activate     Turn on all PPLF flows (bind connection references first)
  set-target   --target Dataverse|SharePoint|Both
  bind         --dataverse <connId> --sharepoint <connId> --outlook <connId>

  Auth: set PPLF_TOKEN to a Dataverse access token, e.g.
        az account get-access-token --resource <env url> --query accessToken -o tsv
  --dry-run    print requests, call nothing`);
    process.exit(command === 'help' ? 0 : 1);
  }

  const token = process.env.PPLF_TOKEN;
  if (!token && !opts['dry-run']) throw new Error('Set PPLF_TOKEN (see --help).');
  const schema = await loadSchema();
  const client = D.createClient({
    envUrl: opts.env,
    token,
    solution: schema.solution.uniqueName,
    fetchImpl: opts['dry-run'] ? dryRunFetch(console.log) : undefined
  });

  switch (command) {
    case 'deploy': {
      const flows = opts['no-flows'] ? [] : await loadFlows();
      await D.deploy({ client, schema, flows, skipRoles: !!opts['no-roles'] });
      break;
    }
    case 'activate': {
      const failed = await D.activateFlows(client, await loadFlows());
      if (failed.length) process.exitCode = 2;
      break;
    }
    case 'set-target': {
      const allowed = schema.environmentVariables.find((e) => e.schemaName === 'pplf_LogTarget').allowed;
      if (!allowed.includes(opts.target)) throw new Error(`--target must be one of ${allowed.join(', ')}`);
      await D.setEnvironmentVariableValue(client, 'pplf_LogTarget', opts.target);
      break;
    }
    case 'bind': {
      const map = {};
      if (opts.dataverse) map.pplf_sharedcommondataserviceforapps = opts.dataverse;
      if (opts.sharepoint) map.pplf_sharedsharepointonline = opts.sharepoint;
      if (opts.outlook) map.pplf_sharedoffice365 = opts.outlook;
      await D.bindConnections(client, map);
      break;
    }
    default:
      throw new Error(`Unknown command ${command}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
