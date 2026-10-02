import collections, concurrent.futures, datetime, json, pathlib, subprocess, threading, time
import requests
ROOT=pathlib.Path('/tmp/komit-db-routing-20261002')
PODS=['service-db-1','service-db-2','service-db-3']
def run(args,timeout=40):
    p=subprocess.run(args,capture_output=True,text=True,timeout=timeout)
    if p.returncode:raise RuntimeError(p.stderr[-2000:])
    return p.stdout
def sql(p,q):return run(['kubectl','-n','komit','exec',p,'-c','postgres','--','psql','-U','postgres','-d','service','-XAt','-v','ON_ERROR_STOP=1','-c',q]).strip()
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def stats():
    out={}
    for p in PODS:
        row=sql(p,"SELECT coalesce(seq_scan,0),coalesce(idx_scan,0),coalesce(seq_tup_read,0),coalesce(idx_tup_fetch,0) FROM pg_stat_user_tables WHERE relname='developers'")
        out[p]=dict(zip(['seq_scan','idx_scan','seq_tup_read','idx_tup_fetch'],map(int,row.split('|'))))
    return out
def app_state():
    pods=json.loads(run(['kubectl','-n','komit','get','pods','-l','app.kubernetes.io/name=service','-o','json']))['items']
    return [{'name':p['metadata']['name'],'ip':p['status'].get('podIP'),'ready':all(c.get('ready',False) for c in p['status'].get('containerStatuses',[])),'restarts':sum(c['restartCount'] for c in p['status'].get('containerStatuses',[])),'last_termination':[{k:v for k,v in c.get('lastState',{}).get('terminated',{}).items() if k in ['reason','exitCode','finishedAt']} for c in p['status'].get('containerStatuses',[])]} for p in pods]
local=threading.local()
def req(i,scheduled):
    if not hasattr(local,'session'):local.session=requests.Session()
    start=time.perf_counter()
    try:
        r=local.session.get('http://127.0.0.1:30080/api/developers',params={'page':1,'size':20},timeout=3)
        data=r.json() if r.status_code==200 else {}
        return {'i':i,'status':r.status_code,'valid':r.status_code==200 and len(data.get('content',[]))==15,'ms':(time.perf_counter()-start)*1000,'schedule_lag_ms':(start-scheduled)*1000}
    except Exception as e:return {'i':i,'status':0,'valid':False,'ms':(time.perf_counter()-start)*1000,'error':type(e).__name__,'schedule_lag_ms':(start-scheduled)*1000}
def pct(a,p):
    a=sorted(a);n=(len(a)-1)*p;k=int(n);return a[k]+(a[min(k+1,len(a)-1)]-a[k])*(n-k)
def test(rate,duration,label):
    before=stats();state_before=app_state();start=stamp();futures=[];drops=0;t0=time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=32) as pool:
        for i in range(rate*duration):
            scheduled=t0+i/rate;wait=scheduled-time.perf_counter()
            if wait>0:time.sleep(wait)
            if time.perf_counter()-scheduled>.1:drops+=1;continue
            futures.append(pool.submit(req,i,scheduled))
        samples=[f.result() for f in futures]
    elapsed=time.perf_counter()-t0;stop=stamp();time.sleep(4);after=stats();state_after=app_state()
    result={'label':label,'start':start,'stop':stop,'target_rps':rate,'duration_s':duration,'elapsed_s':elapsed,'requests':len(samples),'valid':sum(s['valid'] for s in samples),'scheduler_drops':drops,'statuses':dict(collections.Counter(str(s['status']) for s in samples)),'p50_ms':pct([s['ms'] for s in samples],.5),'p95_ms':pct([s['ms'] for s in samples],.95),'p99_ms':pct([s['ms'] for s in samples],.99),'max_schedule_lag_ms':max(s['schedule_lag_ms'] for s in samples),'stats_before':before,'stats_after':after,'stats_delta':{p:{k:after[p][k]-before[p][k] for k in before[p]} for p in PODS},'state_before':state_before,'state_after':state_after}
    (ROOT/(label+'.json')).write_text(json.dumps(result,indent=2));(ROOT/(label+'-requests.json')).write_text(json.dumps(samples))
    print(json.dumps({k:v for k,v in result.items() if k not in ['stats_before','stats_after','state_before','state_after']}),flush=True)
    return result
def main():
    hpa=json.loads(run(['kubectl','-n','komit','get','hpa','service','-o','json']))['spec']
    (ROOT/'http-hpa-original.json').write_text(json.dumps(hpa,indent=2))
    (ROOT/'http-initial-state.json').write_text(json.dumps(app_state(),indent=2))
    try:
        run(['kubectl','-n','komit','patch','hpa','service','--type=merge','-p',json.dumps({'spec':{'minReplicas':5,'maxReplicas':5}})])
        run(['kubectl','-n','komit','rollout','status','deploy/service','--timeout=180s'],timeout=190)
        for i in range(60):
            s=app_state()
            if len(s)==5 and all(p['ready'] for p in s):break
            time.sleep(2)
        else:raise RuntimeError('Not all five pods are ready')
        test(10,120,'api-warmup')
        for repeat,rates in enumerate([[10,50,100],[100,50,10],[50,10,100]],1):
            for rate in rates:
                r=test(rate,60,f'api-r{repeat}-{rate}')
                added_restarts=sum(p['restarts'] for p in r['state_after'])-sum(p['restarts'] for p in r['state_before'])
                if r['valid']<r['requests']*.99 or r['p95_ms']>1000 or added_restarts>0:
                    (ROOT/'api-stop.json').write_text(json.dumps({'label':r['label'],'reason':'error >= 1%, p95 > 1000 ms, or pod restarted','restarts_added':added_restarts},indent=2));return
    finally:
        run(['kubectl','-n','komit','patch','hpa','service','--type=merge','-p',json.dumps({'spec':{'minReplicas':hpa['minReplicas'],'maxReplicas':hpa['maxReplicas']}})])
        final=json.loads(run(['kubectl','-n','komit','get','hpa','service','-o','json']))['spec']
        (ROOT/'http-hpa-restored.json').write_text(json.dumps(final,indent=2));print(json.dumps({'hpa_restored':True}),flush=True)
if __name__=='__main__':main()
