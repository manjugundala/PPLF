#!/usr/bin/env node
// Provision the PPLF SharePoint lists from the command line.
//   PPLF_SP_TOKEN=<token> node tools/sharepoint/cli.mjs --site https://tenant.sharepoint.com/sites/ops
// Get a token with:  az account get-access-token --resource https://tenant.sharepoint.com --query accessToken -o tsv
// (SharePoint app-only tokens need a certificate; a delegated user token is easiest.)

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { provisionLists } from './pplf-sharepoint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const i = process.argv.indexOf('--site');
const siteUrl = i > -1 ? process.argv[i + 1] : null;
if (!siteUrl) { console.log('Usage: node tools/sharepoint/cli.mjs --site <site url>'); process.exit(1); }
if (!process.env.PPLF_SP_TOKEN) { console.error('Set PPLF_SP_TOKEN'); process.exit(1); }

const { lists } = JSON.parse(await readFile(path.join(root, 'src', 'sharepoint', 'lists.json'), 'utf8'));
await provisionLists({ siteUrl, lists, token: process.env.PPLF_SP_TOKEN }).catch((e) => { console.error(e.message); process.exit(1); });
