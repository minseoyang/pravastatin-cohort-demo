/* The primary experience follows the input-to-output automation, not the paper. */
window.createAutomationUI = ({D,esc,go,showDialog,rawOutput,outputPanel,toast}) => {
  const $=id=>document.getElementById(id);
  const recordedQuestion='Is pravastatin use associated with short-term mortality in ICU patients with sepsis?';
  const nhis=window.NHIS_DEMO;
  const studyExamples=[
    {id:'pravastatin',area:'Drug exposure · Critical care',title:'Pravastatin in ICU sepsis',question:recordedQuestion,image:'assets/study-pravastatin.svg',alt:'Illustration of an ICU monitor, a survival curve, and a medication blister pack',connected:true,dataset:'MIMIC-IV',version:'3.1'},
    ...(nhis?[{id:'ccb-fracture',title:'Antihypertensives and Fracture Risk',question:'Among patients with hypertension, use of calcium channel blockers (CCBs) is associated with a higher risk of incident fracture compared with use of diuretics (DUs).',displayQuestion:'Do calcium channel blocker initiators have a higher risk of fracture than diuretic initiators?',description:'A claims-based study of adults with hypertension in Korea.',image:'assets/study-ccb-fracture.svg',alt:'Illustration of a wrist radiograph with a fracture, a claims record, and two medication groups',connected:true,dataset:'NHIS Sample Cohort',version:'1.0'}]:[])
  ];
  if(nhis)Object.assign(D.outputs,nhis.outputs);
  const state={studyId:'pravastatin',question:recordedQuestion,draft:recordedQuestion,started:false,checkpoint:false,exampleId:null,generated:false,generating:false,genToken:0,reached:0,analysisDataset:''};
  const paths=['question','strategy','cohort','dataset','analysis','results','run'];
  const names=['Study examples','Strategy Agent','Preprocessing','Cohort Dataset','Analysis','Results','Live run'];
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

  const workflowStages=[
    {id:'strategy',title:'Strategy Agent'},
    {id:'planning',title:'Planning Agent'},
    {id:'coding',title:'Coding Agent'},
    {id:'execution',title:'Execution & Repair Agent'},
    {id:'outputs',title:'Outputs: cohort dataset & results'}
  ];
  const systemFeatures=[
    {id:'handoffs',title:'Agent handoffs',hint:'Question to results',description:'You enter one research question. Four AI agents then carry the study forward, much like a research team: the Strategy Agent writes the protocol, the Planning Agent lists the steps, the Coding Agent writes the programs, and the Execution & Repair Agent runs them. Every handoff leaves a document or file you can open and check.'},
    {id:'local',title:'Patient data protection',hint:'Who sees what',description:'Before any information is given to an AI model, it is graded by sensitivity: general knowledge (Level 0), the database structure (Level 1), summary numbers (Level 2), and individual patient records (Level 3). Anything that could reveal patient data goes only to an AI model running inside the institution, so the study can be automated without sending records outside.'},
    {id:'review',title:'Hybrid framework',hint:'Large + local AI models',description:'Large commercial AI models write better plans and code, but cannot be given patient data. Small AI models installed locally can work with the data, but are less capable. The Hybrid framework uses each where it fits: large models for the protocol, plans, and code; local models for running and fixing the code. In our tests it completed the whole study in 8 of 10 runs, compared with 6 of 10 when everything ran locally.'}
  ];
  const workflowGuides={
    strategy:{
      facts:null,
      description:'Reads the research question and writes a study protocol, as an epidemiologist would before touching any data.',
      roles:[
        ['What it writes','The study population and eligibility criteria, the drug exposure and the comparison group, the outcome, the follow-up period, and the planned statistical analysis.'],
        ['Why it matters','The protocol is the reference for every later step. Each plan and program is checked against it, so the study answers the question that was asked.']
      ],
      input:'Your research question',output:'A study protocol'
    },
    planning:{
      facts:[['Quality check','A checkpoint can compare each plan with the protocol and send it back if a criterion is missing or changed']],
      description:'Turns the protocol into a numbered list of concrete steps, like a methods section written before the work begins.',
      roles:[
        ['Preprocessing: building the cohort','Lists each step needed to assemble the study population: find eligible patients, apply the exclusion criteria, define drug exposure within the time window, define the outcome, and collect baseline characteristics.'],
        ['Analysis','Lists the analysis steps: compare baseline characteristics, balance the groups (for example with propensity score matching), fit survival models, and run sensitivity analyses.']
      ],
      input:'The study protocol and the database structure',output:'Two step-by-step plans: one for preprocessing, one for the analysis'
    },
    coding:{
      facts:null,
      description:'Writes a short computer program for each planned step.',
      roles:[
        ['Preprocessing: building the cohort','Each program pulls the records it needs from the hospital database and saves a table. The last one produces the study cohort, one row per patient.'],
        ['Analysis','Each program carries out one part of the statistical analysis and saves the estimates, tables, and figures.']
      ],
      input:'A step-by-step plan',output:'One program for each planned step'
    },
    execution:{
      facts:null,
      description:'Runs the programs on the study data, and fixes them when they fail.',
      roles:[
        ['Running the programs','Each program runs on the study database, in order, both for building the cohort and for the analysis.'],
        ['Fixing errors','When a program fails, the Repair Agent reads the error message, corrects the code, and runs it again, up to a set number of attempts.'],
        ['Optional checkpoint','Before any code is written, a reviewer compares each plan with the protocol and flags criteria that were dropped or changed.']
      ],
      input:'The programs and the study database',output:'The study cohort and the analysis results'
    },
    outputs:{
      facts:[['Study cohort','Patient-level records. They stay inside the institution.'],['Results','Summary numbers and figures only, reviewed before sharing because very small groups could identify patients.']],
      description:'What you get at the end: the study cohort, and the results that answer the research question.',
      roles:[
        ['Study cohort','One row per eligible patient, with the exposure group, the outcome, follow-up time, and baseline characteristics. The AI that plans the analysis sees only the list of variables, never the rows.'],
        ['Step-by-step tables','Each preprocessing step saves a table, so you can see how many patients remain after each criterion, like a patient flow diagram.'],
        ['Results','Effect estimates such as hazard ratios with 95% confidence intervals, balance checks between the groups, and survival curves. Each file shows which step produced it.']
      ],
      input:'Everything the programs produced',output:'A study cohort kept locally, and shareable summary results'
    }
  };
  const guideAlias={question:'strategy',cohort:'planning',analysis:'planning',results:'outputs'};
  const guideId=id=>workflowGuides[id]?id:guideAlias[id]||'strategy';
  const workflowMaps={
    cohort:{
      input:'Study design and database schema',
      planTask:'Turn eligibility, exposure, and outcome rules into ordered tasks.',
      plan:'Preprocessing plan',
      codeTask:'Write scripts that query and assemble the cohort.',
      code:'Preprocessing scripts',
      output:'Cohort Dataset',
      execution:'Scripts run locally to build the dataset. The Repair Agent handles runtime errors as needed.'
    },
    analysis:{
      input:'Study design and selected cohort dataset',
      planTask:'Choose the comparisons, statistical models, and checks to run.',
      plan:'Statistical analysis plan',
      codeTask:'Write scripts to fit the models and produce tables and figures.',
      code:'Analysis scripts',
      output:'Results',
      execution:'Scripts run locally to produce estimates and figures. The Repair Agent handles runtime errors as needed.'
    }
  };
  let featureId='handoffs';
  let introWorkflow='strategy';
  let introPaused=false;
  const introOrder=['strategy','planning','coding','execution','outputs'];
  const INTRO_SLIDE_SECONDS=9;
  const phaseFor=section=>({strategy:'question',dataset:'cohort'}[section]||section);
  const guidePath=id=>'/guide/'+id;

  function renderWorkflowMap(id,current='',detailed=false){
    const map=workflowMaps[id];
    const roles=workflowGuides[id].roles;
    const step=key=>key===current?' class="workflow-map-current" aria-current="step"':'';
    const status=key=>key===current?'<span class="workflow-map-status">Current step</span>':'';
    const agent=(key,title,task,output)=>`<li${step(key)}><strong>${title}</strong>${status(key)}<p>${task}</p><div class="workflow-map-product"><span>Produces</span>${output}</div></li>`;
    return `<div class="workflow-map">
      <div class="workflow-map-edge"><div${step('input')}><span>Input</span><strong>${map.input}</strong>${status('input')}</div></div>
      <ol class="workflow-map-agents">
        ${agent('planning',roles[0][0],detailed?roles[0][1]:map.planTask,map.plan)}
        ${agent('coding',roles[1][0],detailed?roles[1][1]:map.codeTask,map.code)}
      </ol>
      <div class="workflow-map-edge"><div${step('output')}><span>Output</span><strong>${map.output}</strong>${status('output')}</div></div>
      <p class="workflow-map-execution">${map.execution}</p>
    </div>`;
  }
  function currentWorkflowStep(section){
    if(!state.started)return '';
    if(section==='dataset')return 'output';
    if(section==='analysis'&&(!state.analysisDataset||!route.detail))return 'input';
    return route.detail==='coding'&&pipes()[section].run.planReady?'coding':'planning';
  }
  function renderWorkflowPreview(stage,content,{full,selected,section,unlocked,position}){
    const previewId='workflow-preview-'+stage.id;
    const current=!full&&selected?currentWorkflowStep(section):'';
    const stateAttrs=full
      ?`data-intro-workflow="${stage.id}" aria-pressed="${selected}" aria-controls="introWorkflowDetail ${previewId}"`
      :`${selected?'aria-current="step"':''} aria-controls="${previewId}"`;
    const link=!full&&!selected&&unlocked
      ?`<a class="button small" href="#${stagePath(stage.id)}">Open ${stage.title}</a>`:'';
    return `<li class="agent-flow-item workflow-preview-item" style="--workflow-position:${position}%" data-workflow-preview="${stage.id}">
      <button type="button" class="agent-flow-step" ${stateAttrs} aria-expanded="false">
        ${content}<i class="workflow-disclosure" aria-hidden="true"></i>
      </button>
      <div class="workflow-preview" id="${previewId}" hidden>
        <section class="workflow-preview-panel" aria-label="${stage.title} agent flow">
          <h2>${stage.title}</h2>
          ${renderWorkflowMap(stage.id,current)}
          ${link}
        </section>
      </div>
    </li>`;
  }
  function workflowStrip(section,mode){
    const full=mode==='intro',replay=mode==='replay';
    const active=full?introWorkflow:phaseFor(section);
    const limit=replay?navigationLimit(section):0;
    const stages=full?workflowStages:workflowStages.filter(stage=>stage.id!=='execution');
    const help=replay&&paths.indexOf(section)>0?`<button class="text-button workflow-help" type="button" data-stage-guide="${active}" aria-haspopup="dialog">Stage guide</button>`:'';
    return `<nav class="workflow-nav ${full?'workflow-nav-overview':'workflow-nav-compact'}" aria-label="Workflow">
      <div class="workflow-nav-heading"><span>Workflow</span>${help}</div>
      <ol class="agent-flow ${full?'agent-flow-preview':'agent-flow-compact'}">
        ${stages.map((stage,index)=>{
          const selected=active===stage.id;
          const target=stage.id==='question'?'strategy':stage.id;
          const unlocked=paths.indexOf(target)<=limit;
          const content=`
            <svg viewBox="0 0 24 24" aria-hidden="true">${stage.icon}</svg>
            <span class="agent-flow-label">${stage.title}</span>
`;
          if(false&&workflowMaps[stage.id]&&replay){
            return renderWorkflowPreview(stage,content,{full,selected,section,unlocked,position:(index+.5)/stages.length*100});
          }
          if(full)return `<li class="agent-flow-item"><button type="button" class="agent-flow-step" data-intro-workflow="${stage.id}" aria-controls="introWorkflowDetail" aria-pressed="${selected}">${content}</button></li>`;
          const current=selected?'aria-current="step"':'';
          if(replay&&(selected||!unlocked)){
            return `<li class="agent-flow-item"><span class="agent-flow-step" ${current||'aria-disabled="true"'}>${content}</span></li>`;
          }
          const href=replay?stagePath(target):guidePath(stage.id);
          return `<li class="agent-flow-item"><a href="#${href}" class="agent-flow-step" ${current}>${content}</a></li>`;
        }).join('')}
      </ol>
    </nav>`;
  }
  /* ---------- Agent journey: the whole flow on one bar ---------- */
  const journeyGroups=[
    {id:'input',label:'Input'},
    {id:'design',label:'Study design'},
    {id:'prep',label:'Preprocessing phase'},
    {id:'handoff',label:'Output'},
    {id:'analysis',label:'Analysis phase'},
    {id:'output',label:'Output'}
  ];
  const journeyNodes=[
    {id:'question',group:'input',kind:'io',title:'Research question',sub:'Your input',guide:'strategy',href:'',task:'The only input from you',input:'Your idea',output:'Research question'},
    {id:'strategy',group:'design',kind:'agent',title:'Strategy Agent',sub:'Study design',guide:'strategy',href:'strategy',task:'Writes the study protocol from your question',input:'Research question',output:'Study protocol'},
    {id:'pPlan',group:'prep',kind:'agent',title:'Planning Agent',sub:'Preprocessing plan',guide:'planning',href:'cohort',task:'Lists the steps to build the study cohort',input:'Protocol + database structure',output:'Preprocessing plan'},
    {id:'pCode',group:'prep',kind:'agent',title:'Coding Agent',sub:'One script per task',guide:'coding',href:'cohort/coding',task:'Writes one program per step',input:'Preprocessing plan',output:'Study cohort'},
    {id:'pRun',group:'prep',kind:'local',title:'Run & repair',sub:'Runs and fixes',guide:'execution',href:'cohort/coding',task:'Runs the programs and fixes errors',input:'Programs + study data',output:'Step-by-step tables'},
    {id:'dataset',group:'handoff',kind:'io',title:'Cohort dataset',sub:'Analysis input',guide:'outputs',href:'dataset',task:'The study cohort, ready for analysis',input:'Preprocessing results',output:'Analysis input'},
    {id:'aPlan',group:'analysis',kind:'agent',title:'Planning Agent',sub:'Analysis plan',guide:'planning',href:'analysis/planning',task:'Lists the analysis steps: comparisons, models, and checks',input:'Protocol + cohort variables',output:'Analysis plan'},
    {id:'aCode',group:'analysis',kind:'agent',title:'Coding Agent',sub:'Analysis scripts',guide:'coding',href:'analysis/coding',task:'Writes one analysis program per step',input:'Analysis plan',output:'Estimates and figures'},
    {id:'aRun',group:'analysis',kind:'local',title:'Run & repair',sub:'Runs and fixes',guide:'execution',href:'analysis/coding',task:'Runs the analysis and fixes errors',input:'Programs + study cohort',output:'Saved estimates'},
    {id:'results',group:'output',kind:'io',title:'Results',sub:'Tables & figures',guide:'outputs',href:'results',task:'Tables and figures that answer your research question',input:'Saved estimates and figures',output:'Shareable summary results'}
  ];
  function journeyCurrent(section){
    if(section==='strategy')return ['strategy'];
    if(section==='cohort')return route?.detail==='coding'&&pipes().cohort.run.planReady?['pCode','pRun']:['pPlan'];
    if(section==='dataset')return ['dataset'];
    if(section==='analysis'){
      if(!state.analysisDataset&&!recordedCohort())return ['dataset'];
      return route.detail==='coding'&&pipes().analysis.run.planReady?['aCode','aRun']:['aPlan'];
    }
    if(section==='results')return ['results'];
    return [];
  }
  function journey(section,mode){
    const intro=mode==='intro',guide=mode==='guide',run=mode==='run',replay=mode==='replay'||run;
    const current=run?runState.current:replay?journeyCurrent(section):guide?journeyNodes.filter(n=>n.guide===section).map(n=>n.id):[];
    const at=replay?journeyNodes.findIndex(n=>current.includes(n.id)):-1;
    const limit=replay&&!run?navigationLimit(section):0;
    const choosing=false;
    const step=(n,i)=>{
      const st=intro?'idle':current.includes(n.id)?'current':replay&&(i<at||state.autoDone&&!run)?'done':'next';
      const body=`${st==='current'&&replay?'<span class="journey-now">Now</span>':''}<strong>${esc(n.title)}</strong>`;
      let el;
      if(intro)el=n.id==='question'?`<button type="button" class="journey-step" data-intro-workflow="${n.guide}" data-intro-input aria-controls="introWorkflowDetail">${body}</button>`:`<button type="button" class="journey-step" data-intro-workflow="${n.guide}" aria-controls="introWorkflowDetail" aria-pressed="${introWorkflow===n.guide}">${body}</button>`;
      else if(guide)el=st==='current'?`<span class="journey-step" aria-current="step">${body}</span>`:`<a class="journey-step" href="#${guidePath(n.guide)}">${body}</a>`;
      else if(n.id==='question')el=`<button type="button" class="journey-step" data-current-question title="Show the research question">${body}</button>`;
      else if(st==='current')el=`<span class="journey-step" aria-current="step">${body}</span>`;
      else if(run)el=`<span class="journey-step">${body}</span>`;
      else if(replay)el=`<button type="button" class="journey-step" data-journey-go="${n.id}" title="Go to this step">${body}</button>`;
      else if((stepIndex[n.href.split('/')[0]]||99)<=limit)el=`<a class="journey-step" href="#${stagePath(n.href)}">${body}</a>`;
      else el=`<span class="journey-step" aria-disabled="true">${body}</span>`;
      return `<li class="journey-node is-${n.kind} is-${st}">${el}</li>`;
    };
    const groups=journeyGroups.map(g=>{
      const items=journeyNodes.map((n,i)=>[n,i]).filter(([n])=>n.group===g.id);
      const active=items.some(([n])=>current.includes(n.id));
      const done=replay&&at>=0&&(state.autoDone&&!run&&!active||items.every(([,i])=>i<at));
      return `<li class="journey-group g-${g.id}${active?' is-active':''}${done?' is-done':''}"><span class="journey-group-label">${g.label}</span><ol class="journey-nodes">${items.map(([n,i])=>step(n,i)).join('')}</ol></li>`;
    }).join('');
    const now=journeyNodes.find(n=>n.id===current[0]);
    const caption=intro
      ?''
      :now&&replay?`<p class="journey-caption"><span class="journey-caption-now">${esc(choosing?'Choose the cohort dataset for analysis':now.task)}</span>${now.id==='dataset'?'':`<span class="journey-io"><span>Input</span>${esc(now.input)}<i aria-hidden="true">→</i><span>Output</span>${esc(now.output)}</span>`}</p>`:'';
    const help=replay&&!run?`<div class="auto-ctl"><span class="journey-sim-tag">Simulated demo</span><span class="auto-status" id="autoStatus" aria-live="polite"></span></div>`:'';
    return `<nav class="journey journey-${mode}${run?' journey-replay':''}" aria-labelledby="agentWorkflowTitle">
      <div class="journey-head"><h2 class="journey-title" id="agentWorkflowTitle">Agent workflow</h2>${help}</div>
      <div class="journey-track"><ol class="journey-groups">${groups}</ol></div>
      ${caption}
    </nav>`;
  }
  function featureDetails(){
    const feature=systemFeatures.find(item=>item.id===featureId);
    const figures={handoffs:'feature-handoffs',local:'feature-levels',review:'feature-hybrid'};
    return `<p>${esc(feature.description)}</p><figure class="system-feature-figure"><img src="assets/${figures[feature.id]}.svg" alt="" width="530" height="154"></figure>`;
  }
  function renderIntro(){
    return `<section class="screen intro-screen">
      <header class="intro-heading intro-hero">
        <div class="intro-hero-inner">
          <div class="intro-hero-copy">
            <h1>From research question <span>to cohort analysis</span></h1>
            <p>Ask a clinical research question. AI agents design the study, build the patient cohort, and run the analysis.</p>
            <a class="button primary" href="#/question">Explore Study Examples</a>
          </div>
          <div class="intro-hero-visual" aria-hidden="true"><img class="hero-flow-img" src="assets/cohort-automation-tray.webp" width="1536" height="1024" alt="" fetchpriority="high"></div>
        </div>
      </header>
      <section class="panel system-features" aria-labelledby="systemHeading">
        <header><h2 id="systemHeading">How the system works</h2>
          <div class="system-feature-choices" role="group" aria-label="System features">
            ${systemFeatures.map((feature,index)=>`<button type="button" data-system-feature="${feature.id}" aria-controls="systemFeatureDetail" aria-pressed="${feature.id===featureId}"><span class="feature-num">${String(index+1).padStart(2,'0')}</span><span class="feature-text"><strong>${feature.title}</strong><small>${feature.hint}</small></span><i class="feature-arrow" aria-hidden="true"></i></button>`).join('')}
          </div>
        </header>
        <div class="system-feature-content">
          <div class="system-feature-detail" id="systemFeatureDetail" aria-live="polite">${featureDetails()}</div>
        </div>
      </section>
      ${journey('','intro')}
      <section class="panel workflow-guide intro-workflow-detail${introPaused?' is-paused':''}" id="introWorkflowDetail" tabindex="-1" aria-roledescription="carousel" aria-label="Agent guide">
        <div class="intro-slide-bar">
          <div class="intro-slide-dots" role="group" aria-label="Choose an agent">${introOrder.map(id=>`<button type="button" data-intro-workflow="${id}" aria-controls="introWorkflowDetail" aria-pressed="${introWorkflow===id}"><span>${esc(workflowStages.find(s=>s.id===id).title.replace(/:.*$/,''))}</span></button>`).join('')}</div>
          <span class="intro-slide-count" id="introSlideCount">${introOrder.indexOf(introWorkflow)+1} / ${introOrder.length}</span>
          <button type="button" class="intro-slide-toggle" data-intro-pause aria-pressed="${introPaused}">${introPaused?'Play':'Pause'}</button>
        </div>
        <div class="intro-slide-progress" aria-hidden="true"><span class="intro-progress-fill" style="animation-duration:${INTRO_SLIDE_SECONDS}s"></span></div>
        <div class="intro-slide-view" id="introSlideView" aria-live="polite"><div class="intro-slide">${guideSection(introWorkflow)}</div></div>
      </section>
      <section class="intro-cta" aria-labelledby="introCtaHeading">
        <h2 id="introCtaHeading">See the agents work on a real study</h2>
        <a class="button primary intro-cta-button" href="#/question">Explore Study Examples <span aria-hidden="true">→</span></a>
      </section>
    </section>`;
  }
  function recordedOutputs(){
    const study=activeStudy(),cohort=recordedCohort(),files=(resultArtifacts()?.files||[]);
    return `<section class="guide-example"><h3>In the recorded study · ${esc(study.title)}</h3><dl>
      ${cohort?`<div><dt>Study cohort</dt><dd><code>${esc(cohort.name)}</code> · ${fmt(cohort.rows)} rows · ${fmt(cohort.columns)} columns · ${esc(cohort.source)}</dd></div>`:''}
      ${files.length?`<div><dt>Results</dt><dd><ul>${files.map(f=>`<li>${esc(f.label||f.name)} <span>${esc((f.kind||'').toUpperCase())}</span></li>`).join('')}</ul></dd></div>`:''}
    </dl></section>`;
  }
  function guideContent(id){
    id=guideId(id);const guide=workflowGuides[id];
    return `<div class="workflow-guide-content">
      <p class="workflow-guide-summary">${esc(guide.description)}</p>
      ${guide.facts?`<dl class="workflow-guide-facts">${guide.facts.map(([term,text])=>`<div><dt>${esc(term)}</dt><dd>${esc(text)}</dd></div>`).join('')}</dl>`:''}
      ${workflowMaps[id]?renderWorkflowMap(id,'',true):`
        <div class="workflow-guide-roles">${guide.roles.map(([role,description])=>`<article><h3>${esc(role)}</h3><p>${esc(description)}</p></article>`).join('')}</div>
        <dl class="workflow-guide-handoff"><div><dt>Input</dt><dd>${esc(guide.input)}</dd></div><div><dt>Output</dt><dd>${esc(guide.output)}</dd></div></dl>`}
      
    </div>`;
  }
  function guideSection(id){
    const stage=workflowStages.find(s=>s.id===guideId(id));
    return `<header><h2>${stage.title}</h2></header>${guideContent(id)}`;
  }
  function showIntroWorkflow(id,auto=false){
    id=guideId(id);
    const detail=$('introWorkflowDetail'),view=$('introSlideView');
    if(!detail||!view)return;
    const back=introOrder.indexOf(id)<introOrder.indexOf(introWorkflow);
    introWorkflow=id;
    document.querySelectorAll('[data-intro-workflow]:not([data-intro-input])').forEach(button=>
      button.setAttribute('aria-pressed',String(button.dataset.introWorkflow===id)));
    const dots=detail.querySelector('.intro-slide-dots'),on=dots&&dots.querySelector('[aria-pressed="true"]');
    if(on&&dots.scrollWidth>dots.clientWidth)dots.scrollTo({left:on.offsetLeft-dots.offsetLeft-(dots.clientWidth-on.offsetWidth)/2,behavior:'smooth'});
    view.setAttribute('aria-live',auto?'off':'polite');
    view.innerHTML=`<div class="intro-slide entering${back?' from-left':''}">${guideSection(id)}</div>`;
    $('introSlideCount').textContent=`${introOrder.indexOf(id)+1} / ${introOrder.length}`;
    const bar=detail.querySelector('.intro-progress-fill');
    bar.replaceWith(bar.cloneNode());
    if(!auto){
      const top=detail.getBoundingClientRect().top;
      if(top>innerHeight*.6||top<0)detail.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
    }
  }
  function bindIntroSlides(){
    const detail=$('introWorkflowDetail');if(!detail)return;
    const zones=[detail,document.querySelector('.journey-intro')].filter(Boolean);
    let hover=0,focus=false;
    const sync=()=>detail.classList.toggle('is-paused',introPaused||hover>0||focus);
    zones.forEach(z=>{
      z.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'){hover++;sync();}});
      z.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch'){hover=Math.max(0,hover-1);sync();}});
      z.addEventListener('focusin',()=>{focus=true;sync();});
      z.addEventListener('focusout',e=>{if(!zones.some(x=>x.contains(e.relatedTarget))){focus=false;sync();}});
    });
    detail.addEventListener('animationend',e=>{
      if(!e.target.classList.contains('intro-progress-fill'))return;
      showIntroWorkflow(introOrder[(introOrder.indexOf(introWorkflow)+1)%introOrder.length],true);
    });
    detail.querySelector('[data-intro-pause]').addEventListener('click',e=>{
      introPaused=!introPaused;e.currentTarget.textContent=introPaused?'Play':'Pause';e.currentTarget.setAttribute('aria-pressed',String(introPaused));sync();
    });
  }
  function renderGuide(id){
    const stage=workflowStages.find(s=>s.id===guideId(id))||workflowStages[0];
    return `<section class="screen workflow-guide-screen">
      <section class="panel workflow-guide scroll-region"><header><h1>${stage.title}</h1></header>${guideContent(stage.id)}</section>
      <footer class="automation-footer"><a class="button quiet" href="#/intro">Back to Overview</a><a class="button primary" href="#/question">Explore Study Examples</a></footer>
    </section>`;
  }
  function renderProgress(section){return section==='run'?'':journey(section,'replay');}
  function renderGuideNavigation(id){return journey(guideId(id),'guide');}
  let workflowPreviewListeners;
  let pinnedWorkflowPreview;
  function bindWorkflowPreviews(){
    workflowPreviewListeners?.abort();
    if(pinnedWorkflowPreview?.hash!==location.hash)pinnedWorkflowPreview=null;
    const items=[...document.querySelectorAll('[data-workflow-preview]')];
    if(!items.length)return;
    workflowPreviewListeners=new AbortController();
    const options={signal:workflowPreviewListeners.signal};
    let opened;
    function close(){
      if(!opened)return;
      opened.trigger.setAttribute('aria-expanded','false');
      opened.preview.hidden=true;
      opened=null;
      pinnedWorkflowPreview=null;
    }
    function open(item,pin=false){
      if(opened&&opened!==item)close();
      opened=item;
      item.trigger.setAttribute('aria-expanded','true');
      item.preview.hidden=false;
      if(pin)pinnedWorkflowPreview={id:item.element.dataset.workflowPreview,hash:location.hash};
    }
    for(const element of items){
      const item={element,trigger:element.querySelector('button'),preview:element.querySelector('.workflow-preview')};
      element.addEventListener('pointerenter',event=>{
        if(event.pointerType!=='touch'&&!pinnedWorkflowPreview)open(item);
      },options);
      element.addEventListener('pointerleave',()=>{
        if(opened===item&&!pinnedWorkflowPreview)close();
      },options);
      element.addEventListener('focusout',event=>{
        if(opened===item&&event.relatedTarget&&!element.contains(event.relatedTarget))close();
      },options);
      item.trigger.addEventListener('click',()=>{
        if(item.trigger.hasAttribute('data-intro-workflow')||opened===item&&pinnedWorkflowPreview){
          close();
        }else{
          open(item,true);
        }
      },options);
      if(pinnedWorkflowPreview?.id===element.dataset.workflowPreview)open(item,true);
    }
    document.addEventListener('click',event=>{
      if(opened&&!opened.element.contains(event.target))close();
    },options);
    document.addEventListener('keydown',event=>{
      if(!opened||event.key!=='Escape')return;
      const trigger=opened.trigger;
      if(opened.element.contains(document.activeElement))trigger.focus({preventScroll:true});
      close();
    },options);
  }
  const taskFlows={
    question:[['in','io','Input','Research question'],['strategy','agent','Strategy Agent','Turns the question into a study design'],['out','io','Output','Study design']],
    cohort:[['in','io','Input','Study design and schema'],['planning','agent','Planning Agent','Orders the preprocessing tasks'],['coding','agent','Coding Agent','Writes one script per task'],['exec','local','Execution & repair','Runs locally; a local model fixes errors'],['out','io','Output','Cohort dataset']],
    analysis:[['in','io','Input','Study design + cohort'],['planning','agent','Planning Agent','Plans comparisons and models'],['coding','agent','Coding Agent','Writes the analysis scripts'],['exec','local','Execution & repair','Runs locally; a local model fixes errors'],['out','io','Output','Results']]
  };
  const flowFor={strategy:['question','strategy'],cohortPlan:['cohort','planning'],cohortCode:['cohort',['coding','exec']],dataset:['cohort','out'],choose:['analysis','in'],analysisPlan:['analysis','planning'],analysisCode:['analysis',['coding','exec']],results:['analysis','out']};
  function taskFlow(key){
    const [phase,current]=flowFor[key]||[];if(!phase)return '';
    const nodes=taskFlows[phase],active=[].concat(current),at=nodes.findIndex(n=>active.includes(n[0]));
    return `<ol class="task-flow" aria-label="Task flow">${nodes.map(([id,kind,title,task],i)=>{
      const state=active.includes(id)?'current':i<at?'done':'next';
      const tag=state==='current'?'Now':state==='done'?'Done':kind==='io'?title:'Next';
      return `<li class="task-node is-${kind} is-${state}" ${state==='current'?'aria-current="step"':''}><span class="task-node-tag">${tag}</span><strong>${esc(kind==='io'?task:title)}</strong>${kind==='io'?'':`<small>${esc(task)}</small>`}</li>`;}).join('')}</ol>`;
  }
  function flowHeading(title,subtitleHtml,actions,key,extraClass=''){
    return `<header class="screen-heading flow-heading ${extraClass}"><h1 class="sr-only">${esc(title)}</h1>${actions?`<div class="flow-meta"><p class="sr-only">${subtitleHtml}</p><div class="heading-actions">${actions}</div></div>`:`<p class="sr-only">${subtitleHtml}</p>`}</header>`;
  }
  function phaseHead(title,subtitle,actions='',flow=''){
    if(flow)return flowHeading(title,esc(subtitle||''),actions,flow);
    return `<header class="screen-heading"><div><h1>${esc(title)}</h1>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div>${actions?`<div class="heading-actions">${actions}</div>`:''}</header>`;
  }
  function phaseFooter(previous,path='',lockReason=''){
    return path?`<footer class="automation-footer"><span></span></footer>`:'';
  }
  function guard(){return `<section class="screen"><header class="screen-heading"><div><span class="eyebrow">HYBRID COHORT AUTOMATION</span><h1>Start with the research question.</h1></div></header><section class="panel empty-state"><span class="empty-icon" aria-hidden="true">?</span><h2>One question starts the process.</h2><p>This replay follows the recorded study. Open it to continue to this step.</p><button class="button primary" data-open-recorded>Open the connected study</button><a class="text-button" href="#/question">Enter a research question</a></section></section>`;}
  function renderQuestionInput(example=null){return `<section class="screen question-screen ${example?'study-preview':''}">${phaseHead(example?'Explore this example question.':'Start with your research question.',example?'The question is available to inspect. Its recorded automation artifacts have not been connected yet.':'Your question is the starting point. The Hybrid setup and database are already configured.','<a class="button quiet" href="#/question">All study examples</a>')}<div class="question-layout"><form class="panel question-form" id="questionForm"><div class="question-form-title"><span class="eyebrow">THE ONLY INPUT FROM YOU</span><h2>${example?esc(example.title):'What do you want to investigate?'}</h2></div><div class="question-field-area"><label for="researchQuestion">Research question</label><textarea id="researchQuestion" spellcheck="false" ${example?'readonly':''} required maxlength="1200" placeholder="Describe the population, exposure, and outcome you want to study…">${esc(state.draft)}</textarea><p class="question-field-note">A short question is enough. The Strategy Agent specifies the study conditions.</p><p id="questionError" class="question-error" role="alert" hidden></p><button class="text-button" type="button" id="useConnectedQuestion">Use the connected study question</button></div><div class="question-submit"><div><span class="tag frontier-tag">${example?'Question preview':'Recorded study'}</span><p>${example?'No recorded automation run is connected for this question.':'Replay the connected artifacts for this question.'}</p></div><button class="button primary" type="submit" ${example?'disabled':''}>${example?'Replay not connected':'Start Hybrid replay'}</button></div></form><aside class="question-context"><section class="panel question-promise"><span class="eyebrow">FROM YOUR QUESTION</span><h2>${example?esc(example.title):'A specified study.<br>An ordered plan.<br>Executable code.'}</h2><p>${example?'An example research question. Choose the connected study to explore a recorded Hybrid replay.':'Follow the outputs as one Agent hands them to the next.'}</p><button class="text-button" type="button" data-process-details>What happens after I start?</button></section><section class="panel preset-card"><span class="eyebrow">PRECONFIGURED FOR THIS STUDY</span><dl><div><dt>Data environment</dt><dd>MIMIC-IV 3.1</dd></div><div><dt>Generation</dt><dd>Frontier models</dd></div><div><dt>Data access & repair</dt><dd>Local environment</dd></div></dl><span class="small-note">No database or model setup is requested from the visitor.</span></section></aside></div><div class="question-bottom"><span>Question input</span><span>Study specification</span><span>Step-by-step planning</span><span>Code & local execution</span><span>Result analysis</span></div></section>`;}
  function renderStudyGallery(){return `<section class="screen study-gallery-screen"><header class="screen-heading"><div><h1>Choose a research question</h1><p class="gallery-sim-note"><span class="journey-sim-tag">Simulated demo</span>The workflow replays outputs recorded in an actual end-to-end run.</p></div></header><div class="study-card-grid" aria-label="Research question examples">${studyExamples.map(ex=>`<a class="study-card" href="#${stagePath('strategy',ex)}${ex.id==='pravastatin'?'?study=pravastatin':''}" data-study-example="${ex.id}" aria-label="${esc(ex.title)}"><div class="study-card-media"><img src="${ex.image}" alt="${esc(ex.alt)}" width="768" height="512" decoding="async" fetchpriority="${ex.connected?'high':'auto'}"></div><div class="study-card-content"><h2>${esc(ex.title)}</h2><span class="study-question-label">Research question</span><p class="study-card-question">${esc(ex.displayQuestion||ex.question)}</p>${ex.description?`<p class="study-card-description">${esc(ex.description)}</p>`:'' }<div class="study-card-cta study-card-dataset"><span>${esc(ex.dataset)}</span><span>Version ${esc(ex.version)}</span></div></div></a>`).join('')}<div class="study-card empty-study-card" aria-hidden="true"></div></div></section>`;}
  function renderQuestion(){const ex=studyExamples.find(x=>x.id===route.params.get('example')&&!x.connected);if(ex){if(state.exampleId!==ex.id){state.draft=ex.question;state.exampleId=ex.id;}return renderQuestionInput(ex);}if(route.params.get('mode')==='input'){state.exampleId=null;return renderQuestionInput();}return renderStudyGallery();}
  function strategyOutput(){
    if(state.generated)return outputPanel(studyDesignKey(),'Strategy Agent output').replace('>OUTPUT<','>OUTPUT · STUDY PROTOCOL<');
    const body=state.generating
      ?`<div class="generation-wait" role="status"><span class="run-spinner" aria-hidden="true"></span><p>Strategy Agent is generating the study design…</p></div>`
      :`<div class="generation-wait" role="status"><span class="run-spinner" aria-hidden="true"></span><p>Strategy Agent is reading the research question…</p></div>`;
    return `<section class="panel output-panel" id="strategyOutput"><div class="automation-panel-header"><div><span class="eyebrow">OUTPUT · STUDY PROTOCOL</span><h2>Strategy Agent output</h2></div></div>${body}</section>`;
  }
  function renderStrategy() {
    return `<section class="screen automation-screen">
      ${phaseHead('Strategy Agent',activeStudy().title,isNhis()?'<button class="button quiet" data-nhis-details="dataset">Data source</button>':'','strategy')}
      <div class="strategy-layout">
        <aside class="panel question-input-card">
          <span class="eyebrow">INPUT · YOUR QUESTION</span>
          <label class="user-question-label" for="userQuestion">Research question</label>
          <textarea class="user-question-field" id="userQuestion" readonly spellcheck="false">${esc(state.question)}</textarea>
          <button class="button primary generation-button" type="button" id="generateStrategy" ${state.generating||state.generated?'disabled':''}>${state.generating?'Generating…':'Generation'}</button>
        </aside>
        ${strategyOutput()}
      </div>
      ${phaseFooter('question','cohort',state.generated?'':'Generate the study design first.')}
    </section>`;
  }
  function runStrategyGeneration(){
    if(state.generating||state.generated)return;
    const token=++state.genToken;state.generating=true;go(stagePath('strategy'));
    setTimeout(()=>{if(token!==state.genToken)return;state.generating=false;state.generated=true;state.typeStrategy=true;if(route&&route.section==='strategy')go(stagePath('strategy'));},4000);
  }

  /* ---------- Preprocessing, cohort dataset, analysis, result ---------- */
  const studyDesignKey=()=>isNhis()?'nhisDesign':'strategy';
  const PIPE=(window.PIPELINE_DATA&&window.PIPELINE_DATA.cohort)||{steps:[],final:null};
  const APIPE=window.ANALYSIS_DATA||null;
  if(APIPE&&APIPE.plan)D.outputs.analysisPlan={filename:APIPE.plan.filename,url:APIPE.plan.url,text:APIPE.plan.text};
  const localData=()=>null;
  const parsePlan=key=>{try{return JSON.parse(D.outputs[key].text);}catch{return [];}};
  const cohortRun={status:'idle',selected:1,token:0,planReady:false};
  const analysisRun={status:'idle',selected:1,token:0,planReady:false};
  const datasetView={page:0,filter:'',pageSize:50};
  const fmt=n=>Number(n).toLocaleString('en-US');
  const pad=n=>String(n).padStart(2,'0');
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const replayTiming={plan:3800,write:420,output:520,complete:900};
  const firstRows=o=>o.find(x=>typeof x.rows==='number');
  const pravastatinPipes={
    cohort:{id:'cohort',next:'dataset',run:cohortRun,planKey:'cohortPlan',planSteps:parsePlan('cohortPlan'),steps:PIPE.steps,
      reading:'Reading the study design…',
      doneText:n=>`${n} recorded scripts · cohort outputs`,
      outputs:s=>[{name:s.output.table,kind:'table',exists:true,rows:s.output.rows,columns:s.output.columns}],
      where:'hosp.duckdb',local:()=>localData()||{}},
    analysis:{id:'analysis',next:'results',run:analysisRun,planKey:'analysisPlan',planSteps:APIPE?parsePlan('analysisPlan'):[],steps:APIPE?APIPE.steps:[],
      reading:'Reading the study design and selected cohort…',
      doneText:n=>`${n} recorded scripts · analysis outputs`,
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
  const phaseLabel=P=>P.id==='cohort'?'Preprocessing':'Analysis';
  const planPath=P=>P.id==='cohort'?'cohort':'analysis/planning';
  function recordedCohort(){
    const data=isNhis()?nhis.final:PIPE.final;
    const finalStep=pipes().cohort.steps.at(-1);
    if(!data||!finalStep)return null;
    const output=pipes().cohort.outputs(finalStep)[0];
    if(!output||output.exists===false)return null;
    const study=activeStudy();
    return {name:output.name,source:study.dataset+' '+study.version,rows:data.rows,columns:data.columns.length};
  }
  const planningActions=P=>P.recorded?`<button class="button quiet" data-nhis-details="${P.id==='cohort'?'checkpoint':'analysis-plan'}">${P.id==='cohort'?'Checkpoint':'Analysis strategy'}</button>`:'';
  function rowDone(P,s){if(P.recorded)return s.recorded?'Saved script':'Script not connected';const o=P.outputs(s),r=firstRows(o);return `✓ ${o[0]?o[0].name:''}${o.length>1?` +${o.length-1}`:''}${r?` · ${fmt(r.rows)} rows`:''}`;}
  const planTitle=(entry,fallback)=>entry?.step_name||entry?.analysis_method||fallback;
  const planInputs=entry=>Array.isArray(entry?.input)?entry.input:(entry?.data_input?.name||'').split(';').map(name=>name.trim()).filter(Boolean);
  const inputLabels={
    temp_sepsis_diagnoses:'Sepsis diagnoses',temp_infection_evidence:'Infection evidence',
    cohort_adult_icu_stays:'Adult ICU stays','hosp.duckdb.admissions':'Hospital admissions'
  };
  function renderPlanning(P){
    const out=D.outputs[P.planKey];
    const ready=P.run.planReady&&out;
    const analysis=P.id==='analysis';
    const waiting=`<section class="panel output-panel" ${out?'data-plan-replay="'+P.id+'"':''}>
      <div class="automation-panel-header"><div><span class="eyebrow">OUTPUT · ${P.id==='cohort'?'PREPROCESSING PLAN':'ANALYSIS PLAN'}</span><h2>Planning Agent output</h2></div></div>
      ${out?`<div class="generation-wait" role="status"><span class="run-spinner" aria-hidden="true"></span><p>${esc(P.reading)}</p></div>`:'<div class="generation-wait"><p>Not connected yet</p></div>'}
    </section>`;
    return `<section class="screen automation-screen pipeline-screen">
      ${phaseHead('Planning Agent',phaseLabel(P)+' · '+activeStudy().title,planningActions(P),P.id==='cohort'?'cohortPlan':'analysisPlan')}
      <div class="recorded-plan design-first">
        ${analysis
          ?outputPanel(studyDesignKey(),'Study design',`<span class="plan-input-chip" title="Selected cohort dataset"><span>Cohort</span>${esc(state.analysisDataset)}</span>`).replace('>OUTPUT<','>INPUT · STUDY DESIGN + SELECTED COHORT<')
          :outputPanel(studyDesignKey(),'Study design · from Strategy Agent').replace('>OUTPUT<','>INPUT · STUDY DESIGN<')}
        ${ready?outputPanel(P.planKey,'Planning Agent output').replace('>OUTPUT<',`>OUTPUT · ${P.id==='cohort'?'PREPROCESSING PLAN':'ANALYSIS PLAN'}<`):waiting}
      </div>
      ${phaseFooter(analysis?'analysis':'strategy',P.id+'/coding',ready?'':'Available when the plan is ready.')}
    </section>`;
  }
  async function playPlan(P,element){
    const R=P.run,token=++R.token;
    await sleep(replayTiming.plan);
    if(token!==R.token||!element.isConnected)return;
    R.planReady=true;R.typePlan=true;
    go(stagePath(planPath(P)));
  }
  function pipelineHeading(P){
    const complete=P.run.status==='done';
    const progress=complete?`Step ${pad(P.run.selected)} of ${P.steps.length}`:'Recorded replay';
    const repair='';
    return flowHeading('Coding Agent',`${phaseLabel(P)} · ${esc(activeStudy().title)} · <span id="pipelinePosition">${progress}</span>`,repair,P.id==='cohort'?'cohortCode':'analysisCode','pipeline-heading');
  }
  function stepPicker(P){
    return `<label class="sr-only" for="pipeStepSelect">Step</label><select class="select-control pipeline-step-picker" id="pipeStepSelect" data-pipe="${P.id}">${P.steps.map(s=>`<option value="${s.step}" ${s.step===P.run.selected?'selected':''}>Step ${pad(s.step)} · ${esc(planTitle(P.planSteps[s.step-1],s.file))}</option>`).join('')}</select>`;
  }

  function runView(P){
    return `<section class="screen automation-screen pipeline-screen" data-pipe-run="${P.id}">
      ${pipelineHeading(P)}
      <div class="panel pipeline-run">
        <section class="run-column">
          <div class="run-column-head"><span class="run-agent">Scripts</span><span class="run-badge" id="codeBadge">Replaying</span></div>
          <p class="run-status" id="codeStatus" role="status"><span>Loading the first task…</span></p>
          <ol class="run-list" id="codeList"></ol>
        </section>
      </div>
      ${phaseFooter(planPath(P),P.next,'Available when all outputs are ready.')}
    </section>`;
  }
  async function playRun(P){
    const R=P.run,token=++R.token;
    const alive=()=>token===R.token&&document.querySelector(`[data-pipe-run="${P.id}"]`);
    const status=(message,busy)=>{$('codeStatus').innerHTML=`${busy?'<span class="run-spinner" aria-hidden="true"></span>':'<span class="run-check" aria-hidden="true">✓</span>'}<span>${esc(message)}</span>`;};
    for(const s of P.steps){
      if(!alive())return;
      const progress=`Step ${pad(s.step)} of ${P.steps.length}`;
      $('pipelinePosition').textContent=progress;
      status(`${progress} · ${s.file}`,true);
      $('codeList').insertAdjacentHTML('beforeend',`<li id="codeRow${s.step}"><span class="run-index">${pad(s.step)}</span><span class="run-file">${esc(s.file)}</span><span class="run-state">Writing code…</span></li>`);
      $('codeList').lastElementChild.scrollIntoView({block:'nearest'});
      await sleep(replayTiming.write*(P.id==='analysis'?.6:1));if(!alive())return;
      $('codeRow'+s.step).querySelector('.run-state').textContent='Running…';
      await sleep(replayTiming.output*(P.id==='analysis'?.6:1));if(!alive())return;
      const st=$('codeRow'+s.step).querySelector('.run-state');st.textContent='✓ Done';st.classList.add('done');$('codeRow'+s.step).classList.add('run-open');$('codeRow'+s.step).title='Open this script';
    }
    status(P.doneText(P.steps.length),false);
    $('codeBadge').textContent='Done';$('codeBadge').classList.add('done');
    await sleep(replayTiming.complete);if(!alive())return;
    R.status='done';go(stagePath(P.id+'/coding'));
  }

  function codingTaskPanel(P,s){
    const entry=P.planSteps[s.step-1];
    const inputs=planInputs(entry);
    return `<section class="panel pipeline-plan">
      <header><h2>Coding task</h2></header>
      <div class="selected-plan-body scroll-region">
        <span class="eyebrow">SELECTED TASK</span>
        <h3>${esc(planTitle(entry,s.title||s.file))}</h3>
        ${inputs.length?`<h4>Inputs</h4><ul class="step-inputs">${inputs.map(input=>`<li title="${esc(input)}">${esc(inputLabels[input]||input)}</li>`).join('')}</ul>`:''}
      </div>
      <footer><button class="button quiet" type="button" data-inspect="plan" aria-haspopup="dialog">View full plan</button></footer>
    </section>`;
  }
  function previewTable(p,total){
    return `<div class="output-preview scroll-region"><table><thead><tr>${p.columns.map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${p.rows.map(r=>`<tr>${r.map(v=>`<td>${esc(String(v??''))}</td>`).join('')}</tr>`).join('')}</tbody></table></div><p class="output-local-note">${typeof total==='number'&&p.rows.length<total?`First ${p.rows.length} of ${fmt(total)} rows`:`${fmt(p.rows.length)} rows`} · aggregate results</p>`;
  }
  const localOnly='<p class="output-local-note">Shown only in the local version (MIMIC-IV derived data).</p>';
  function outputBlock(P,s,o,index){
    const L=P.local();
    const meta=o.kind==='png'?'Figure':o.kind==='xlsx'?`Excel workbook · ${(o.sheets||[]).length} sheets`:o.kind==='json'?'JSON':typeof o.rows==='number'?`${fmt(o.rows)} rows × ${(o.columns||[]).length} columns`:'';
    const next=P.planSteps.slice(s.step).find(step=>planInputs(step).some(name=>name===o.name||name.endsWith('::'+o.name)));
    let body='';
    if(o.exists===false)body='<p class="output-local-note">A run-linked output is not connected.</p>';
    else if(o.kind==='png')body=L.images&&L.images[o.name]?`<figure class="output-figure"><img src="${esc(L.images[o.name])}" alt="${esc(o.name)}" loading="lazy"></figure>`:localOnly;
    else if(o.kind==='json')body=L.texts&&L.texts[o.name]?`<pre class="output-preview output-text scroll-region"><code>${esc(L.texts[o.name])}</code></pre><p class="output-local-note">local only</p>`:localOnly;
    else if(o.kind==='xlsx')body=`<div class="output-columns open-columns"><div>${(o.sheets||[]).map(n=>`<span>${esc(n)}</span>`).join('')}</div></div>`;
    else{
      const p=L.previews?.[o.name];
      const note=o.kind==='table'||o.kind==='parquet'||['processed_cohort.csv','cohort_with_ps.csv','matched_cohort.csv'].includes(o.name)
        ?'Patient-level rows are local only':'The output preview is not connected.';
      body=p?previewTable(p,o.rows):`<p class="output-local-note">${note}</p>`;
    }
    return `<div class="code-output-block">
        <div class="code-output-head"><span class="eyebrow">OUTPUT · ${esc(P.where)}</span><strong>${esc(o.name)}</strong>${meta?`<span class="artifact-metadata">${esc(meta)}</span>`:''}</div>
        ${next&&o.exists!==false?`<p class="artifact-next-use"><b>Next use</b> ${esc(planTitle(next,''))}</p>`:''}
        ${body}
        ${o.columns?.length?`<button class="button quiet" type="button" data-inspect="columns" data-output-index="${index}" aria-haspopup="dialog">View columns</button>`:''}
      </div>`;
  }
  function selectedPipelineStep(P){
    return P.steps.find(s=>s.step===P.run.selected)||P.steps[0];
  }
  function scriptTitle(P,s){return s.file==='step05_sepsis_icu_stays.py'?'Define the sepsis cohort':planTitle(P.planSteps[s.step-1],s.title||s.file);}
  function scriptList(P){
    return `<nav class="panel script-list" aria-label="Generated scripts">
      <header><strong>${P.steps.length} scripts</strong></header>
      <ol class="scroll-region">${P.steps.map(s=>`<li><button type="button" data-script-step="${s.step}" aria-current="${s.step===P.run.selected}"><span class="script-index">${pad(s.step)}</span><span class="script-meta"><strong class="script-file-only">${esc(s.file)}</strong></span></button></li>`).join('')}</ol>
    </nav>`;
  }
  function scriptIO(P,s){
    const inputs=planInputs(P.planSteps[s.step-1]);
    const outs=P.outputs(s);
    const outMeta=o=>o.kind==='png'?'Figure':typeof o.rows==='number'?`${fmt(o.rows)} rows${o.columns?.length?` × ${o.columns.length} cols`:''}`:o.exists===false?'Saved locally':(o.kind||'').toUpperCase();
    const inList=inputs.length?inputs.map(i=>`<li title="${esc(i)}"><code>${esc(i)}</code></li>`).join(''):'<li class="script-io-none">From the previous step</li>';
    const outList=outs.length?outs.map(o=>`<li title="${esc(o.name)}"><code>${esc(o.name)}</code><small>${esc(outMeta(o))}</small></li>`).join(''):'<li class="script-io-none">Not recorded</li>';
    return `<div class="script-io" aria-label="Step input and output">
      <section class="script-io-box"><span class="script-io-label">Input</span><ul>${inList}</ul></section>
      <span class="script-io-arrow" aria-hidden="true">→</span>
      <section class="script-io-box is-out"><span class="script-io-label">Output</span><ul>${outList}</ul></section>
    </div>`;
  }
  function scriptViewer(P){
    const s=selectedPipelineStep(P),view='code',outputs=P.outputs(s);
    const tab=(id,label)=>`<button type="button" data-script-view="${id}" aria-pressed="${view===id}">${label}</button>`;
    let body;
    if(view==='output')body=`<div class="code-output script-outputs">${outputs.map((o,i)=>outputBlock(P,s,o,i)).join('')}${s.note?`<p class="small-note step-evidence">${esc(s.note)}</p>`:''}</div>`;
    else if(view==='task'){const inputs=planInputs(P.planSteps[s.step-1]);body=`<div class="selected-plan-body script-task"><span class="eyebrow">INPUT · PLAN STEP ${pad(s.step)}</span><h3>${esc(scriptTitle(P,s))}</h3>${inputs.length?`<h4>Inputs</h4><ul class="step-inputs">${inputs.map(input=>`<li title="${esc(input)}">${esc(inputLabels[input]||input)}</li>`).join('')}</ul>`:''}<button class="button quiet" type="button" data-inspect="plan" aria-haspopup="dialog">View full plan</button></div>`;}
    else body=s.code?`<pre class="code-view script-code"><code>${String(s.code).replace(/\n$/,'').split('\n').map(line=>`<span class="code-line">${esc(line)||' '}</span>`).join('\n')}</code></pre>`:'<p class="small-note script-empty">Script not connected yet</p>';
    return `<section class="panel script-viewer" aria-label="Script viewer">
      <header class="script-viewer-head">
        <div><span class="eyebrow">STEP ${pad(s.step)} OF ${P.steps.length}</span><h2 class="script-file-title">${esc(s.file)}</h2></div>
      </header>
      <div class="script-viewer-body scroll-region">${body}</div>
    </section>`;
  }
  function pipelineWorkspace(P){
    return scriptList(P)+scriptViewer(P);
  }
  function inspectArtifact(P,kind,index){
    const s=selectedPipelineStep(P);
    if(kind==='plan'){
      const out=D.outputs[P.planKey];
      showDialog(out.filename,`<div class="artifact-dialog-actions"><a class="button quiet" href="${esc(out.url)}" data-download="output:${P.planKey}" download>Download plan</a></div>${rawOutput(out.text,'Full planning output')}`,'PLANNING AGENT · OUTPUT');
    }else if(kind==='code'){
      showDialog(s.file,rawOutput(s.code,'Generated code'),'CODING AGENT · OUTPUT');
    }else if(kind==='columns'){
      const output=P.outputs(s)[index];
      showDialog(output.name,`<table class="artifact-columns"><thead><tr><th scope="col">Column</th><th scope="col">Type</th></tr></thead><tbody>${output.columns.map(c=>`<tr><td>${esc(c.name)}</td><td>${esc(c.type||'—')}</td></tr>`).join('')}</tbody></table>`,'OUTPUT COLUMNS');
    }
  }
  function renderCoding(P){
    if(!P.steps.length)return `<section class="screen automation-screen pipeline-screen">${phaseHead('Coding Agent',phaseLabel(P))}<section class="panel empty-state"><h2>Not connected yet</h2><p>Scripts and outputs are missing from this recording.</p></section>${phaseFooter(planPath(P),P.next,'Outputs are not connected.')}</section>`;
    if(P.run.status!=='done'){P.run.status='running';return runView(P);}
    return `<section class="screen automation-screen pipeline-screen" data-pipe-workspace="${P.id}">
      ${pipelineHeading(P)}
      <div class="pipeline-final script-workspace">${pipelineWorkspace(P)}</div>
      ${phaseFooter(planPath(P),P.next)}
    </section>`;
  }
  function renderCohort(){
    const P=pipes().cohort;
    return route.detail==='coding'&&P.run.planReady?renderCoding(P):renderPlanning(P);
  }
  function selectStep(P,n){
    P.run.selected=n;
    $('pipelinePosition').textContent=`Step ${pad(n)} of ${P.steps.length}`;
    document.querySelectorAll('[data-script-step]').forEach(b=>b.setAttribute('aria-current',String(Number(b.dataset.scriptStep)===n)));
    document.querySelector('.script-viewer').outerHTML=scriptViewer(P);
  }

  function renderDataset(){
    return `<section class="screen automation-screen dataset-screen">
      ${phaseHead('Cohort Dataset',activeStudy().title,isNhis()?'<button class="button quiet" data-nhis-details="dataset">Data source</button>':'','dataset')}
      <div class="dataset-layout">
        <section class="panel dataset-viewer">
          <div class="dataset-toolbar"><span class="eyebrow">OUTPUT · COHORT DATASET</span>
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
      ${phaseFooter('cohort/coding','analysis')}
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

  function renderAnalysisDataset(){
    const dataset=recordedCohort();
    if(dataset&&!state.analysisDataset)state.analysisDataset=dataset.name;
    return `<section class="screen automation-screen">
      ${phaseHead('Choose a cohort dataset',activeStudy().title,'','choose')}
      <div class="analysis-inputs">
      ${D.outputs[studyDesignKey()]?outputPanel(studyDesignKey(),'Selected study design · from Strategy Agent').replace('>OUTPUT<','>INPUT 1 · STUDY DESIGN<'):''}
      <form class="panel analysis-dataset-picker scroll-region" id="analysisDatasetForm">
        <span class="eyebrow">INPUT 2 · COHORT</span>
        <fieldset>
          <legend>Choose a saved cohort dataset</legend>
          ${dataset?`<label class="cohort-choice">
            <input type="radio" name="dataset" value="${esc(dataset.name)}" required ${state.analysisDataset===dataset.name?'checked':''}>
            <span><strong>${esc(dataset.name)}</strong><small>${esc(dataset.source)} · ${fmt(dataset.rows)} rows · ${fmt(dataset.columns)} columns</small></span>
          </label>`:'<p>Not connected yet</p>'}
        </fieldset>
        <p class="analysis-inputs-note">The Planning Agent receives this study design together with the selected cohort's variable structure, not its patient rows.</p>
      </form>
      </div>
      <footer class="automation-footer">
      </footer>
    </section>`;
  }
  function renderAnalysis(){
    if(!state.analysisDataset){const c=recordedCohort();if(c)state.analysisDataset=c.name;}
    const P=pipes().analysis;
    return route.detail==='coding'&&P.run.planReady?renderCoding(P):renderPlanning(P);
  }
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
    const sourceName=o.name==='forest_plot.png'?'table2_mortality_associations.csv':o.name;
    const source=!isNhis()&&APIPE?.steps.find(s=>s.outputs.some(item=>item.name===sourceName));
    const origin=o.note||(source?`${o.name==='forest_plot.png'?'Figure based on':'Recorded output from'} Analysis · Step ${pad(source.step)} · ${source.file}`:'');
    const note=origin?`<p class="result-provenance">${esc(origin)}</p>`:'';
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
    if(!files.length)return `<section class="screen automation-screen"><header class="screen-heading"><div><h1>Results</h1></div></header><section class="panel empty-state"><h2>Not connected yet</h2><p>The analysis outputs have not been exported. Run build_demo_data.py.</p></section>${phaseFooter('analysis/coding')}</section>`;
    const cur=files.find(o=>o.name===resultView.file)||files[0];resultView.file=cur&&cur.name;
    return `<section class="screen automation-screen results-screen">
      ${phaseHead('Results',activeStudy().title,'','results')}
      <div class="results-layout">
        <nav class="panel output-files" aria-label="Output files">
          <span class="eyebrow output-files-label">OUTPUT · RESULT FILES</span><ul>${files.map(o=>`<li><button type="button" class="output-file ${o.name===resultView.file?'active':''}" aria-pressed="${o.name===resultView.file}" data-result-file="${esc(o.name)}"><span class="file-badge ${o.kind}">${esc(o.kind.toUpperCase())}</span><span class="output-file-name">${esc(o.label)}</span><span class="file-size">${kb(o.bytes)}</span></button></li>`).join('')}</ul>
        </nav>
        <section class="panel file-pane" id="filePane">${cur?filePane(cur):''}</section>
      </div>
      ${phaseFooter('analysis/coding')}
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
    const planning=document.querySelector('[data-plan-replay]');
    if(planning)playPlan(pipes()[planning.dataset.planReplay],planning);
    const runEl=document.querySelector('[data-pipe-run]');
    if(runEl){const P=pipes()[runEl.dataset.pipeRun];if(P.run.status==='running')playRun(P);
      $('codeList').addEventListener('click',event=>{const row=event.target.closest('li.run-open');if(!row)return;P.run.token++;P.run.status='done';P.run.selected=Number(row.id.replace('codeRow',''));P.run.view='code';go(stagePath(P.id+'/coding'));});}
    const datasetForm=$('analysisDatasetForm');
    if(datasetForm){
      const next=document.querySelector('button[form="analysisDatasetForm"]');
      const selection=()=>new FormData(datasetForm).get('dataset');
      datasetForm.addEventListener('change',()=>{if(next)next.disabled=!selection();});
      datasetForm.addEventListener('submit',event=>{
        event.preventDefault();
        const selected=selection();
        if(!selected||selected!==recordedCohort()?.name)return;
        state.analysisDataset=selected;
        go(stagePath('analysis/planning'));
      });
    }
    document.querySelectorAll('[data-result-file]').forEach(b=>b.addEventListener('click',()=>{resultView.file=b.dataset.resultFile;resultView.sheet=null;showResultFile();}));
    if($('filePane'))bindResultPane();
    const workspace=document.querySelector('[data-pipe-workspace]');
    if(workspace){
      const pipe=pipes()[workspace.dataset.pipeWorkspace];
      workspace.addEventListener('click',event=>{
        const step=event.target.closest('[data-script-step]');
        if(step){selectStep(pipe,Number(step.dataset.scriptStep));return;}
        const view=event.target.closest('[data-script-view]');
        if(view){pipe.run.view=view.dataset.scriptView;document.querySelector('.script-viewer').outerHTML=scriptViewer(pipe);return;}
        const action=event.target.closest('[data-inspect]');
        if(action)inspectArtifact(pipe,action.dataset.inspect,Number(action.dataset.outputIndex));
      });
    }
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
  /* ---------- Live run: the whole recorded workflow on one screen ---------- */
  const runState={token:0,status:'idle',paused:false,skip:false,follow:true,current:[],studyId:null,started:0,elapsed:0,timer:null};
  const runTiming={question:450,think:700,stream:1900,planHead:450,planStep:140,codeWrite:200,codeRun:260,aPlanStep:80,aCodeWrite:110,aCodeRun:150,handoff:650,results:500};
  function runJourneyHtml(){return journey('run','run');}
  function renderRun(){
    if(runState.studyId!==state.studyId){runState.status='idle';runState.studyId=state.studyId;}
    const study=activeStudy();
    return `<section class="screen run-screen" data-run-screen>
      <div id="runJourney">${runJourneyHtml()}</div>
      <div class="run-toolbar">
        <div class="run-title"><h1>${esc(study.title)}</h1><p><span class="run-sim-tag">Simulated demo</span>Replays the outputs recorded in an actual end-to-end run · ${esc(study.dataset)} ${esc(study.version)}</p></div>
        <div class="run-controls">
          <span class="run-clock" id="runClock" aria-live="off">00:00</span>
          <button class="button quiet small" type="button" id="runPause">Pause</button>
          <button class="button quiet small" type="button" id="runSkip">Skip to results</button>
          <button class="button quiet small" type="button" id="runRestart">Restart</button>
        </div>
      </div>
      <div class="run-feed scroll-region" id="runFeed" aria-live="polite"></div>
      <button class="button small run-follow" type="button" id="runFollow" hidden>Follow live progress ↓</button>
    </section>`;
  }
  function bindRun(){
    const screen=document.querySelector('[data-run-screen]');if(!screen)return;
    const feed=$('runFeed');
    $('runPause').addEventListener('click',()=>{runState.paused=!runState.paused;$('runPause').textContent=runState.paused?'Resume':'Pause';});
    $('runSkip').addEventListener('click',()=>{runState.skip=true;runState.paused=false;$('runPause').textContent='Pause';});
    $('runRestart').addEventListener('click',()=>{runState.status='idle';go(stagePath('run'));});
    $('runFollow').addEventListener('click',()=>{runState.follow=true;$('runFollow').hidden=true;feed.scrollTop=feed.scrollHeight;});
    feed.addEventListener('scroll',()=>{runState.follow=feed.scrollHeight-feed.scrollTop-feed.clientHeight<120;$('runFollow').hidden=runState.follow||runState.status!=='running';},{passive:true});
    feed.addEventListener('click',e=>{
      const row=e.target.closest('[data-run-step]');if(row){const P=pipes()[row.dataset.runPipe];runStepDialog(P,P.steps.find(s=>s.step===Number(row.dataset.runStep)));return;}
      const b=e.target.closest('[data-run-open]');if(!b)return;
      const k=b.dataset.runOpen;
      if(k==='design'){const o=D.outputs[studyDesignKey()];showDialog(o.filename,`<div class="artifact-dialog-actions"><a class="button quiet" href="${esc(o.url)}" download>Download</a></div>${rawOutput(o.text,'Strategy Agent output')}`,'STRATEGY AGENT · STUDY PROTOCOL');}
      else if(k==='cohortPlan'||k==='analysisPlan'){const P=pipes()[k==='cohortPlan'?'cohort':'analysis'],o=D.outputs[P.planKey];showDialog(o.filename,`<div class="artifact-dialog-actions"><a class="button quiet" href="${esc(o.url)}" download>Download plan</a></div>${rawOutput(o.text,'Planning Agent output')}`,'PLANNING AGENT · '+(P.id==='cohort'?'PREPROCESSING PLAN':'ANALYSIS PLAN'));}
      else if(k==='columns'){const data=isNhis()?nhis.final:PIPE.final,c=recordedCohort();const cols=(data?.columns||[]).map(x=>typeof x==='string'?{name:x}:x);showDialog(c?.name||'Cohort dataset',`<table class="artifact-columns"><thead><tr><th scope="col">Column</th><th scope="col">Type</th></tr></thead><tbody>${cols.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.type||'—')}</td></tr>`).join('')}</tbody></table>`,'COHORT DATASET · COLUMNS');}
    });
    playLiveRun();
  }
  function runStepDialog(P,s){
    if(!s)return;
    const outs=P.outputs(s).map(o=>{const meta=o.kind==='png'?'Figure':typeof o.rows==='number'?`${fmt(o.rows)} rows${o.columns?.length?` × ${o.columns.length} columns`:''}`:(o.kind||'').toUpperCase();return `<li><code>${esc(o.name)}</code>${meta?` <span>${esc(meta)}</span>`:''}</li>`;}).join('');
    showDialog(s.file,`<p class="run-dialog-task"><b>Task</b> ${esc(scriptTitle(P,s))}</p>${outs?`<h3 class="run-dialog-h">Outputs</h3><ul class="run-dialog-outputs">${outs}</ul>`:''}<h3 class="run-dialog-h">Code</h3>${s.code?rawOutput(s.code,'Generated code'):'<p class="small-note">Script not connected yet</p>'}`,(P.id==='cohort'?'PREPROCESSING':'ANALYSIS')+` · STEP ${pad(s.step)} OF ${P.steps.length}`);
  }
  async function playLiveRun(){
    const token=++runState.token;
    const instant=runState.status==='done';
    Object.assign(runState,{status:'running',paused:false,skip:instant,follow:true,current:[],started:performance.now()-(instant?runState.elapsed:0)});
    const alive=()=>token===runState.token&&document.querySelector('[data-run-screen]');
    clearInterval(runState.timer);
    const tick=()=>{if(!alive()){clearInterval(runState.timer);return;}if(!runState.paused&&runState.status==='running')runState.elapsed=performance.now()-runState.started;const s=Math.floor(runState.elapsed/1000);$('runClock').textContent=`${pad(Math.floor(s/60))}:${pad(s%60)}`;};
    runState.timer=setInterval(tick,250);
    const wait=async ms=>{if(runState.skip)return alive();let left=ms;while(left>0){if(!alive())return false;if(runState.skip)return true;const t=Math.min(left,60);await sleep(t);if(!runState.paused)left-=t;else runState.started+=t;}return alive();};
    const feed=$('runFeed');
    const follow=()=>{if(runState.follow&&!runState.skip)feed.scrollTop=feed.scrollHeight;};
    const setNow=ids=>{runState.current=ids;const box=$('runJourney');if(box)box.innerHTML=runJourneyHtml();};
    const card=(id,tag,title,body='')=>{feed.insertAdjacentHTML('beforeend',`<article class="run-card is-running" id="run-${id}"><header class="run-card-head"><span class="run-card-tag">${esc(tag)}</span><h2>${esc(title)}</h2><span class="run-card-status"><span class="run-spinner" aria-hidden="true"></span><span class="run-card-status-text">Running</span></span></header><div class="run-card-body">${body}</div></article>`);follow();return $('run-'+id);};
    const done=(el,text)=>{el.classList.remove('is-running');el.classList.add('is-done');el.querySelector('.run-card-status').innerHTML=`<span class="run-check" aria-hidden="true">✓</span><span class="run-card-status-text">${esc(text)}</span>`;};
    const study=activeStudy(),C=pipes().cohort,A=pipes().analysis;

    // 1. Research question
    setNow(['question']);
    let el=card('question','Input','Research question',`<blockquote class="run-question">${esc(state.question)}</blockquote>`);
    if(!await wait(runTiming.question))return;done(el,'Received');

    // 2. Strategy Agent streams the protocol
    setNow(['strategy']);
    el=card('strategy','Study design','Strategy Agent · writing the study protocol',`<p class="run-line"><span class="run-spinner" aria-hidden="true"></span>Reading the research question…</p><pre class="run-stream" id="runStream"></pre>`);
    if(!await wait(runTiming.think))return;
    const text=D.outputs[studyDesignKey()]?.text||'';
    el.querySelector('.run-line').textContent='Writing the protocol…';
    const shown=text.slice(0,Math.min(text.length,1600)),chunks=40;
    for(let i=1;i<=chunks;i++){if(runState.skip)break;$('runStream').textContent=shown.slice(0,Math.round(shown.length*i/chunks));$('runStream').scrollTop=$('runStream').scrollHeight;if(!await wait(runTiming.stream/chunks))return;}
    $('runStream').textContent=shown+(text.length>shown.length?'\n…':'');
    el.querySelector('.run-line').outerHTML=`<p class="run-result">Study protocol ready <button class="text-button" type="button" data-run-open="design">View full protocol</button></p>`;
    done(el,'Protocol ready');follow();

    // 3-4. Preprocessing: planning, then coding + run & repair
    await runPipe(C,{planIds:['pPlan'],codeIds:['pCode','pRun'],planTitle:'Planning Agent · preprocessing plan',codeTitle:'Coding Agent + Run & repair · preprocessing',tag:'Preprocessing phase',planKey:'cohortPlan',stepMs:[runTiming.planStep,runTiming.codeWrite,runTiming.codeRun]},{wait,card,done,setNow,follow,alive});
    if(!alive())return;

    // 5. Cohort dataset handoff
    setNow(['dataset']);
    const c=recordedCohort();
    el=card('dataset','Output','Cohort dataset',c?`<div class="run-dataset"><strong>${esc(c.name)}</strong><span>${fmt(c.rows)} rows · ${fmt(c.columns)} columns · ${esc(c.source)}</span><span class="run-dataset-note">Selected as the input for the analysis phase. Patient-level rows stay in the local environment.</span><button class="text-button" type="button" data-run-open="columns">View columns</button></div>`:'<p class="small-note">Not connected yet</p>');
    if(c)state.analysisDataset=c.name;
    if(!await wait(runTiming.handoff))return;done(el,'Cohort ready');

    // 6-7. Analysis
    await runPipe(A,{planIds:['aPlan'],codeIds:['aCode','aRun'],planTitle:'Planning Agent · analysis plan',codeTitle:'Coding Agent + Run & repair · analysis',tag:'Analysis phase',planKey:'analysisPlan',stepMs:[runTiming.aPlanStep,runTiming.aCodeWrite,runTiming.aCodeRun]},{wait,card,done,setNow,follow,alive});
    if(!alive())return;

    // 8. Results
    setNow(['results']);
    const files=resultArtifacts()?.files||[];
    const cur=files.find(o=>o.name===resultView.file)||files[0];if(cur)resultView.file=cur.name;
    el=card('results','Output','Results',files.length?`<div class="results-layout run-results">
        <nav class="panel output-files" aria-label="Output files"><ul>${files.map(o=>`<li><button type="button" class="output-file ${o.name===resultView.file?'active':''}" aria-pressed="${o.name===resultView.file}" data-result-file="${esc(o.name)}"><span class="file-badge ${o.kind}">${esc(o.kind.toUpperCase())}</span><span class="output-file-name">${esc(o.label)}</span><span class="file-size">${kb(o.bytes)}</span></button></li>`).join('')}</ul></nav>
        <section class="panel file-pane" id="filePane">${cur?filePane(cur):''}</section>
      </div>`:'<p class="small-note">The analysis outputs are not connected.</p>');
    el.querySelectorAll('[data-result-file]').forEach(b=>b.addEventListener('click',()=>{resultView.file=b.dataset.resultFile;resultView.sheet=null;showResultFile();}));
    bindResultPane();
    if(!await wait(runTiming.results))return;
    done(el,`${files.length} result files`);
    runState.status='done';runState.elapsed=performance.now()-runState.started;tick();clearInterval(runState.timer);
    setNow(['results']);
    feed.insertAdjacentHTML('beforeend',`<footer class="run-end"><span class="run-check" aria-hidden="true">✓</span><p>End-to-end run complete · simulated replay of the recorded outputs</p><div class="button-row"><button class="button quiet" type="button" data-run-again>Replay from the start</button><a class="button primary" href="#/question">Other study examples</a></div></footer>`);
    feed.querySelector('[data-run-again]').addEventListener('click',()=>{runState.status='idle';go(stagePath('run'));});
    $('runPause').disabled=true;$('runSkip').disabled=true;$('runFollow').hidden=true;
    const res=$('run-results');
    if(res)feed.scrollTop+=res.getBoundingClientRect().top-feed.getBoundingClientRect().top-4;
  }
  async function runPipe(P,o,{wait,card,done,setNow,follow,alive}){
    // Planning Agent: the ordered steps appear one by one
    setNow(o.planIds);
    let el=card(P.id+'-plan',o.tag,o.planTitle,`<p class="run-line"><span class="run-spinner" aria-hidden="true"></span>${esc(P.reading)}</p><ol class="run-plan" id="runPlan-${P.id}"></ol>`);
    if(!await wait(runTiming.planHead))return;
    const list=$('runPlan-'+P.id),steps=P.planSteps.length?P.planSteps:P.steps.map(s=>({step_name:s.title||s.file}));
    el.querySelector('.run-line').textContent='Writing the step-by-step plan…';
    for(let i=0;i<steps.length;i++){
      list.insertAdjacentHTML('beforeend',`<li><span class="run-index">${pad(i+1)}</span><span>${esc(planTitle(steps[i],'Step '+(i+1)))}</span></li>`);
      list.scrollTop=list.scrollHeight;
      if(!await wait(o.stepMs[0]))return;
    }
    el.querySelector('.run-line').outerHTML=`<p class="run-result">${steps.length}-step plan ready <button class="text-button" type="button" data-run-open="${o.planKey}">View plan</button></p>`;
    done(el,`${steps.length} steps`);follow();

    // Coding Agent + Run & repair: each script is written, run, and its output recorded
    setNow(o.codeIds);
    const n=P.steps.length;
    el=card(P.id+'-code',o.tag,o.codeTitle,`<div class="run-progress"><span class="run-progress-bar"><i id="runBar-${P.id}"></i></span><span id="runCount-${P.id}">0 / ${n}</span></div><ol class="run-steps" id="runSteps-${P.id}"></ol>`);
    const rows=$('runSteps-'+P.id);
    for(const s of P.steps){
      rows.insertAdjacentHTML('beforeend',`<li class="is-running" data-run-step="${s.step}" data-run-pipe="${P.id}" title="Open this step"><span class="run-index">${pad(s.step)}</span><span class="run-step-main"><strong>${esc(scriptTitle(P,s))}</strong><small>${esc(s.file)}</small></span><span class="run-step-state">Writing code…</span></li>`);
      const row=rows.lastElementChild;rows.scrollTop=rows.scrollHeight;follow();
      if(!await wait(o.stepMs[1]))return;
      row.querySelector('.run-step-state').textContent='Running…';
      if(!await wait(o.stepMs[2]))return;
      row.classList.remove('is-running');row.classList.add('is-done');
      row.querySelector('.run-step-state').textContent=rowDone(P,s);
      $('runBar-'+P.id).style.width=(s.step/n*100)+'%';$('runCount-'+P.id).textContent=`${s.step} / ${n}`;
    }
    done(el,`${n} scripts run`);follow();
  }
  /* Handoff effect: the finished output travels along the workflow bar to the next agent, the page slides on. */
  const handoffTarget={'cohort':'pPlan','cohort/coding':'pCode','dataset':'dataset','analysis':'dataset','analysis/planning':'aPlan','analysis/coding':'aCode','results':'results'};
  const handoffLabel={'cohort':'Study protocol','cohort/coding':'Preprocessing plan','dataset':'Study cohort','analysis':'Cohort dataset','analysis/planning':'Protocol + cohort','analysis/coding':'Analysis plan','results':'Estimates & figures'};
  function handoff(path){
    if(path==='cohort'){pipes().cohort.run.token++;pipes().cohort.run.planReady=false;}
    if(path==='analysis/planning'){pipes().analysis.run.token++;pipes().analysis.run.planReady=false;}
    const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bar=document.querySelector('.journey'),screen=document.querySelector('#main .screen');
    const from=document.querySelector('.journey-node.is-current .journey-step'),to=document.querySelector(`[data-journey-go="${handoffTarget[path]}"]`)||document.querySelector('.journey-node.is-current .journey-step');
    if(reduce||!bar||!from||!to){go(stagePath(path));return;}
    screen?.classList.remove('handoff-in');
    if(from===to){screen?.classList.add('handoff-out');state.handoffIn=true;setTimeout(()=>go(stagePath(path)),700);return;}
    const b=bar.getBoundingClientRect(),f=from.getBoundingClientRect(),t=to.getBoundingClientRect();
    const pk=document.createElement('div');pk.className='handoff-packet';pk.textContent=handoffLabel[path]||'Output';
    bar.appendChild(pk);
    const w=pk.offsetWidth,h=pk.offsetHeight;
    pk.style.left=(f.left-b.left+f.width/2-w/2)+'px';pk.style.top=(f.top-b.top+f.height/2-h/2)+'px';
    pk.getBoundingClientRect();
    pk.classList.add('go');pk.style.transform=`translate(${t.left-f.left+(t.width-f.width)/2}px,${t.top-f.top}px)`;
    to.classList.add('handoff-target');
    screen?.classList.remove('handoff-in');screen?.classList.add('handoff-out');
    state.handoffIn=true;
    setTimeout(()=>go(stagePath(path)),900);
  }
  /* Typing effect: a freshly generated output is written out rather than shown at once. */
  let typingUntil=0;
  function typeOut(pre){
    const code=pre&&(pre.querySelector('code')||pre);if(!code)return 0;
    const full=code.textContent,html=code.innerHTML;
    if(!full||matchMedia('(prefers-reduced-motion: reduce)').matches)return 0;
    const ms=Math.min(9000,Math.max(4000,full.length*.9));
    code.textContent='';pre.classList.add('is-typing');
    const t0=performance.now();
    const step=now=>{
      if(!pre.isConnected)return;
      const k=Math.min(1,(now-t0)/ms);
      code.textContent=full.slice(0,Math.floor(full.length*k));
      pre.scrollTop=pre.scrollHeight;
      if(k<1)requestAnimationFrame(step);else{code.innerHTML=html;pre.classList.remove('is-typing');}
    };
    requestAnimationFrame(step);
    typingUntil=performance.now()+ms;
    return ms;
  }
  function startTyping(){
    if(state.typeStrategy&&route?.section==='strategy'){state.typeStrategy=false;typeOut(document.querySelector('.strategy-layout .output-panel pre.recorded-output'));}
    const P=route&&(route.section==='cohort'?pipes().cohort:route.section==='analysis'&&route.detail==='planning'?pipes().analysis:null);
    if(P&&P.run.typePlan&&route.detail!=='coding'){P.run.typePlan=false;typeOut(document.querySelector('.recorded-plan > .output-panel:last-child pre.recorded-output'));}
  }
  /* ---------- Auto-play across the step pages ---------- */
  let autoTimer=null,autoTick=null,autoDeadline=0;
  function autoClear(){clearTimeout(autoTimer);clearInterval(autoTick);autoTimer=autoTick=null;}
  /* One status line for the whole replay: always says what is happening now (busy) or what just finished (done). */
  function autoText(text,kind='busy'){
    const el=$('autoStatus');if(!el)return;
    el.className='auto-status is-'+kind;
    el.innerHTML=`${kind==='busy'?'<span class="auto-spin" aria-hidden="true"></span>':'<span class="auto-check" aria-hidden="true">✓</span>'}<span>${esc(text)}</span>`;
  }
  const autoPause={read:1800,plan:1800,code:1800,dataset:3500};
  function autoStep(){
    autoClear();
    if(!state.started||!route||route.section==='question'||!paths.includes(route.section)||route.section==='run')return;
    if(state.autoDone){autoText('Workflow complete · click any step to review it','done');return;}
    const sec=route.section,d=route.detail,C=pipes().cohort,A=pipes().analysis;
    /* While the output is still being written, say so; then show what finished, pause briefly, and hand off. */
    const next=(writing,finished,pause,path)=>{
      const go2=()=>{autoText(finished,'done');autoTimer=setTimeout(()=>{autoClear();if(!state.autoPaused)handoff(path);},pause);};
      const wait=typingUntil-performance.now();
      if(wait>0){autoText(writing);autoTimer=setTimeout(go2,wait);}else go2();
    };
    if(sec==='strategy'){
      if(state.generating||!state.generated)autoText('Strategy Agent is writing the study protocol…');
      if(!state.generated&&!state.generating)autoTimer=setTimeout(()=>{if(route.section==='strategy'&&!state.generated&&!state.generating)runStrategyGeneration();},1200);
      else if(state.generated)next('Strategy Agent is writing the study protocol…','Study protocol ready · passing it to the Planning Agent',autoPause.read,'cohort');
    }else if(sec==='cohort'){
      if(d==='coding'&&C.run.planReady){if(C.run.status!=='done')autoText('Coding Agent is writing and running the preprocessing scripts…');else next('','Preprocessing scripts finished · cohort dataset built',autoPause.code,'dataset');}
      else if(!C.run.planReady)autoText('Planning Agent is writing the preprocessing plan…');
      else next('Planning Agent is writing the preprocessing plan…','Preprocessing plan ready · passing it to the Coding Agent',autoPause.plan,'cohort/coding');
    }else if(sec==='dataset')next('','Cohort dataset ready · passing it to the analysis phase',autoPause.dataset,'analysis/planning');
    else if(sec==='analysis'){
      if(d==='coding'&&A.run.planReady){if(A.run.status!=='done')autoText('Coding Agent is writing and running the analysis scripts…');else next('','Analysis scripts finished · results produced',autoPause.code,'results');}
      else if(!A.run.planReady)autoText('Planning Agent is writing the analysis plan…');
      else next('Planning Agent is writing the analysis plan…','Analysis plan ready · passing it to the Coding Agent',autoPause.plan,'analysis/coding');
    }else if(sec==='results'){state.autoDone=true;autoText('Workflow complete · click any step to review it','done');}
  }
  function jumpTo(id){
    const order=['strategy','pPlan','pCode','pRun','dataset','aPlan','aCode','aRun','results'],k=order.indexOf(id),C=pipes().cohort,A=pipes().analysis;
    const n=journeyNodes.find(x=>x.id===id);if(!n||k<0)return;
    if(state.autoDone){
      /* After a full run, steps open in their finished state; nothing replays. */
      state.genToken++;Object.assign(state,{generating:false,generated:true,typeStrategy:false});
      for(const R of [C.run,A.run]){R.token++;Object.assign(R,{planReady:true,status:'done',typePlan:false});}
      const c=recordedCohort();if(c)state.analysisDataset=c.name;
      go(stagePath(n.href));return;
    }
    if(k>=1){state.genToken++;state.generating=false;state.generated=true;}
    if(k>=2)C.run.planReady=true;
    if(k>=4){C.run.token++;C.run.status='done';}
    if(k>=5){const c=recordedCohort();if(c)state.analysisDataset=c.name;}
    if(k>=6)A.run.planReady=true;
    if(k>=8){A.run.token++;A.run.status='done';}
    if(id==='strategy'){state.genToken++;state.generating=false;state.generated=false;}
    if(id==='pPlan'){C.run.token++;C.run.planReady=false;}
    if(id==='aPlan'){A.run.token++;A.run.planReady=false;}
    state.reached=Math.max(state.reached,stepIndex[n.href.split('/')[0]]||0);
    go(stagePath(n.href));
  }
  function ioLabels(){
    document.querySelectorAll('#main .eyebrow, #detailDialog .eyebrow').forEach(e=>{if(e.dataset.io)return;const m=e.textContent.trim().match(/^(INPUT|OUTPUT)(\s*\d*)\s*(?:·\s*(.*))?$/);if(!m)return;e.dataset.io='1';e.classList.add('io-eyebrow');e.innerHTML=`<span class="io-tag io-${m[1]==='INPUT'?'in':'out'}">${m[1]}${m[2]?' '+m[2].trim():''}</span>${m[3]?`<span class="io-rest">${esc(m[3])}</span>`:''}`;});
  }
  const ioObserver=new MutationObserver(()=>ioLabels());
  queueMicrotask(()=>{const m=document.getElementById('main');if(m)ioObserver.observe(m,{childList:true,subtree:true});});
  function resetAll(){
    Object.assign(state,{studyId:'pravastatin',reached:0,question:recordedQuestion,draft:recordedQuestion,started:false,exampleId:null,generated:false,generating:false,analysisDataset:'',autoDone:false});state.genToken++;
    for(const R of [cohortRun,analysisRun,...Object.values(nhisPipes||{}).map(P=>P.run)]){R.token++;Object.assign(R,{status:'idle',selected:1,planReady:false});}Object.assign(datasetView,{page:0,filter:''});resultView.file=null;resultView.sheet=null;featureId='handoffs';introWorkflow='';state.autoPaused=false;autoClear();runState.token++;runState.status='idle';runState.studyId=null;
    try{sessionStorage.removeItem('cohortflow-connected-question');sessionStorage.removeItem('cohortflow-reached');}catch{}
  }
  /* Top-nav steps unlock one by one as each screen is reached; Home locks them again. */
  const stepIndex={strategy:1,cohort:2,dataset:3,analysis:4,results:5};
  function navigationLimit(section){
    if(!state.started)return 0;
    const pipeline=pipes()[section];
    const waiting=section==='strategy'&&!state.generated||pipeline&&pipeline.run.status!=='done';
    return waiting?Math.min(state.reached,stepIndex[section]):state.reached;
  }
  function markReached(section){const i=stepIndex[section];if(!i||i<=state.reached)return;state.reached=i;try{sessionStorage.setItem('cohortflow-reached',String(i));}catch{}}
  function render(r){route=r;
    if(r.section==='intro')return renderIntro();
    if(r.section==='guide')return renderGuide(r.detail);
    const study=studyExamples.find(ex=>ex.id===r.params.get('study'));
    if(r.section!=='question'&&study&&(!state.started||state.studyId!==study.id))activateStudy(study,study.question);
    if(r.section!=='question'&&!state.started)return guard();markReached(r.section);return ({question:renderQuestion,strategy:renderStrategy,cohort:renderCohort,dataset:renderDataset,analysis:renderAnalysis,results:renderResults,run:renderRun}[r.section]||renderQuestion)();}
  function bind(){
    document.querySelectorAll('[data-intro-workflow]').forEach(button=>button.addEventListener('click',()=>showIntroWorkflow(button.dataset.introWorkflow)));
    bindIntroSlides();
    $('introWorkflowDetail')?.addEventListener('click',event=>{
      const button=event.target.closest('[data-related-workflow]');
      if(button)showIntroWorkflow(button.dataset.relatedWorkflow);
    });
    bindWorkflowPreviews();
    document.querySelectorAll('.journey-track').forEach(track=>{const cur=track.querySelector('.journey-group.is-active');if(cur&&track.scrollWidth>track.clientWidth)track.scrollLeft=Math.max(0,cur.offsetLeft+cur.offsetWidth/2-track.clientWidth/2);});
    const featureButtons=document.querySelectorAll('[data-system-feature]');
    featureButtons.forEach(button=>button.addEventListener('click',()=>{
      featureId=button.dataset.systemFeature;
      featureButtons.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
      $('systemFeatureDetail').innerHTML=featureDetails();
    }));
    document.querySelectorAll('[data-stage-guide]').forEach(button=>button.addEventListener('click',()=>{
      const stage=workflowStages.find(item=>item.id===guideId(button.dataset.stageGuide));
      showDialog(stage.title,guideContent(stage.id),'WORKFLOW GUIDE');
    }));
    document.querySelectorAll('[data-study-example]').forEach(card=>card.addEventListener('click',e=>{if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;e.preventDefault();const ex=studyExamples.find(x=>x.id===card.dataset.studyExample);resetAll();startQuestion(ex.question);}));
    document.querySelectorAll('[data-current-question]').forEach(b=>b.addEventListener('click',questionDialog));
    document.querySelectorAll('[data-open-recorded]').forEach(b=>b.addEventListener('click',()=>{const target=route&&paths.includes(route.section)&&route.section!=='question'?route.section:'strategy';startQuestion(activeStudy().question,target);}));
    document.querySelectorAll('[data-restart]').forEach(b=>b.addEventListener('click',()=>{resetAll();go('/intro');}));
    if($('researchQuestion'))$('researchQuestion').addEventListener('input',()=>{state.draft=$('researchQuestion').value;if($('questionError'))$('questionError').hidden=true;});
    if($('questionForm'))$('questionForm').addEventListener('submit',e=>{e.preventDefault();startQuestion($('researchQuestion').value);});
    if($('useConnectedQuestion'))$('useConnectedQuestion').addEventListener('click',()=>{state.draft=recordedQuestion;if(route.params.get('example')){state.exampleId=null;go('/question?mode=input');return;}$('researchQuestion').value=recordedQuestion;$('questionError').hidden=true;$('researchQuestion').focus();});
    document.querySelectorAll('[data-process-details]').forEach(b=>b.addEventListener('click',()=>showDialog('A question becomes an analysis task.','<h3>Strategy Agent</h3><p>Specifies the research question as population, exposure, comparator, outcome, timing, and analysis conditions.</p><h3>Planning Agent</h3><p>Uses that specification to create an ordered plan, with an input, operation, and output for each step.</p><h3>Coding, local execution & repair</h3><p>Implements each plan operation as code. Execution uses local data; a local Repair Agent handles runtime errors. A consistency Checkpoint is optional.</p><h3>Result analysis</h3><p>Shows the final outputs for the original question. Missing records remain clearly marked.</p><p class="small-note">This demo replays connected artifacts. It does not submit new model calls or run database analysis.</p>','AUTOMATION PROCESS')));
    document.querySelectorAll('[data-input-design]').forEach(b=>b.addEventListener('click',()=>showDialog('The study design passed to Planning',rawOutput(D.outputs[studyDesignKey()].text,'Strategy Agent output'),'STRATEGY OUTPUT · PLANNING INPUT')));
    if($('generateStrategy'))$('generateStrategy').addEventListener('click',runStrategyGeneration);
    document.querySelectorAll('[data-nhis-details]').forEach(button=>button.addEventListener('click',()=>nhisDetails(button.dataset.nhisDetails)));
    bindPipeline();bindRun();
    document.querySelectorAll('[data-journey-go]').forEach(b=>b.addEventListener('click',()=>jumpTo(b.dataset.journeyGo)));
    document.querySelector('[data-auto-toggle]')?.addEventListener('click',e=>{state.autoPaused=!state.autoPaused;e.currentTarget.textContent=state.autoPaused?'Resume auto-play':'Pause auto-play';autoStep();});
    if(state.handoffIn){state.handoffIn=false;const sc=document.querySelector('#main .screen');if(sc)sc.classList.add('handoff-in');}
    ioLabels();
    startTyping();autoStep();
  }
  function primaryForArtifact(id){return id==='strategy'||id==='components'?'question':/^analysis/.test(id)?'analysis':id==='results'?'results':'cohort';}
  return{render,renderProgress,renderGuideNavigation,bind,resetAll,stagePath,paths,names,primaryForArtifact,question:()=>state.question,started:()=>state.started};
};
