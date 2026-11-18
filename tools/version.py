#!/usr/bin/env python3
"""Setzt Versionsnummer + Build-Datum in index.html (Anzeige unten rechts und Cache-Schlüssel).
Aufruf: python3 tools/version.py 0.9   (ohne Argument: zweite Stelle +1)"""
import re, sys, datetime, zoneinfo, pathlib
p = pathlib.Path(__file__).resolve().parent.parent / 'index.html'
s = p.read_text()
cur = re.search(r"LOOPSTILL_VERSION = '([\d.]+)'", s).group(1)
if len(sys.argv) > 1:
    new = sys.argv[1]
else:
    a, b = cur.split('.')
    new = f"{a}.{int(b) + 1}"
now = datetime.datetime.now(zoneinfo.ZoneInfo('Europe/Berlin')).strftime('%d.%m.%Y, %H:%M')
s = re.sub(r"LOOPSTILL_VERSION = '[\d.]+'", f"LOOPSTILL_VERSION = '{new}'", s)
s = re.sub(r"LOOPSTILL_BUILD = '[^']*'", f"LOOPSTILL_BUILD = '{now}'", s)
s = re.sub(r'\.js\?v=[\d.]+', f'.js?v={new}', s)
p.write_text(s)
print(new, now)
