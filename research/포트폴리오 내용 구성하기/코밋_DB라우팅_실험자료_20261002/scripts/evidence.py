import datetime, hashlib, json, pathlib, subprocess, zipfile
ROOT=pathlib.Path('/tmp/komit-db-routing-20261002')
def run(args):
    p=subprocess.run(args,capture_output=True,text=True,timeout=30)
    if p.returncode:raise RuntimeError(p.stderr)
    return p.stdout.strip()
def kube(ns,*args):return json.loads(run(['kubectl','-n',ns,*args]))
def sql(p,q):return run(['kubectl','-n','komit','exec',p,'-c','postgres','--','psql','-U','postgres','-d','service','-XAt','-c',q])
deploy=kube('komit','get','deploy','service','-o','json')
cluster=kube('komit','get','cluster','service-db','-o','json')
node=json.loads(run(['kubectl','get','nodes','-o','json']))['items'][0]
with zipfile.ZipFile(ROOT/'app.jar') as z:
    class_name='BOOT-INF/classes/com/a501/service/config/DataSourceRoutingConfig.class'
    libraries=[n.rsplit('/',1)[-1] for n in z.namelist() if n.startswith('BOOT-INF/lib/') and any(x in n for x in ['Hikari','spring-jdbc-','spring-tx-','postgresql-'])]
    code_hash=hashlib.sha256(z.read(class_name)).hexdigest()
out={'recorded_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'node':{'capacity':node['status']['capacity'],'allocatable':node['status']['allocatable'],'version':node['status']['nodeInfo']},'application':{'image':deploy['spec']['template']['spec']['containers'][0]['image'],'resources':deploy['spec']['template']['spec']['containers'][0]['resources'],'configured_replicas':deploy['spec']['replicas'],'libraries':libraries,'routing_class':class_name,'routing_class_sha256':code_hash},'database':{'spec':{k:v for k,v in cluster['spec'].items() if k in ['instances','imageName','resources','postgresql']},'primary':cluster['status']['currentPrimary'],'sync_commit':sql('service-db-1','SHOW synchronous_commit'),'sync_names':sql('service-db-1','SHOW synchronous_standby_names'),'role_settings':sql('service-db-1',"SELECT setdatabase,setrole,array_to_string(setconfig,',') FROM pg_db_role_setting"),'developer_rows':sql('service-db-1','SELECT count(*) FROM public.developers'),'database_bytes':sql('service-db-1',"SELECT pg_database_size('service')"),'test_schema_count':sql('service-db-1',"SELECT count(*) FROM information_schema.schemata WHERE schema_name='routing_exp_20261002'")},'restarts':[]}
pods=kube('komit','get','pods','-l','app.kubernetes.io/name=service','-o','json')['items']
out['restarts']=[{'name':p['metadata']['name'],'restart_count':p['status']['containerStatuses'][0]['restartCount'],'last_termination':p['status']['containerStatuses'][0].get('lastState',{}).get('terminated',{})} for p in pods]
(ROOT/'environment-evidence.json').write_text(json.dumps(out,indent=2))
print(json.dumps({k:v for k,v in out.items() if k in ['recorded_at','application','database']}))
