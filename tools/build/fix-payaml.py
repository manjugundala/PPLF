#!/usr/bin/env python3
"""Rewrites single-line pa.yaml property values that would not parse as plain
YAML scalars (they contain ': ' or ' #') into block scalars (|-). Idempotent.
Usage: python3 tools/build/fix-payaml.py <file.pa.yaml>..."""
import re, sys
pat = re.compile(r'^(\s*)([A-Za-z][\w]*): (=.*)$')
for path in sys.argv[1:]:
    out = []
    for line in open(path, encoding='utf-8').read().split('\n'):
        m = pat.match(line)
        if m and (': ' in m.group(3) or ' #' in m.group(3)):
            indent, key, val = m.groups()
            out.append(f'{indent}{key}: |-')
            out.append(f'{indent}  {val}')
        else:
            out.append(line)
    open(path, 'w', encoding='utf-8').write('\n'.join(out))
