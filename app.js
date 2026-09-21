const $ = (s) => document.querySelector(s);
const collegeEvents = [
  {id:'bmi', label:'身高体重 / BMI', unit:'BMI', type:'bmi', hint:'身高 cm + 体重 kg'},
  {id:'vital', label:'肺活量', unit:'mL', type:'number', min:0, step:1, hint:'肺活量（毫升）'},
  {id:'sprint', label:'50 米跑', unit:'秒', type:'number', min:0, step:.1, hint:'用时越短越好'},
  {id:'jump', label:'立定跳远', unit:'cm', type:'number', min:0, step:1, hint:'厘米'},
  {id:'sitReach', label:'坐位体前屈', unit:'cm', type:'number', step:.1, hint:'厘米'},
  {id:'endurance', label:'耐力跑', unit:'分:秒', type:'time', hint:'男 1000 米 / 女 800 米'},
  {id:'strength', label:'力量项', unit:'次', type:'number', min:0, step:1, hint:'男引体向上 / 女仰卧起坐'}
];
let data;

async function boot() {
  data = await fetch('data/college.json').then(r => r.json());
  renderMeasureInputs();
  populateLookupEvents();
  bindEvents();
  calculate();
  calculate2400();
  renderLookup();
  applyTheme(localStorage.getItem('nanna-theme') || 'dark');
}
function eventMeta(id) { return collegeEvents.find(x => x.id === id); }
function renderMeasureInputs() {
  $('#measureGrid').innerHTML = collegeEvents.map(e => {
    const title = e.id === 'strength' ? (getGender()==='male'?'引体向上':'一分钟仰卧起坐') : e.label;
    const control = e.type === 'bmi'
      ? `<div class="unit-input"><input id="height" type="number" min="50" max="250" step=".1" placeholder="身高"><span>cm</span><input id="weight" type="number" min="10" max="300" step=".1" placeholder="体重"><span>kg</span></div>`
      : e.type === 'time'
      ? `<div class="time-input"><input id="${e.id}Min" inputmode="numeric" min="0" max="99" placeholder="分"><b>:</b><input id="${e.id}Sec" inputmode="numeric" min="0" max="59" placeholder="秒"></div>`
      : `<div class="unit-input"><input id="${e.id}" type="number" ${e.min !== undefined ? `min="${e.min}"`:''} step="${e.step || 1}" placeholder="请输入"><span>${e.unit}</span></div>`;
    return `<div class="measure-card"><div class="measure-title"><strong>${title}</strong><small>${e.hint}</small></div>${control}</div>`;
  }).join('');
  $('#measureGrid').querySelectorAll('input').forEach(i => i.addEventListener('input', calculate));
}
function getGender(){return $('#gender')?.value || 'male'}
function getGrade(){return $('#grade')?.value || 'freshman'}
function value(id){const el=$(`#${id}`); return el && el.value !== '' ? Number(el.value) : null}
function parseTime(minId, secId){const m=value(minId), s=value(secId); return m == null && s == null ? null : (m||0)*60+(s||0)}
function scoreLevel(n){return n>=90?'优秀':n>=80?'良好':n>=60?'及格':'不及格'}
function getRowValue(row,event,gender,grade){
  const col=grade==='freshman'?0:1;
  return row[event][col];
}
function scoreDiscrete(actual, rows, event, higher, grade){
  if(actual == null || Number.isNaN(actual)) return null;
  const col=grade==='freshman'?0:1;
  for(const row of rows){const threshold=row[event][col]; if(threshold == null) continue; if(higher ? actual >= threshold : actual <= threshold) return row.score;}
  return 0;
}
function bmiScore(bmi, gender){
  if(bmi == null) return null;
  const low=gender==='male'?17.9:17.2;
  if(bmi>=low && bmi<=23.9) return 100;
  if(bmi>=28) return 60;
  return 80;
}
function getMeasurements(){
  const height=value('height'), weight=value('weight');
  const bmi=height && weight ? weight/((height/100)**2) : null;
  return {bmi,vital:value('vital'),sprint:value('sprint'),jump:value('jump'),sitReach:value('sitReach'),endurance:parseTime('enduranceMin','enduranceSec'),strength:value('strength')};
}
function displayTime(seconds){if(seconds==null)return '—'; return `${Math.floor(seconds/60)}:${String(Math.round(seconds%60)).padStart(2,'0')}`}
function calculate(){
  if(!data || !$('#measureGrid').children.length)return;
  const gender=getGender(), grade=getGrade(), rows=data.genders[gender], m=getMeasurements();
  const results={bmi:bmiScore(m.bmi,gender), vital:scoreDiscrete(m.vital,rows,'vital',true,grade), sprint:scoreDiscrete(m.sprint,rows,'sprint',false,grade), jump:scoreDiscrete(m.jump,rows,'jump',true,grade), sitReach:scoreDiscrete(m.sitReach,rows,'sitReach',true,grade), endurance:scoreDiscrete(m.endurance,rows,'endurance',false,grade), strength:scoreDiscrete(m.strength,rows,'strength',true,grade)};
  const weights=data.weights; let weighted=0, complete=true;
  for(const e of collegeEvents){const s=results[e.id]; if(s==null){complete=false;continue} weighted += s*weights[e.id]/100}
  const bonus={strength:0,endurance:0};
  if(m.strength!=null){const max=getRowValue(rows[0],'strength',gender,grade); bonus.strength=Math.min(10,Math.max(0,m.strength-max));}
  if(m.endurance!=null){const max=getRowValue(rows[0],'endurance',gender,grade); const diff=max-m.endurance; for(const [seconds,points] of data.bonus.endurance){if(diff>=seconds) bonus.endurance=points;}}
  const total=weighted+bonus.strength+bonus.endurance;
  renderResult({results,weighted,total,bonus,m,bmi:m.bmi,complete,gender,grade});
}
function renderResult({results,weighted,total,bonus,m,bmi,complete,gender,grade}){
  const labels={bmi:'BMI / 身高体重',vital:'肺活量',sprint:'50 米跑',jump:'立定跳远',sitReach:'坐位体前屈',endurance:gender==='male'?'1000 米跑':'800 米跑',strength:gender==='male'?'引体向上':'仰卧起坐'};
  const rows=collegeEvents.map(e=>{const s=results[e.id], w=data.weights[e.id]; const missing=s==null; const bonusText=(e.id==='strength'&&bonus.strength)||(e.id==='endurance'&&bonus.endurance); return `<div class="bar-row"><span class="bar-label">${labels[e.id]}</span><span class="bar-track"><span class="bar-fill" style="width:${missing?0:Math.min(100,s)}%"></span></span><span class="bar-value">${missing?'—':s}<small> / ${w}%</small>${bonusText?`<i class="bonus">+${bonusText}</i>`:''}</span></div>`}).join('');
  const totalText=Number.isFinite(total)?total.toFixed(1):'—';
  $('#resultArea').innerHTML=`<div class="score-card"><span class="score-caption">${complete?'综合预估成绩':'填写全部项目后显示完整成绩'}</span><div class="big-score">${totalText}</div><span class="level">${complete?scoreLevel(total):'待完善'}</span><div class="score-note">加权项 ${weighted.toFixed(1)} 分 · 加分 ${bonus.strength+bonus.endurance} 分<br>${bmi!=null?`BMI ${bmi.toFixed(1)} · `:''}${grade==='freshman'?'大一 / 大二':'大三 / 大四'}</div></div><div class="breakdown"><div class="breakdown-head"><strong>项目明细</strong><span>单项分 / 权重</span></div>${rows}</div>`;
}
function bindEvents(){
  $$('.mode-tab').forEach(btn=>btn.addEventListener('click',()=>switchMode(btn.dataset.mode)));
  $('#gender').addEventListener('change',()=>{renderMeasureInputs();calculate()});
  $('#grade').addEventListener('change',calculate);
  $('#resetButton').addEventListener('click',()=>{document.querySelectorAll('#measureGrid input').forEach(i=>i.value='');calculate()});
  $('#shareButton').addEventListener('click',copySummary);
  $('#printButton').addEventListener('click',()=>window.print());
  $('#runGender').addEventListener('change',calculate2400); $('#runTime').addEventListener('input',calculate2400);
  $('#lookupEvent').addEventListener('change',renderLookup); $('#lookupGender').addEventListener('change',renderLookup); $('#lookupGrade').addEventListener('change',renderLookup);
  $('#themeToggle').addEventListener('click',()=>applyTheme(document.body.classList.contains('light')?'dark':'light'));
}
function $$(s){return [...document.querySelectorAll(s)]}
function switchMode(mode){$$('.mode-tab').forEach(b=>{const active=b.dataset.mode===mode;b.classList.toggle('active',active);b.setAttribute('aria-selected',active)});$$('.mode-panel').forEach(p=>p.classList.toggle('hidden',p.dataset.panel!==mode));history.replaceState(null,'',`#${mode}`)}
function parseInputTime(v){if(!v)return null;const p=v.trim().split(':');if(p.length===1&&/^\d+(\.\d+)?$/.test(p[0]))return Number(p[0]);if(p.length===2&&Number(p[0])>=0&&Number(p[1])<60)return Number(p[0])*60+Number(p[1]);return null}
function calculate2400(){if(!data||!$('#runResult'))return;const seconds=parseInputTime($('#runTime').value), gender=$('#runGender').value; if(seconds==null){$('#runResult').innerHTML='<div class="empty-state">输入成绩后查看单项分数</div>';return}const rows=data.legacyStandard['2400m'][gender];let found=rows.find(r=>seconds<=r.seconds); if(!found)found=rows[rows.length-1];const score=seconds<rows[0].seconds?100:found.score; const note=score===100&&seconds<rows[0].seconds?'超过满分档位':score===0?'低于最低档位':`对应档位 ${displayTime(found.seconds)}`;$('#runResult').innerHTML=`<div class="single-score"><div class="number">${score.toFixed(1)}</div><p>${scoreLevel(score)} · ${note} · 实测 ${displayTime(seconds)}</p></div>`}
function populateLookupEvents(){const names={vital:'肺活量',sprint:'50 米跑',jump:'立定跳远',sitReach:'坐位体前屈',endurance:'耐力跑',strength:'力量项'};$('#lookupEvent').innerHTML=Object.entries(names).map(([id,n])=>`<option value="${id}">${n}</option>`).join('')}
function renderLookup(){if(!data||!$('#lookupTable'))return;const event=$('#lookupEvent').value,gender=$('#lookupGender').value,grade=$('#lookupGrade').value,rows=data.genders[gender];const labels={vital:'肺活量（mL）',sprint:'50 米（秒）',jump:'立定跳远（cm）',sitReach:'坐位体前屈（cm）',endurance:'耐力跑',strength:gender==='male'?'引体向上（次）':'仰卧起坐（次）'};const higher=['vital','jump','sitReach','strength'].includes(event);$('#lookupTable').innerHTML=`<thead><tr><th>等级</th><th>单项分</th><th>${labels[event]} · ${grade==='freshman'?'大一/大二':'大三/大四'}</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${scoreLevel(r.score)}</td><td>${r.score}</td><td>${event==='endurance'?displayTime(r[event][grade==='freshman'?0:1]):r[event][grade==='freshman'?0:1]}${higher?' 以上':' 以内'}</td></tr>`).join('')}</tbody>`}
async function copySummary(){const score=$('.big-score')?.textContent||'—';const level=$('.level')?.textContent||'待完善';const text=`体测分数预估：${score} 分（${level}）\n来源：NanNa 体测分数计算器`;try{await navigator.clipboard.writeText(text);const b=$('#shareButton');b.textContent='已复制 ✓';setTimeout(()=>b.textContent='复制结果摘要',1600)}catch{alert(text)}}
function applyTheme(theme){document.body.classList.toggle('light',theme==='light');localStorage.setItem('nanna-theme',theme);$('#themeToggle').textContent=theme==='light'?'☼':'◐'}
boot().catch(err=>{console.error(err);document.querySelector('.app-shell').innerHTML='<p>数据加载失败，请刷新页面或检查网络连接。</p>'});
