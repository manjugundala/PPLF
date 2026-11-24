#!/usr/bin/env python3
"""Checks every *.pa.yaml file in the repo:
  * parses as YAML
  * every property value is a Power Fx formula (starts with '=')
  * control names are unique across the app folder
Exit code 1 on any problem. Used by CI."""
import glob, os, sys
import yaml

problems = []

def walk_controls(children, names, path):
    for child in children or []:
        for name, ctrl in child.items():
            names.append((name, path))
            for k, v in (ctrl.get('Properties') or {}).items():
                if not isinstance(v, str) or not v.lstrip().startswith('='):
                    problems.append(f'{path}: {name}.{k} is not a formula (must start with "=")')
            walk_controls(ctrl.get('Children'), names, path)

apps = {}
for f in sorted(glob.glob('**/*.pa.yaml', recursive=True)):
    if 'node_modules' in f:
        continue
    try:
        doc = yaml.safe_load(open(f, encoding='utf-8'))
    except yaml.YAMLError as e:
        problems.append(f'{f}: invalid YAML: {e}')
        continue
    names = apps.setdefault(os.path.dirname(f), [])
    for screen, body in (doc.get('Screens') or {}).items():
        names.append((screen, f))
        for k, v in (body.get('Properties') or {}).items():
            if not str(v).lstrip().startswith('='):
                problems.append(f'{f}: {screen}.{k} is not a formula')
        walk_controls(body.get('Children'), names, f)
    if 'App' in doc:
        for k, v in (doc['App'].get('Properties') or {}).items():
            if not str(v).lstrip().startswith('='):
                problems.append(f'{f}: App.{k} is not a formula')

for folder, names in apps.items():
    seen = {}
    for name, f in names:
        if name in seen:
            problems.append(f'{folder}: control name {name} used in {seen[name]} and {f}')
        seen[name] = f

if problems:
    print('\n'.join(problems))
    sys.exit(1)
print(f'pa.yaml OK ({sum(len(n) for n in apps.values())} screens and controls checked)')
