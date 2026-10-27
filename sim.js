// Simulador sin interfaz: node sim.js [runs] [semilla]
const fs=require('fs');
const src=fs.readFileSync(__dirname+'/atomic-ash-proto.html','utf8');
const logic=src.split('// ==LOGIC START==')[1].split('// ==LOGIC END==')[0];
const m={};new Function('m',logic+'\nObject.assign(m,{CONFIG,createGame,tick,applyChoice,useConsumable,results,currentDps,playableChars});')(m);
const RUNS=+process.argv[2]||3, SEED=+process.argv[3]||1;
function bot(s){const p=s.p;let ax=0,ay=0;
 for(const e of s.enemies){if(e.flying)continue;const dx=p.x-e.x,dy=p.y-e.y,d2=dx*dx+dy*dy;if(d2<300*300){const d=Math.sqrt(d2)||1;const w=(e.boss?6:1)/(d*d)*1e4;ax+=dx/d*w;ay+=dy/d*w;}}
 for(const t of s.tele){const dx=p.x-t.x,dy=p.y-t.y,d=Math.hypot(dx,dy)||1;if(d<t.r+40){ax+=dx/d*20;ay+=dy/d*20;}}
 const tx=-ay*0.6,ty=ax*0.6;ax+=tx+(1600-p.x)/800;ay+=ty+(1600-p.y)/800;const l=Math.hypot(ax,ay);return l>0.01?{mx:ax/l,my:ay/l}:{mx:0,my:0};}
function run(ch,seed){const s=m.createGame(ch,seed);let maxEnt=0;const log=[];let next=60;
 while(!s.over&&s.t<m.CONFIG.run.duration+60){
  if(s.choice){const cs=s.choice.cards;let i=cs.findIndex(c=>c.kind==='fusion');if(i<0)i=cs.findIndex(c=>c.kind==='new'&&m.CONFIG.weapons[c.id].owner);if(i<0)i=0;m.applyChoice(s,i);continue;}
  if(s.p.hp<s.p.maxHp*0.35)m.useConsumable(s,0);if(s.p.rad>70)m.useConsumable(s,1);
  m.tick(s,1/60,bot(s));
  const ent=s.enemies.length+s.shots.length+s.ebullets.length+s.pickups.length;if(ent>maxEnt)maxEnt=ent;
  if(s.t>=next){log.push(`m${next/60}:nv${s.level} pv${Math.ceil(s.p.hp)} rad${s.p.rad|0} dps${Math.round(m.currentDps(s))} en${s.enemies.length}`);next+=60;}}
 const r=m.results(s),tot=s.dmgTotal||1;
 const boss=s.enemies.find(e=>e.boss);
 console.log(`${ch} s${seed}: ${r.won?'GANA':'muere'} ${(r.time/60).toFixed(1)}min nv${r.level} bajas${r.kills} jefes${r.bosses} radmax${r.rad} maxEnt${maxEnt} ${boss?boss.type+' '+Math.round(boss.hp/boss.maxHp*100)+'%':''}`);
 console.log('   '+s.weapons.map(w=>w.id+w.lvl).join(',')+' | '+Object.entries(s.dmgBy).sort((a,b)=>b[1]-a[1]).map(([k,v])=>k+':'+Math.round(v/tot*100)+'%').join(' '));
 console.log('   '+log.join(' | '));}
for(const ch of m.playableChars())for(let i=0;i<RUNS;i++)run(ch,SEED+i);
