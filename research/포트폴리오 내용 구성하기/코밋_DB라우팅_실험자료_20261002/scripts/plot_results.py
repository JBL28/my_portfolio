import json, pathlib, statistics
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib import font_manager
ROOT=pathlib.Path(__file__).resolve().parents[1]
out=ROOT/'figures';out.mkdir(exist_ok=True)
font=pathlib.Path('C:/Windows/Fonts/malgun.ttf')
if font.exists():
    font_manager.fontManager.addfont(str(font));plt.rcParams['font.family']='Malgun Gothic'
plt.rcParams.update({'font.size':11,'axes.unicode_minus':False,'axes.spines.top':False,'axes.spines.right':False,'figure.facecolor':'white','axes.facecolor':'white'})
a=json.loads((ROOT/'analysis.json').read_text(encoding='utf-8'))
blue='#2563eb';orange='#f97316'
fig,axes=plt.subplots(1,2,figsize=(11.5,4.8),sharey=True,layout='constrained')
for ax,key,title in zip(axes,['connections','reads'],['풀에 열린 물리 연결','실제로 처리한 조회 트랜잭션']):
    ratios=[p[key].get('10.42.0.19/32',0)/sum(p[key].values())*100 for p in a['pool_trials']]
    ax.bar([1,2,3],ratios,color=blue,label='Standby 2',width=.6)
    ax.bar([1,2,3],[100-x for x in ratios],bottom=ratios,color=orange,label='Standby 3',width=.6)
    for x,v in zip([1,2,3],ratios):
        ax.text(x,v/2,f'{v:.1f}%',ha='center',va='center',color='white',weight='bold',fontsize=10)
        if 100-v>10:ax.text(x,v+(100-v)/2,f'{100-v:.1f}%',ha='center',va='center',color='white',weight='bold',fontsize=10)
        else:ax.annotate(f'{100-v:.1f}%',(x,100),(x,105),ha='center',fontsize=10)
    ax.set_ylim(0,113);ax.set_xticks([1,2,3],['재생성 1회차','재생성 2회차','재생성 3회차']);ax.set_title(title,fontsize=13,pad=12);ax.set_yticks([0,25,50,75,100]);ax.grid(axis='y',alpha=.15);ax.set_axisbelow(True)
axes[0].set_ylabel('비율 (%)');axes[1].legend(loc='lower center',bbox_to_anchor=(.5,-.22),ncol=2,frameon=False)
fig.suptitle('연결의 분배 비율과 조회의 분배 비율은 달랐다',fontsize=16,weight='bold')
fig.savefig(out/'pool-distribution.png',dpi=180,bbox_inches='tight');fig.savefig(out/'pool-distribution.svg',bbox_inches='tight');plt.close(fig)
trials=json.loads((ROOT/'raw/lab-delay-results.json').read_text())['trials']
fig,axes=plt.subplots(1,2,figsize=(11.5,4.8),layout='constrained')
for k,(mode,color,label) in enumerate([('remote_apply',blue,'remote_apply (현재 설정)'),('local',orange,'local (비교 설정)')]):
    for j,delay in enumerate([500,2000]):
        rows=[t for t in trials if t['mode']==mode and t['delay_ms']==delay]
        x=j+(-.16 if k==0 else .16);values=[t['write_ms'] for t in rows]
        axes[0].scatter([x+q*.013 for q in [-2,-1,0,1,2]],values,color=color,s=30,alpha=.7,label=label if j==0 else None)
        median=statistics.median(values);axes[0].plot([x-.08,x+.08],[median,median],color=color,lw=3)
        axes[0].annotate(f'{median:.1f} ms',(x,median),xytext=(0,11),textcoords='offset points',ha='center',color=color,fontsize=10)
        stale=sum(t['stale'] for t in rows);total=sum(t['reads'] for t in rows)
        axes[1].bar(x,stale/total*100,width=.28,color=color,label=label if j==0 else None)
        axes[1].text(x,stale/total*100+3,f'{stale}/{total}',ha='center',color=color,fontsize=10)
axes[0].set_yscale('log');axes[0].set_ylim(1,5000);axes[0].set_ylabel('쓰기 완료 시간 (ms · 로그 축)');axes[0].set_title('각 점은 쓰기 1회, 가로선은 중앙값',fontsize=12);axes[0].grid(axis='y',alpha=.18)
axes[1].set_ylim(0,115);axes[1].set_ylabel('쓰기 완료 직후 이전 값 조회 (%)');axes[1].set_title('각 조건은 쓰기 5회 × 조회 20회',fontsize=12);axes[1].grid(axis='y',alpha=.15);axes[1].set_axisbelow(True)
for ax in axes:ax.set_xticks([0,1],['재개 타이머 0.5초','재개 타이머 2.0초'])
axes[0].legend(loc='center left',bbox_to_anchor=(.01,.32),frameon=False,fontsize=9)
fig.suptitle('복제를 기다리는 쓰기와 기다리지 않는 쓰기의 차이',fontsize=16,weight='bold')
fig.savefig(out/'replication-tradeoff.png',dpi=180,bbox_inches='tight');fig.savefig(out/'replication-tradeoff.svg',bbox_inches='tight');plt.close(fig)
print('Created two figures with PNG and SVG exports')
