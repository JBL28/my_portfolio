import hashlib,json,pathlib,zipfile
r=pathlib.Path('/tmp/komit-db-routing-20261002')
names=['jdbc-summary.json','jdbc-samples.json','lab-delay-results.json','lab-state-before.json','lab-state-after.json','lab-manifest.json','pool-recreation-results.json','pool-recreation-samples.json','environment-evidence.json','logging-original.json','logging-restored.json','http-hpa-original.json','http-hpa-restored.json','http-initial-state.json','api-stop.json','cleanup-verification.json','routing-config.javap.txt']
names.extend(p.name for p in r.glob('api-*.json') if p.name not in names)
files={n:hashlib.sha256((r/n).read_bytes()).hexdigest() for n in names if (r/n).exists()}
(r/'SHA256.json').write_text(json.dumps(files,indent=2))
with zipfile.ZipFile(r/'results.zip','w',zipfile.ZIP_DEFLATED) as z:
    for n in files:z.write(r/n,n)
    z.write(r/'SHA256.json','SHA256.json')
print(json.dumps({'files':len(files),'bytes':(r/'results.zip').stat().st_size}))
