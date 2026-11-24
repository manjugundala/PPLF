#!/usr/bin/env python3
"""Checks every *.pa.yaml file in the repo:
  * parses as YAML
  * every property value is a Power Fx formula (starts with '=')
  * control names are unique across the app folder
  * no property that Power Apps Studio rejected on paste (PA2108), and no
    control version older than the one Studio upgrades to (PA2105)
Exit code 1 on any problem. Used by CI."""
import glob, os, sys
import yaml

problems = []

# Learned from Studio paste errors (Nov 2026). Control family -> properties
# Studio does not know. Keep this list growing whenever a paste fails.
REJECTED = {
    'Rectangle': {'RadiusTopLeft', 'RadiusTopRight', 'RadiusBottomLeft', 'RadiusBottomRight'},
    'DropDown': {'ItemDisplayText'},
    'NumberInput': {'Placeholder'},
    'GroupContainer': {'VerticalOverflow', 'HorizontalOverflow'},
}
# Oldest control versions Studio accepts without a PA2105 upgrade warning.
MIN_VERSION = {'GroupContainer': (1, 5, 0), 'NumberInput': (2, 9, 12)}

def check_control(path, name, ctrl):
    family, _, ver = str(ctrl.get('Control', '')).partition('@')
    for k in (ctrl.get('Properties') or {}):
        if k in REJECTED.get(family, ()):
            problems.append(f'{path}: {name}.{k} is not a property of {family} (Studio PA2108)')
    if family in MIN_VERSION and ver:
        if tuple(int(x) for x in ver.split('.')) < MIN_VERSION[family]:
            problems.append(f'{path}: {name} uses {family}@{ver}; use {".".join(map(str, MIN_VERSION[family]))} or later')

def walk_controls(children, names, path):
    for child in children or []:
        for name, ctrl in child.items():
            names.append((name, path))
            check_control(path, name, ctrl)
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
