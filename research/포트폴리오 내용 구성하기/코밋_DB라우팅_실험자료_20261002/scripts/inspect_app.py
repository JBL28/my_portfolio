import json, pathlib, subprocess, zipfile, urllib.request

root = pathlib.Path('/tmp/komit-db-routing-20261002')
root.mkdir(exist_ok=True)
def run(args):
    p=subprocess.run(args,capture_output=True,text=True,timeout=30)
    return {'code':p.returncode,'out':p.stdout,'err':p.stderr}
def kube(*args):
    return json.loads(run(['kubectl','-n','komit',*args])['out'])
pod=kube('get','pods','-l','app.kubernetes.io/name=service','-o','json')['items'][0]['metadata']['name']
jar=root/'app.jar'
if not jar.exists():
    with jar.open('wb') as f:
        subprocess.run(['kubectl','-n','komit','exec',pod,'--','cat','/app/app.jar'],stdout=f,check=True)
out={}
with zipfile.ZipFile(jar) as z:
    out['spring_jars']=[n for n in z.namelist() if n.startswith('BOOT-INF/lib/') and any(x in n for x in ['spring-jdbc','spring-tx','Hikari','postgresql','spring-core','spring-context'])]
    out['classes']=[n for n in z.namelist() if n.startswith('BOOT-INF/classes/') and any(x in n for x in ['DataSource','Notification','Review','Developer','Security','Controller','application'])]
    configs={}
    for n in z.namelist():
        if n.startswith('BOOT-INF/classes/application') and n.endswith(('.yml','.yaml','.properties')):
            text=z.read(n).decode()
            configs[n]=[line for line in text.splitlines() if any(x in line.lower() for x in ['datasource','hikari','pool','read-url','readurl','maximum','minimum','connection','lifetime','timeout','readonly','read-only','jdbc','db_url','db_read_url'])]
    out['config_lines']=configs
    z.extractall(root/'extracted')
out['db_schema']=run(['kubectl','-n','komit','exec','service-db-1','-c','postgres','--','psql','-U','postgres','-d','service','-Atc',"SELECT table_name FROM information_schema.tables WHERE table_schema='public'; SELECT application_name,client_addr,datname,state,count(*) FROM pg_stat_activity WHERE backend_type='client backend' GROUP BY 1,2,3,4;"])
out['images']=run(['docker','images','--format','{{.Repository}}:{{.Tag}}'])
out['jdk_tools']=run(['sh','-c','command -v java; command -v javac; command -v javap; command -v curl'])
for prefix in ['', '/prometheus']:
    try:
        targets=json.loads(urllib.request.urlopen('http://localhost:9090'+prefix+'/api/v1/targets').read())['data']['activeTargets']
        out['metrics_targets']=[{'labels':t['labels'],'url':t['scrapeUrl'],'health':t['health']} for t in targets]
        out['prometheus_prefix']=prefix
        break
    except Exception as e:out['prometheus_error'+prefix]=str(e)
for path in ['/actuator/health','/actuator/prometheus','/v3/api-docs','/api/v3/api-docs']:
    try:
        r=urllib.request.urlopen('http://127.0.0.1:30080'+path,timeout=10)
        data=r.read()
        (root/('http'+path.replace('/','_')+'.txt')).write_bytes(data)
        out[path]={'status':r.status,'bytes':len(data),'preview': data[:120].decode(errors='replace') if path.endswith('health') else ''}
    except Exception as e:out[path]={'error':str(e)}
print(json.dumps(out,indent=2))
