import base64, json, pathlib, subprocess, time
ROOT=pathlib.Path('/tmp/komit-db-routing-20261002')
NS='komit-routing-lab-20261002'
def run(args,data=None,timeout=40):
    p=subprocess.run(args,input=data,capture_output=True,text=True,timeout=timeout)
    if p.returncode:raise RuntimeError(p.stderr)
    return p.stdout
def get(kind,name,ns=NS):return json.loads(run(['kubectl','-n',ns,'get',kind,name,'-o','json']))
namespace={'apiVersion':'v1','kind':'Namespace','metadata':{'name':NS,'labels':{'purpose':'komit-db-routing-experiment','run':'20261002'}}}
cluster={'apiVersion':'postgresql.cnpg.io/v1','kind':'Cluster','metadata':{'name':'routing-lab','namespace':NS},'spec':{'instances':3,'imageName':'ghcr.io/cloudnative-pg/postgresql:16.15-minimal-trixie','bootstrap':{'initdb':{'database':'lab','owner':'lab'}},'storage':{'size':'1Gi'},'resources':{'requests':{'cpu':'50m','memory':'128Mi'},'limits':{'memory':'512Mi'}},'postgresql':{'parameters':{'synchronous_commit':'remote_apply','shared_buffers':'64MB','max_connections':'100'},'synchronous':{'number':2,'method':'any','dataDurability':'preferred','failoverQuorum':False}}}}
run(['kubectl','apply','-f','-'],json.dumps(namespace))
run(['kubectl','apply','-f','-'],json.dumps(cluster))
(ROOT/'lab-manifest.json').write_text(json.dumps(cluster,indent=2))
print('Created isolated replication test cluster',flush=True)
for i in range(180):
    c=get('cluster','routing-lab')
    if c.get('status',{}).get('readyInstances')==3:break
    time.sleep(2)
else:raise RuntimeError('Cluster readiness timeout')
conf={}
for prefix,ns,cluster_name,dbname in [('lab',NS,'routing-lab','lab'),('live','komit','service-db','service')]:
    secret=get('secret',cluster_name+'-app',ns)['data']
    data={k:base64.b64decode(v).decode() for k,v in secret.items()}
    rw=get('svc',cluster_name+'-rw',ns)['spec']['clusterIP']
    ro=get('svc',cluster_name+'-ro',ns)['spec']['clusterIP']
    pods=json.loads(run(['kubectl','-n',ns,'get','pods','-l','cnpg.io/cluster='+cluster_name,'-o','json']))['items']
    conf[prefix]={'username':data['username'],'password':data['password'],'writeUrl':f'jdbc:postgresql://{rw}:5432/{dbname}','readUrl':f'jdbc:postgresql://{ro}:5432/{dbname}','replicas':[{'pod':p['metadata']['name'],'ip':p['status']['podIP']} for p in pods if p['metadata']['labels'].get('cnpg.io/instanceRole')=='replica']}
path=ROOT/'credentials.json'
path.write_text(json.dumps(conf));path.chmod(0o600)
props=ROOT/'credentials.properties'
props.write_text('\n'.join(k+'.'+n+'='+v.replace('\\','\\\\').replace('\n','\\n') for k,d in conf.items() for n,v in d.items() if isinstance(v,str)))
props.chmod(0o600)
print(json.dumps({'namespace':NS,'ready':3,'replicas':[{k:v for k,v in x.items()} for x in conf['lab']['replicas']]}),flush=True)
