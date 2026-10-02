import datetime, json, pathlib, subprocess, time
ROOT=pathlib.Path('/tmp/komit-db-routing-20261002')
NS='komit-routing-lab-20261002'
def run(args):
    p=subprocess.run(args,capture_output=True,text=True,timeout=30)
    if p.returncode:raise RuntimeError(p.stderr)
    return p.stdout.strip()
def sql(p,q):return run(['kubectl','-n','komit','exec',p,'-c','postgres','--','psql','-U','postgres','-d','service','-XAt','-c',q])
raw_ns=run(['kubectl','get','namespace',NS,'--ignore-not-found','-o','json'])
if raw_ns:
    ns=json.loads(raw_ns)
    if ns['metadata'].get('labels',{}).get('purpose')!='komit-db-routing-experiment' or ns['metadata']['labels'].get('run')!='20261002':raise RuntimeError('Namespace ownership check failed')
    run(['kubectl','delete','namespace',NS,'--wait=false'])
for i in range(30):
    remaining=run(['kubectl','get','namespace',NS,'--ignore-not-found','-o','name'])
    if not remaining:break
    time.sleep(1)
for name in ['credentials.json','credentials.properties']:
    (ROOT/name).unlink(missing_ok=True)
hpa=json.loads(run(['kubectl','-n','komit','get','hpa','service','-o','json']))['spec']
original=json.loads((ROOT/'http-hpa-original.json').read_text())
out={'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'test_namespace_deleted':not bool(remaining),'credentials_deleted':all(not (ROOT/n).exists() for n in ['credentials.json','credentials.properties']),'test_schema_count':int(sql('service-db-1',"SELECT count(*) FROM information_schema.schemata WHERE schema_name='routing_exp_20261002'")),'logging_restored':{p:sql(p,'SHOW log_min_duration_statement') for p in ['service-db-1','service-db-2','service-db-3']},'synchronous_commit':sql('service-db-1','SHOW synchronous_commit'),'synchronous_standby_names':sql('service-db-1','SHOW synchronous_standby_names'),'hpa_spec_restored':hpa==original,'hpa_min':hpa['minReplicas'],'hpa_max':hpa['maxReplicas'],'test_containers_remaining':run(['docker','ps','--filter','name=komit-routing-','--format','{{.Names}}'])}
(ROOT/'cleanup-verification.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
assert out['test_namespace_deleted'] and out['credentials_deleted'] and out['test_schema_count']==0 and out['hpa_spec_restored'] and not out['test_containers_remaining']
