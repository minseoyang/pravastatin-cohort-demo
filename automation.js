/* The primary experience follows the input-to-output automation, not the paper. */
window.createAutomationUI = ({D,esc,go,showDialog,rawOutput,outputPanel,toast}) => {
  const $=id=>document.getElementById(id);
  const recordedQuestion='Is pravastatin use associated with short-term mortality in ICU patients with sepsis?';
  const nhis=window.NHIS_DEMO;
  const studyExamples=[
    {id:'pravastatin',area:'Drug exposure · Critical care',title:'Pravastatin in ICU sepsis',question:recordedQuestion,image:'assets/study-pravastatin.png',alt:'Unbranded medication blister pack with an ICU room softly blurred behind',connected:true,dataset:'MIMIC-IV',version:'3.1'},
    ...(nhis?[{id:'ccb-fracture',title:'Antihypertensives and Fracture Risk',question:'Among patients with hypertension, use of calcium channel blockers (CCBs) is associated with a higher risk of incident fracture compared with use of diuretics (DUs).',displayQuestion:'Do calcium channel blocker initiators have a higher risk of fracture than diuretic initiators?',description:'A claims-based study of adults with hypertension in Korea.',image:'assets/study-ccb-fracture.jpg',alt:'Medication blister pack beside a blurred wrist radiograph',connected:true,dataset:'NHIS Sample Cohort',version:'1.0'}]:[])
  ];
  if(nhis)Object.assign(D.outputs,nhis.outputs);
  const state={studyId:'pravastatin',question:recordedQuestion,draft:recordedQuestion,started:false,checkpoint:false,exampleId:null,generated:false,generating:false,genToken:0,reached:0};
  const paths=['question','strategy','cohort','dataset','analysis','results'];
  const names=['Question define','Question define','Cohort construction','Cohort dataset','Analysis','Results'];
  const norm=s=>s.toLowerCase().replace(/\bearly\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  const activeStudy=()=>studyExamples.find(ex=>ex.id===state.studyId)||studyExamples[0];
  const isNhis=()=>activeStudy().id==='ccb-fracture';
  const stagePath=(path,study=activeStudy())=>'/'+path+(study.id==='ccb-fracture'&&path!=='question'?'?study='+study.id:'');
  const matchStudy=q=>studyExamples.find(ex=>norm(ex.question)===norm(q)||(ex.displayQuestion&&norm(ex.displayQuestion)===norm(q)));
  try{const saved=sessionStorage.getItem('cohortflow-connected-question'), study=saved&&matchStudy(saved);if(study){state.studyId=study.id;state.question=saved;state.draft=saved;state.started=true;state.reached=Number(sessionStorage.getItem('cohortflow-reached'))||1;}}catch{}
  let route;
  function activateStudy(study,q){
    if(!state.started||state.studyId!==study.id)resetAll();
    Object.assign(state,{studyId:study.id,question:q,draft:q,started:true});
    try{sessionStorage.setItem('cohortflow-connected-question',q);}catch{}
  }
  function startQuestion(text,target='strategy'){
    const q=text.trim();
    if(!q){questionError('Enter a research question to begin.');return;}
    const study=matchStudy(q);
    if(!study){questionError('No recorded artifacts are connected for this question yet. Select a study from the examples.');return;}
    activateStudy(study,study.displayQuestion&&norm(q)===norm(study.displayQuestion)?study.question:q);
    go(stagePath(target,study));
  }
  function questionError(message){if($('questionError')){$('questionError').textContent=message;$('questionError').hidden=false;}else toast(message);}
  function questionDialog(){showDialog('The question that started this study',`<p class="question-quote">${esc(state.question)}</p><p class="small-note">This is the only user-provided input. The database and model assignments are preconfigured for this recorded study.</p>`,'YOUR INPUT');}
  const stepOf=[1,1,2,3,4,5],eyebrows=['QUESTION DEFINE','QUESTION DEFINE · STRATEGY AGENT','COHORT CONSTRUCTION · PLANNING & CODING AGENTS','COHORT DATASET','ANALYSIS · PLANNING & CODING AGENTS','RESULT ANALYSIS'];
  function phaseHead(index,title,subtitle,actions=''){
    return `<header class="screen-heading"><div><span class="eyebrow">${stepOf[index]} OF 5 · ${eyebrows[index]}</span><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><div class="heading-actions">${actions}</div></header>`;
  }
  function phaseFooter(index,label,path,extra='',lockReason=''){
    return `<footer class="automation-footer"><a class="button quiet" href="#${stagePath(paths[Math.max(0,index-1)])}">${index?'Previous step':'Your question'}</a><span class="automation-position">${extra||`Step ${stepOf[index]} of 5 · ${names[index]}`}</span>${path?(lockReason?`<button class="button primary" type="button" disabled title="${esc(lockReason)}">Next Step</button>`:`<a class="button primary" href="#${stagePath(path)}">Next Step</a>`):'<button class="button primary" data-restart>Home</button>'}</footer>`;
  }
  function guard(){return `<section class="screen"><header class="screen-heading"><div><span class="eyebrow">HYBRID COHORT AUTOMATION</span><h1>Start with the research question.</h1></div></header><section class="panel empty-state"><span class="empty-icon" aria-hidden="true">?</span><h2>One question starts the process.</h2><p>This replay follows the recorded study. Open it to continue to this step.</p><button class="button primary" data-open-recorded>Open the connected study</button><a class="text-button" href="#/question">Enter a research question</a></section></section>`;}
  function renderQuestionInput(example=null){return `<section class="screen question-screen ${example?'study-preview':''}">${phaseHead(0,example?'Explore this example question.':'Start with your research question.',example?'The question is available to inspect. Its recorded automation artifacts have not been connected yet.':'Your question is the starting point. The Hybrid setup and database are already configured.','<a class="button quiet" href="#/question">All study examples</a>')}<div class="question-layout"><form class="panel question-form" id="questionForm"><div class="question-form-title"><span class="eyebrow">THE ONLY INPUT FROM YOU</span><h2>${example?esc(example.title):'What do you want to investigate?'}</h2></div><div class="question-field-area"><label for="researchQuestion">Research question</label><textarea id="researchQuestion" spellcheck="false" ${example?'readonly':''} required maxlength="1200" placeholder="Describe the population, exposure, and outcome you want to study…">${esc(state.draft)}</textarea><p class="question-field-note">A short question is enough. The Strategy Agent specifies the study conditions.</p><p id="questionError" class="question-error" role="alert" hidden></p><button class="text-button" type="button" id="useConnectedQuestion">Use the connected study question</button></div><div class="question-submit"><div><span class="tag frontier-tag">${example?'Question preview':'Recorded study'}</span><p>${example?'No recorded automation run is connected for this question.':'Replay the connected artifacts for this question.'}</p></div><button class="button primary" type="submit" ${example?'disabled':''}>${example?'Replay not connected':'Start Hybrid replay'}</button></div></form><aside class="question-context"><section class="panel question-promise"><span class="eyebrow">FROM YOUR QUESTION</span><h2>${example?esc(example.title):'A specified study.<br>An ordered plan.<br>Executable code.'}</h2><p>${example?'An example research question. Choose the connected study to explore a recorded Hybrid replay.':'Follow the outputs as one Agent hands them to the next.'}</p><button class="text-button" type="button" data-process-details>What happens after I start?</button></section><section class="panel preset-card"><span class="eyebrow">PRECONFIGURED FOR THIS STUDY</span><dl><div><dt>Data environment</dt><dd>MIMIC-IV 3.1</dd></div><div><dt>Generation</dt><dd>Frontier models</dd></div><div><dt>Data access & repair</dt><dd>Local environment</dd></div></dl><span class="small-note">No database or model setup is requested from the visitor.</span></section></aside></div><div class="question-bottom"><span>Question input</span><span>Study specification</span><span>Step-by-step planning</span><span>Code & local execution</span><span>Result analysis</span></div></section>`;}
  function renderStudyGallery(){return `<section class="screen study-gallery-screen"><header class="screen-heading"><div><h1>Research Question</h1></div></header><div class="study-card-grid" aria-label="Research question examples">${studyExamples.map(ex=>`<a class="study-card" href="#${stagePath('strategy',ex)}${ex.id==='pravastatin'?'?study=pravastatin':''}" data-study-example="${ex.id}" aria-label="${esc(ex.title)}"><div class="study-card-media"><img src="${ex.image}" alt="${esc(ex.alt)}" width="768" height="512" decoding="async" fetchpriority="${ex.connected?'high':'auto'}"></div><div class="study-card-content"><h2>${esc(ex.title)}</h2><span class="study-question-label">Research question</span><p class="study-card-question">${esc(ex.displayQuestion||ex.question)}</p>${ex.description?`<p class="study-card-description">${esc(ex.description)}</p>`:'' }<div class="study-card-cta study-card-dataset"><span>${esc(ex.dataset)}</span><span>Version ${esc(ex.version)}</span></div></div></a>`).join('')}<div class="study-card empty-study-card" aria-hidden="true"></div></div></section>`;}
  function renderQuestion(){const ex=studyExamples.find(x=>x.id===route.params.get('example')&&!x.connected);if(ex){if(state.exampleId!==ex.id){state.draft=ex.question;state.exampleId=ex.id;}return renderQuestionInput(ex);}if(route.params.get('mode')==='input'){state.exampleId=null;return renderQuestionInput();}return renderStudyGallery();}
  function strategyOutput(){
    if(state.generated)return outputPanel(isNhis()?'nhisDesign':'strategy','Strategy Agent output');
    const body=state.generating
      ?`<div class="generation-wait" role="status"><span class="run-spinner" aria-hidden="true"></span><p>Strategy Agent is generating the study design…</p></div>`
      :`<div class="generation-wait"><p>Press <strong>Generation</strong> to create the Strategy Agent output.</p></div>`;
    return `<section class="panel output-panel" id="strategyOutput"><div class="automation-panel-header"><div><span class="eyebrow">OUTPUT</span><h2>Strategy Agent output</h2></div></div>${body}</section>`;
  }
  function renderStrategy() {
    return `<section class="screen automation-screen">
      ${phaseHead(1,'Strategy Agent Output',isNhis()?activeStudy().title:'',isNhis()?'<button class="button quiet" data-nhis-details="dataset">Data source</button>':'')}
      <div class="strategy-layout">
        <aside class="panel question-input-card">
          <span class="eyebrow">INPUT · YOUR QUESTION</span>
          <label class="user-question-label" for="userQuestion">Research question</label>
          <textarea class="user-question-field" id="userQuestion" readonly spellcheck="false">${esc(state.question)}</textarea>
          <button class="button primary generation-button" type="button" id="generateStrategy" ${state.generating||state.generated?'disabled':''}>${state.generating?'Generating…':'Generation'}</button>
        </aside>
        ${strategyOutput()}
      </div>
      ${phaseFooter(1,'Next Step','cohort','',state.generated?'':'Generate the study design first.')}
    </section>`;
  }
  function runStrategyGeneration(){
    if(state.generating||state.generated)return;
    const token=++state.genToken;state.generating=true;go(stagePath('strategy'));
    setTimeout(()=>{if(token!==state.genToken)return;state.generating=false;state.generated=true;if(route&&route.section==='strategy')go(stagePath('strategy'));},3000);
  }

  /* ---------- Cohort construction, cohort dataset, analysis, result ---------- */
  /* Cohort construction and Analysis share one pipeline view:
     running view (Planning Agent loading -> plan JSON, Coding Agent step by step),
     then the result view (clickable plan steps on the left, step code + outputs on the right). */
  const PIPE=(window.PIPELINE_DATA&&window.PIPELINE_DATA.cohort)||{steps:[],final:null};
  const APIPE=window.ANALYSIS_DATA||null;
  if(APIPE&&APIPE.plan)D.outputs.analysisPlan={filename:APIPE.plan.filename,url:APIPE.plan.url,text:APIPE.plan.text};
  const localData=()=>null;
  const parsePlan=key=>{try{return JSON.parse(D.outputs[key].text);}catch{return [];}};
  const cohortRun={status:'idle',selected:1,token:0};
  const analysisRun={status:'idle',selected:1,token:0};
  const datasetView={page:0,filter:'',pageSize:50};
  const fmt=n=>Number(n).toLocaleString('en-US');
  const pad=n=>String(n).padStart(2,'0');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const replayTiming={read:300,plan:520,handoff:160,write:95,output:120,complete:140};
  const firstRows=o=>o.find(x=>typeof x.rows==='number');
  const pravastatinPipes={
    cohort:{id:'cohort',phase:2,path:'cohort',next:'dataset',run:cohortRun,planKey:'cohortPlan',planSteps:parsePlan('cohortPlan'),steps:PIPE.steps,
      reading:'Reading the study design…',writing:'Writing the cohort construction plan…',
      doneText:n=>`${n} scripts generated and run · cohort built`,
      outputs:s=>[{name:s.output.table,kind:'table',exists:true,rows:s.output.rows,columns:s.output.columns}],
      where:'hosp.duckdb',local:()=>localData()||{}},
    analysis:{id:'analysis',phase:4,path:'analysis',next:'results',run:analysisRun,planKey:'analysisPlan',planSteps:APIPE?parsePlan('analysisPlan'):[],steps:APIPE?APIPE.steps:[],
      reading:'Reading the study design and cohort structure…',writing:'Writing the statistical analysis plan…',
      doneText:n=>`${n} scripts generated and run · analysis complete`,
      outputs:s=>s.outputs,
      where:'output/analysis_output',local:()=>window.SHARED_ANALYSIS||{}}
  };
  const nhisPipes=nhis&&{
    cohort:{...pravastatinPipes.cohort,run:{...cohortRun},recorded:true,planKey:'nhisCohortPlan',planSteps:parsePlan('nhisCohortPlan'),steps:nhis.cohortSteps,
      where:'NHIS · local DuckDB',outputs:s=>s.outputs,doneText:n=>`${n} saved cohort scripts`},
    analysis:{...pravastatinPipes.analysis,run:{...analysisRun},recorded:true,planKey:'nhisAnalysisPlan',planSteps:parsePlan('nhisAnalysisPlan'),steps:nhis.analysisSteps,
      where:'NHIS · local analysis',local:()=>nhis.results,doneText:n=>`${n} analysis steps · see artifact provenance`},
  };
  const pipes=()=>isNhis()?nhisPipes:pravastatinPipes;
  const resultArtifacts=()=>isNhis()?nhis.results:window.SHARED_ANALYSIS;
  const pipelineActions=P=>P.recorded?`<button class="button quiet" data-nhis-details="${P.id==='cohort'?'checkpoint':'analysis-plan'}">${P.id==='cohort'?'Checkpoint':'Analysis strategy'}</button><button class="button quiet" data-nhis-details="repair">Execution &amp; repair</button>`:'';
  function rowDone(P,s){if(P.recorded)return s.recorded?'Saved script':'Script not connected';const o=P.outputs(s),r=firstRows(o);return `✓ ${o[0]?o[0].name:''}${o.length>1?` +${o.length-1}`:''}${r?` · ${fmt(r.rows)} rows`:''}`;}

  function runView(P){
    return `<section class="screen automation-screen pipeline-screen" data-pipe-run="${P.id}">
      ${phaseHead(P.phase,'Planning Agent / Coding Agent Output','',pipelineActions(P))}
      <div class="panel pipeline-run">
        <section class="run-column" id="runPlanning">
          <div class="run-column-head"><span class="run-agent">Planning Agent</span><span class="run-badge" id="planBadge">Running</span></div>
          <p class="run-status" id="planStatus"><span class="run-spinner" aria-hidden="true"></span><span>${esc(P.reading)}</span></p>
          <div class="run-output" id="planOutput"></div>
        </section>
        <section class="run-column waiting" id="runCoding">
          <div class="run-column-head"><span class="run-agent">Coding Agent · ${P.recorded?'saved artifacts':'local execution'}</span><span class="run-badge" id="codeBadge">Waiting</span></div>
          <p class="run-status" id="codeStatus"><span>Waits for the plan.</span></p>
          <ol class="run-list" id="codeList"></ol>
        </section>
      </div>
      ${phaseFooter(P.phase,'Next Step',P.next,'','Available when all outputs are ready.')}
    </section>`;
  }
  async function playRun(P){
    const R=P.run,token=++R.token,out=D.outputs[P.planKey];
    const alive=()=>token===R.token&&document.querySelector(`[data-pipe-run="${P.id}"]`);
    const status=(id,text,busy)=>{$(id).innerHTML=`${busy?'<span class="run-spinner" aria-hidden="true"></span>':'<span class="run-check" aria-hidden="true">✓</span>'}<span>${text}</span>`;};
    await sleep(replayTiming.read);if(!alive())return;
    status('planStatus',esc(P.writing),true);
    await sleep(replayTiming.plan);if(!alive())return;
    status('planStatus',esc(out.filename),false);
    $('planOutput').innerHTML=rawOutput(out.text,'Planning Agent output');
    await sleep(replayTiming.handoff);if(!alive())return;
    $('planBadge').textContent='Done';$('planBadge').classList.add('done');
    $('runCoding').classList.remove('waiting');$('codeBadge').textContent='Running';
    for(const s of P.steps){
      if(!alive())return;
      status('codeStatus',`Step ${pad(s.step)} of ${pad(P.steps.length)}`,true);
      $('codeList').insertAdjacentHTML('beforeend',`<li id="codeRow${s.step}"><span class="run-index">${pad(s.step)}</span><span class="run-file">${esc(s.file)}</span><span class="run-state">${P.recorded?'Loading script…':'Writing code…'}</span></li>`);
      $('codeList').lastElementChild.scrollIntoView({block:'nearest'});
      await sleep(replayTiming.write);if(!alive())return;
      $('codeRow'+s.step).querySelector('.run-state').textContent=P.recorded?'Checking saved artifacts…':'Running locally…';
      await sleep(replayTiming.output);if(!alive())return;
      const st=$('codeRow'+s.step).querySelector('.run-state');st.textContent=rowDone(P,s);st.classList.add('done');
    }
    status('codeStatus',esc(P.doneText(P.steps.length)),false);
    $('codeBadge').textContent='Done';$('codeBadge').classList.add('done');
    await sleep(replayTiming.complete);if(!alive())return;
    R.status='done';go(stagePath(P.path));
  }

  function planJsonPanel(P,selected){
    const out=D.outputs[P.planKey];
    return `<section class="panel pipeline-plan">
      <header class="automation-panel-header"><div><span class="eyebrow">PLANNING AGENT · OUTPUT</span><h2>${esc(out.filename)}</h2></div><a class="button small" href="${esc(out.url)}" download data-download="output:${P.planKey}">Download</a></header>
      <div class="plan-json scroll-region">${P.planSteps.length?P.planSteps.map((s,i)=>`<button type="button" class="plan-json-step ${selected===i+1?'active':''}" data-pipe="${P.id}" data-step="${i+1}" aria-pressed="${selected===i+1}"><span class="plan-json-index">Step ${pad(i+1)}</span><pre>${esc(JSON.stringify(s,null,2))}</pre></button>`).join(''):'<p class="small-note">The plan file could not be read.</p>'}</div>
    </section>`;
  }
  function previewTable(p,total){
    return `<div class="output-preview scroll-region"><table><thead><tr>${p.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${p.rows.map(r=>`<tr>${r.map(v=>`<td>${esc(String(v??''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="output-local-note">${typeof total==='number'&&p.rows.length<total?`First ${p.rows.length} of ${fmt(total)} rows`:`${fmt(p.rows.length)} rows`} · aggregate results</p>`;
  }
  const localOnly='<p class="output-local-note">Shown only in the local version (MIMIC-IV derived data).</p>';
  function outputBlock(P,o){
    const L=P.local();
    const meta=o.kind==='png'?'Figure':o.kind==='xlsx'?`Excel workbook · ${(o.sheets||[]).length} sheets`:o.kind==='json'?'JSON':typeof o.rows==='number'?`${fmt(o.rows)} rows × ${(o.columns||[]).length} columns`:'';
    let body='';
    if(o.exists===false)body='<p class="output-local-note">A run-linked output is not connected.</p>';
    else if(o.kind==='png')body=L.images&&L.images[o.name]?`<figure class="output-figure"><img src="${esc(L.images[o.name])}" alt="${esc(o.name)}" loading="lazy"></figure><p class="output-local-note">local only</p>`:localOnly;
    else if(o.kind==='json')body=L.texts&&L.texts[o.name]?`<pre class="output-preview output-text scroll-region"><code>${esc(L.texts[o.name])}</code></pre><p class="output-local-note">local only</p>`:localOnly;
    else if(o.kind==='xlsx')body=`<div class="output-columns open-columns"><div>${(o.sheets||[]).map(n=>`<span>${esc(n)}</span>`).join('')}</div></div>`;
    else{const p=L.previews&&L.previews[o.name];body=p?previewTable(p,o.rows):'<p class="output-local-note">Patient-level rows are local only</p>';}
    return `<div class="code-output-block">
        <div class="code-output-head"><span class="eyebrow">OUTPUT · ${esc(P.where)}</span><strong>${esc(o.name)}</strong><span>${esc(meta)}</span></div>
        ${o.columns&&o.columns.length?`<details class="output-columns"><summary>Columns</summary><div>${o.columns.map(c=>`<span title="${esc(c.type||'')}">${esc(c.name)}</span>`).join('')}</div></details>`:''}
        ${body}
      </div>`;
  }
  function codePanel(P,selected){
    const s=P.steps.find(x=>x.step===selected)||P.steps[0];
    if(!s)return '<section class="panel pipeline-code empty-state"><h2>Code not connected yet</h2></section>';
    return `<section class="panel pipeline-code">
      <header class="automation-panel-header"><div><span class="eyebrow">CODING AGENT · OUTPUT</span><h2>${esc(s.file)}</h2>${P.recorded?`<span class="small-note">${esc(s.title)}</span>`:''}</div>
        <label class="sr-only" for="pipeStepSelect">Step</label><select class="select-control" id="pipeStepSelect" data-pipe="${P.id}">${P.steps.map(x=>`<option value="${x.step}" ${x.step===s.step?'selected':''}>Step ${pad(x.step)} · ${esc(x.file)}</option>`).join('')}</select></header>
      <pre class="code-view scroll-region"><code>${esc(s.code||'Not connected yet')}</code></pre>
      <section class="code-output scroll-region">${s.note?`<p class="small-note step-evidence">${esc(s.note)}</p>`:''}${P.outputs(s).map(o=>outputBlock(P,o)).join('')}</section>
    </section>`;
  }
  function renderPipeline(P){
    if(!P.steps.length)return `<section class="screen automation-screen pipeline-screen">${phaseHead(P.phase,'Planning Agent / Coding Agent Output','')}<section class="panel empty-state"><h2>Not connected yet</h2><p>The plan and code for this step have not been exported. Run build_demo_data.py.</p></section>${phaseFooter(P.phase,'Next Step',P.next,'','Outputs are not connected.')}</section>`;
    if(P.run.status!=='done'){P.run.status='running';return runView(P);}
    return `<section class="screen automation-screen pipeline-screen">
      ${phaseHead(P.phase,'Planning Agent / Coding Agent Output','',pipelineActions(P))}
      <div class="pipeline-final">${planJsonPanel(P,P.run.selected)}${codePanel(P,P.run.selected)}</div>
      ${phaseFooter(P.phase,'Next Step',P.next)}
    </section>`;
  }
  function renderCohort(){return renderPipeline(pipes().cohort);}
  function selectStep(P,n){
    P.run.selected=n;
    document.querySelectorAll(`[data-pipe="${P.id}"][data-step]`).forEach(b=>{const on=Number(b.dataset.step)===n;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);if(on)b.scrollIntoView({block:'nearest'});});
    const old=document.querySelector('.pipeline-code');if(old){old.outerHTML=codePanel(P,n);bindCodePanel();}
  }
  function bindCodePanel(){const sel=$('pipeStepSelect');if(sel)sel.addEventListener('change',()=>selectStep(pipes()[sel.dataset.pipe],Number(sel.value)));}

  function renderDataset(){
    return `<section class="screen automation-screen dataset-screen">
      ${phaseHead(3,'Cohort Dataset','',isNhis()?'<button class="button quiet" data-nhis-details="dataset">Data source</button>':'')}
      <div class="dataset-layout">
        <section class="panel dataset-viewer">
          <div class="dataset-toolbar">
            <input class="custom-field dataset-filter" id="datasetFilter" type="search" placeholder="Filter columns…" value="${esc(datasetView.filter)}" aria-label="Filter columns">
            <span class="dataset-range" id="datasetRange"></span>
            <div class="dataset-pager"><button class="button small" type="button" id="datasetPrev">Previous</button><button class="button small" type="button" id="datasetNext">Next</button></div>
          </div>
          <div class="dataset-grid">
            <div class="dataset-table scroll-region" id="datasetTable"></div>
            <p class="dataset-privacy-note" id="datasetPrivacyNote"><span>Patient-level rows are local only</span></p>
          </div>
        </section>
      </div>
      ${phaseFooter(3,'Open analysis','analysis')}
    </section>`;
  }
  function drawDataset(){
    const {columns=[],rows=0}=(isNhis()?nhis.final:PIPE.final)||{};
    const {pageSize,filter}=datasetView;
    const term=filter.trim().toLowerCase();
    const visibleColumns=columns.filter(column=>column.toLowerCase().includes(term));
    const pageCount=Math.max(1,Math.ceil(rows/pageSize));
    datasetView.page=Math.max(0,Math.min(datasetView.page,pageCount-1));
    const start=datasetView.page*pageSize;
    const end=Math.min(start+pageSize,rows);
    const blankCells='<td></td>'.repeat(visibleColumns.length);
    const blankRows=Array.from({length:end-start},(_,index)=>
      `<tr><th scope="row" class="row-no">${fmt(start+index+1)}</th>${blankCells}</tr>`).join('');
    $('datasetTable').innerHTML=`<table aria-describedby="datasetPrivacyNote"><thead><tr><th scope="col" class="row-no">#</th>${visibleColumns.map(column=>`<th scope="col">${esc(column)}</th>`).join('')}</tr></thead><tbody>${blankRows}</tbody></table>`;
    $('datasetRange').textContent=`Rows ${fmt(rows?start+1:0)}–${fmt(end)} of ${fmt(rows)} · ${visibleColumns.length} of ${columns.length} columns`;
    $('datasetPrev').disabled=datasetView.page===0;
    $('datasetNext').disabled=datasetView.page===pageCount-1;
  }

  function renderAnalysis(){return renderPipeline(pipes().analysis);}
  /* Browse the shared result tables and figures. */
  const resultView={file:null,sheet:null};
  const kb=n=>typeof n==='number'?`${fmt(Math.max(1,Math.round(n/1024)))} KB`:'';
  const colName=i=>{let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;};
  const isNum=v=>v!==''&&/^-?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(v);
  const general=v=>{const n=Number(v);if(Number.isInteger(n))return String(n);return String(Number(n.toPrecision(10)));};
  function sheetGrid(rows){
    const width=Math.max(1,...rows.map(r=>r.length));
    return `<table class="xl-grid"><thead><tr><th class="xl-corner"></th>${Array.from({length:width},(_,i)=>`<th>${colName(i)}</th>`).join('')}</tr></thead><tbody>${rows.map((r,ri)=>`<tr><th>${ri+1}</th>${Array.from({length:width},(_,i)=>{const v=r[i]??'';return isNum(v)?`<td class="num" title="${esc(v)}">${esc(general(v))}</td>`:`<td title="${esc(v)}">${esc(v)}</td>`;}).join('')}</tr>`).join('')}</tbody></table>`;
  }
  function filePane(o){
    const L=resultArtifacts();
    const bar=`<header class="file-bar"><span class="file-badge ${o.kind}">${esc(o.kind.toUpperCase())}</span><strong>${esc(o.label)}</strong><span class="file-size">${kb(o.bytes)}</span><a class="button small" href="${esc(o.url||('shared-results/'+o.name))}" download>Download</a></header>`;
    const note=o.note?`<p class="result-provenance">${esc(o.note)}</p>`:'';
    if(o.kind==='csv'){
      const table=L.previews[o.name];
      return `${bar}${note}<div class="xl-sheet scroll-region">${sheetGrid([table.columns,...table.rows])}</div>`;
    }
    if(o.kind==='png'){
      const src=L.images&&L.images[o.name];
      return `${bar}${note}${src?`<div class="img-viewer scroll-region"><img src="${esc(src)}" alt="${esc(o.name)}" id="resultImage"></div><footer class="file-foot" id="resultImageInfo">PNG</footer>`:localOnly}`;
    }
    return bar+localOnly;
  }
  function renderResults(){
    const files=resultArtifacts()?.files||[];
    if(!files.length)return `<section class="screen automation-screen"><header class="screen-heading"><div><h1>Results</h1></div></header><section class="panel empty-state"><h2>Not connected yet</h2><p>The analysis outputs have not been exported. Run build_demo_data.py.</p></section>${phaseFooter(5,'','')}</section>`;
    const cur=files.find(o=>o.name===resultView.file)||files[0];resultView.file=cur&&cur.name;
    return `<section class="screen automation-screen results-screen">
      <header class="screen-heading"><div><h1>Results</h1></div></header>
      <div class="results-layout">
        <nav class="panel output-files" aria-label="Output files">
          <ul>${files.map(o=>`<li><button type="button" class="output-file ${o.name===resultView.file?'active':''}" aria-pressed="${o.name===resultView.file}" data-result-file="${esc(o.name)}"><span class="file-badge ${o.kind}">${esc(o.kind.toUpperCase())}</span><span class="output-file-name">${esc(o.label)}</span><span class="file-size">${kb(o.bytes)}</span></button></li>`).join('')}</ul>
        </nav>
        <section class="panel file-pane" id="filePane">${cur?filePane(cur):''}</section>
      </div>
      ${phaseFooter(5,'','')}
    </section>`;
  }
  function showResultFile(){
    const o=resultArtifacts().files.find(x=>x.name===resultView.file);
    document.querySelectorAll('[data-result-file]').forEach(b=>{const on=b.dataset.resultFile===resultView.file;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
    $('filePane').innerHTML=filePane(o);bindResultPane();
  }
  function bindResultPane(){
    document.querySelectorAll('[data-result-sheet]').forEach(b=>b.addEventListener('click',()=>{resultView.sheet=b.dataset.resultSheet;showResultFile();}));
    const img=$('resultImage');if(img){const o=resultArtifacts().files.find(x=>x.name===resultView.file);const info=()=>{$('resultImageInfo').textContent=`PNG · ${img.naturalWidth} × ${img.naturalHeight} px · ${kb(o.bytes)}`;};if(img.complete)info();else img.addEventListener('load',info);img.addEventListener('click',()=>{const v=img.parentElement,on=v.classList.toggle('actual');$('resultImageInfo').textContent=`PNG · ${img.naturalWidth} × ${img.naturalHeight} px · ${kb(o.bytes)} · ${on?'100%':'fit'}`;});}
  }
  function bindPipeline(){
    const runEl=document.querySelector('[data-pipe-run]');
    if(runEl){const P=pipes()[runEl.dataset.pipeRun];if(P.run.status==='running')playRun(P);}
    document.querySelectorAll('[data-result-file]').forEach(b=>b.addEventListener('click',()=>{resultView.file=b.dataset.resultFile;resultView.sheet=null;showResultFile();}));
    if($('filePane'))bindResultPane();
    document.querySelectorAll('[data-pipe][data-step]').forEach(b=>b.addEventListener('click',()=>selectStep(pipes()[b.dataset.pipe],Number(b.dataset.step))));
    bindCodePanel();
    if($('datasetTable')){
      drawDataset();
      $('datasetFilter').addEventListener('input',()=>{datasetView.filter=$('datasetFilter').value;drawDataset();});
      $('datasetPrev').addEventListener('click',()=>{datasetView.page--;drawDataset();$('datasetTable').scrollTop=0;});
      $('datasetNext').addEventListener('click',()=>{datasetView.page++;drawDataset();$('datasetTable').scrollTop=0;});
    }
  }
  function nhisDetails(detail){
    const openArtifact=key=>{
      const out=D.outputs[key];
      return `<details class="recorded-detail"><summary>${esc(out.filename)}</summary><a class="button small" href="${esc(out.url)}" download>Download</a>${rawOutput(out.text,out.filename)}</details>`;
    };
    if(detail==='dataset'){
      showDialog('NHIS Sample Cohort, version 1.0',`<p>The Korean National Health Insurance Service Sample Cohort links insurance eligibility and demographic records with medical claims, diagnoses, and dispensed prescriptions. The study uses drug and comorbidity mapping tables to classify exposure and baseline factors.</p><dl class="study-facts"><div><dt>Population</dt><dd>Adults aged 20 or older with hypertension</dd></div><div><dt>Initiation window</dt><dd>2003–2012 · 365-day baseline</dd></div><div><dt>Exposure</dt><dd>Calcium channel blocker vs diuretic initiation</dd></div><div><dt>Outcome</dt><dd>First recorded incident fracture after study entry</dd></div><div><dt>Saved cohort</dt><dd>${fmt(nhis.summary.rows)} rows · ${fmt(nhis.summary.cols)} columns</dd></div></dl><p class="small-note">Patient-level rows are local only</p>`,'DATA SOURCE');
    }else if(detail==='checkpoint'){
      showDialog('Cohort planning checkpoint',`<p>The initial plan contains 11 steps. The saved checklist covers 33 checks, and the feedback selects two items for revision. The revised 10-step plan was further decomposed into the 21-step implementation plan used on this page.</p><ul><li>Verify the ≥20-year age threshold using the age-group field.</li><li>Set follow-up initiation to the index date for eligible participants.</li></ul>${['nhisInitialPlan','nhisChecklist','nhisFeedback','nhisRevisedPlan','nhisCohortPlan'].map(openArtifact).join('')}`,'CHECKPOINT OUTPUT');
    }else if(detail==='analysis-plan'){
      showDialog('Statistical analysis strategy',`<p>The stored plan specifies data preparation, pre-match balance, propensity-score estimation, nearest-neighbor matching, post-match balance, Kaplan–Meier estimation, Cox modeling, and proportional-hazards checks. The saved results span multiple branches. Each result identifies its corresponding artifact.</p>${['nhisAnalysisStrategy','nhisAnalysisPlan'].map(openArtifact).join('')}`,'PLANNING AGENT OUTPUT');
    }else{
      showDialog('Local execution and repair',`<dl class="study-facts"><div><dt>Strategy and planning</dt><dd>The recorded workflow calls Qwen 3.6 locally.</dd></div><div><dt>Coding</dt><dd>The runner calls Gemma 4 locally. Several analysis filenames retain a qwen suffix.</dd></div><div><dt>Execution</dt><dd>The scripts use local DuckDB and Python. The site replays the saved plan and code.</dd></div><div><dt>Repair</dt><dd>The runner passes execution errors back to local Gemma 4 and retries. Run-linked logs and per-attempt repair outputs are not connected.</dd></div></dl><p class="small-note">Local drive prefixes in the displayed source are replaced with local-study.</p>`,'EXECUTION & REPAIR');
    }
  }
  /* Home: every generated result goes back to its initial state. */
  function resetAll(){
    Object.assign(state,{studyId:'pravastatin',reached:0,question:recordedQuestion,draft:recordedQuestion,started:false,exampleId:null,generated:false,generating:false});state.genToken++;
    for(const R of [cohortRun,analysisRun,...Object.values(nhisPipes||{}).map(P=>P.run)]){R.token++;Object.assign(R,{status:'idle',selected:1});}Object.assign(datasetView,{page:0,filter:''});resultView.file=null;resultView.sheet=null;
    try{sessionStorage.removeItem('cohortflow-connected-question');sessionStorage.removeItem('cohortflow-reached');}catch{}
  }
  /* Top-nav steps unlock one by one as each screen is reached; Home locks them again. */
  const stepIndex={strategy:1,cohort:2,dataset:3,analysis:4,results:5};
  function markReached(section){const i=stepIndex[section];if(!i||i<=state.reached)return;state.reached=i;try{sessionStorage.setItem('cohortflow-reached',String(i));}catch{}}
  function render(r){route=r;
    const study=studyExamples.find(ex=>ex.id===r.params.get('study'));
    if(r.section!=='question'&&study&&(!state.started||state.studyId!==study.id))activateStudy(study,study.question);
    if(r.section!=='question'&&!state.started)return guard();markReached(r.section);return ({question:renderQuestion,strategy:renderStrategy,cohort:renderCohort,dataset:renderDataset,analysis:renderAnalysis,results:renderResults}[r.section]||renderQuestion)();}
  function bind(){
    document.querySelectorAll('[data-study-example]').forEach(card=>card.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();const ex=studyExamples.find(x=>x.id===card.dataset.studyExample);startQuestion(ex.question);}));
    document.querySelectorAll('[data-current-question]').forEach(b=>b.addEventListener('click',questionDialog));
    document.querySelectorAll('[data-open-recorded]').forEach(b=>b.addEventListener('click',()=>{const target=route&&paths.includes(route.section)&&route.section!=='question'?route.section:'strategy';startQuestion(activeStudy().question,target);}));
    document.querySelectorAll('[data-restart]').forEach(b=>b.addEventListener('click',()=>{resetAll();go('/question');}));
    if($('researchQuestion'))$('researchQuestion').addEventListener('input',()=>{state.draft=$('researchQuestion').value;if($('questionError'))$('questionError').hidden=true;});
    if($('questionForm'))$('questionForm').addEventListener('submit',e=>{e.preventDefault();startQuestion($('researchQuestion').value);});
    if($('useConnectedQuestion'))$('useConnectedQuestion').addEventListener('click',()=>{state.draft=recordedQuestion;if(route.params.get('example')){state.exampleId=null;go('/question?mode=input');return;}$('researchQuestion').value=recordedQuestion;$('questionError').hidden=true;$('researchQuestion').focus();});
    document.querySelectorAll('[data-process-details]').forEach(b=>b.addEventListener('click',()=>showDialog('A question becomes an analysis task.','<h3>Strategy Agent</h3><p>Specifies the research question as population, exposure, comparator, outcome, timing, and analysis conditions.</p><h3>Planning Agent</h3><p>Uses that specification to create an ordered plan, with an input, operation, and output for each step.</p><h3>Coding, local execution & repair</h3><p>Implements each plan operation as code. Execution uses local data; a local Repair Agent handles runtime errors. A consistency Checkpoint is optional.</p><h3>Result analysis</h3><p>Shows the final outputs for the original question. Missing records remain clearly marked.</p><p class="small-note">This demo replays connected artifacts. It does not submit new model calls or run database analysis.</p>','AUTOMATION PROCESS')));
    document.querySelectorAll('[data-input-design]').forEach(b=>b.addEventListener('click',()=>showDialog('The study design passed to Planning',rawOutput(D.outputs.strategy.text,'Strategy Agent output'),'STRATEGY OUTPUT · PLANNING INPUT')));
    if($('generateStrategy'))$('generateStrategy').addEventListener('click',runStrategyGeneration);
    document.querySelectorAll('[data-nhis-details]').forEach(button=>button.addEventListener('click',()=>nhisDetails(button.dataset.nhisDetails)));
    bindPipeline();
  }
  function primaryForArtifact(id){return id==='strategy'||id==='components'?'question':/^analysis/.test(id)?'analysis':id==='results'?'results':'cohort';}
  return{render,bind,resetAll,stagePath,reached:()=>state.started?state.reached:0,paths,names,primaryForArtifact,question:()=>state.question,started:()=>state.started};
};
