import datetime, json, pathlib, queue, subprocess, threading, time
ROOT=pathlib.Path('/tmp/komit-db-routing-20261002')
NS='komit-routing-lab-20261002'
PODS=['routing-lab-2','routing-lab-3']
def sql(pod,query):
    p=subprocess.run(['kubectl','-n',NS,'exec',pod,'-c','postgres','--','psql','-U','postgres','-d','lab','-XAt','-v','ON_ERROR_STOP=1','-c',query],capture_output=True,text=True,timeout=10)
    if p.returncode:raise RuntimeError(p.stderr)
    return p.stdout.strip()
def state():
    return {'sync_commit':sql('routing-lab-1','SHOW synchronous_commit'),'sync_names':sql('routing-lab-1','SHOW synchronous_standby_names'),'replication':sql('routing-lab-1','SELECT application_name,sync_state,state FROM pg_stat_replication'),'ro_endpoints':json.loads(subprocess.check_output(['kubectl','-n',NS,'get','endpointslices','-l','kubernetes.io/service-name=routing-lab-ro','-o','json']))}
q=queue.Queue();raw=[]
p=subprocess.Popen(['docker','run','--rm','--name','komit-routing-delay-20261002','-i','--network','host','--memory=512m','--cpus=1','-v',str(ROOT)+':/exp','eclipse-temurin:21-jdk','java','-Xms64m','-Xmx192m','-cp','/exp:/exp/extracted/BOOT-INF/classes:/exp/extracted/BOOT-INF/lib/*','RoutingHarness','lab'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
def reader():
    for line in p.stdout:
        raw.append(line)
        if line.startswith('{'):
            data=json.loads(line);q.put(data)
threading.Thread(target=reader,daemon=True).start()
def command(line):p.stdin.write(line+'\n');p.stdin.flush()
def event(name,timeout=30):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        x=q.get(timeout=max(.01,deadline-time.monotonic()))
        if x.get('event')==name:return x
        if x.get('phase')=='lab-baseline':baseline.append(x)
    raise TimeoutError(name)
results=[];baseline=[]
try:
    event('READY');before=state();(ROOT/'lab-state-before.json').write_text(json.dumps(before,indent=2))
    command('BASE\t1000');event('DONE')
    for delay in [500,2000]:
        # AB / BA alternation, five trials for each setting at each delay.
        for repeat in range(1,6):
            modes=['remote_apply','local'] if repeat%2 else ['local','remote_apply']
            for mode in modes:
                for pod in PODS:sql(pod,'SELECT pg_wal_replay_pause()')
                for pod in PODS:
                    for i in range(20):
                        if sql(pod,'SELECT pg_get_wal_replay_pause_state()')=='paused':break
                        time.sleep(.02)
                    else:raise RuntimeError('Replica was not paused')
                config=state()
                if not config['sync_names'].startswith('ANY 2'):raise RuntimeError('Synchronous quorum changed')
                nonce=100000+delay*10+repeat*2+(mode=='local')
                command(f'DELAY\t{mode}\t{nonce}')
                event('WRITE_START');start=time.monotonic();resume_info={};resume_errors=[]
                def resume():
                    try:
                        for pod in PODS:sql(pod,'SELECT pg_wal_replay_resume()')
                        resume_info['actual_resume_complete_ms']=(time.monotonic()-start)*1000
                    except Exception as e:resume_errors.append(str(e))
                timer=threading.Timer(delay/1000,resume);timer.start()
                r=event('RESULT',timeout=12);timer.join(timeout=12)
                if resume_errors:raise RuntimeError(resume_errors)
                command(f'VERIFY\t{nonce}');verification=event('VERIFIED')
                r.update({'delay_ms':delay,'repeat':repeat,**resume_info,'after_resume':verification,'time':datetime.datetime.now(datetime.timezone.utc).isoformat(),'quorum':config['sync_names']})
                results.append(r);(ROOT/'lab-delay-results.json').write_text(json.dumps({'baseline':baseline,'trials':results},indent=2));print(json.dumps(r),flush=True)
finally:
    for pod in PODS:
        try:sql(pod,'SELECT pg_wal_replay_resume()')
        except Exception:pass
    try:command('QUIT');p.wait(timeout=30)
    except Exception:p.terminate()
    (ROOT/'lab-run.log').write_text(''.join(raw))
    (ROOT/'lab-state-after.json').write_text(json.dumps(state(),indent=2))
    print(json.dumps({'finished':True,'trials':len(results),'baseline':baseline}),flush=True)
