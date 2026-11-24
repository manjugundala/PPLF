#!/usr/bin/env python3
"""Builds control-level YAML for pasting into Power Apps Studio.

Studio's paste accepts a list of controls ("- name:"), not a whole screen. For each
screen in src/canvas/configuration-app/Src this writes paste/<screen>.controls.yaml
with the screen's root container, plus the screen properties to set by hand.
"""
import yaml

SRC = 'src/canvas/configuration-app/Src'
OUT = 'src/canvas/configuration-app/paste'
for scr in ['scrHome', 'scrLogs', 'scrSettings', 'scrSetup']:
    text = open(f'{SRC}/{scr}.pa.yaml', encoding='utf-8').read()
    lines = text.split('\n')
    i = next(k for k, l in enumerate(lines) if l.startswith('    Children:'))
    body = [l[6:] if l.startswith('      ') else l for l in lines[i + 1:]]
    props = yaml.safe_load(text)['Screens'][scr]['Properties']
    header = [f'# Studio paste file for {scr}. Select the screen {scr} in Tree view and press Ctrl+V.',
              '# Then set these screen properties in the formula bar:']
    for k, v in props.items():
        header.append(f'#   {k}:')
        header += [f'#     {line}' for line in str(v).split('\n')]
    content = '\n'.join(header) + '\n' + '\n'.join(body).rstrip() + '\n'
    assert isinstance(yaml.safe_load(content), list)
    open(f'{OUT}/{scr}.controls.yaml', 'w', encoding='utf-8').write(content)
    print(f'{scr}: {len(content)} chars')
