/* ============================================================
   GAFFER — shared UI: Jersey, Pitch, BudgetBar, Modal, etc.
   ============================================================ */
(function(){
  const { useState, useEffect, useRef } = React;
  const Icon = window.Icon, Flag = window.Flag;

  // ---- country jersey colors: [body, accent(collar/sleeve), isLight] ----
  const KIT = {
    BRA:['#FFD000','#1B9E4B',1], FRA:['#1B3A8C','#E11D2E',0], ENG:['#FFFFFF','#E11D2E',1],
    ESP:['#C60B1E','#FFC400',0], ARG:['#74ACDF','#FFFFFF',1], GER:['#FFFFFF','#16161A',1],
    POR:['#C8102E','#0E6B3C',0], NED:['#F36C21','#16161A',0], BEL:['#E2353C','#FFD500',0],
    CRO:['#E2353C','#FFFFFF',0], USA:['#1B3A8C','#FFFFFF',0], MEX:['#0E7A3C','#FFFFFF',0],
    CAN:['#D1182B','#FFFFFF',0], JPN:['#1B2E8C','#FFFFFF',0], MAR:['#C60B1E','#0E6B3C',0],
    SEN:['#0E8A3C','#FFD500',0], URU:['#5BA8E0','#16161A',1], ITA:['#1E68C8','#FFFFFF',0],
    AUS:['#FFCE00','#0E7A3C',1],
  };
  function Jersey({code, size=42}){
    const [body, acc] = KIT[code] || ['#2A3649','#5E6B7E',0];
    return React.createElement('svg',{width:size,height:size,viewBox:'0 0 48 48',style:{filter:'drop-shadow(0 3px 4px rgba(0,0,0,.45))'}},
      React.createElement('path',{d:'M17 7 L24 11 L31 7 L42 14 L37 22 L33 19 V41 H15 V19 L11 22 L6 14 Z', fill:body, stroke:'rgba(0,0,0,.25)', strokeWidth:.8}),
      React.createElement('path',{d:'M17 7 L24 11 L31 7 L34 9 L24 14 L14 9 Z', fill:acc}),
      React.createElement('path',{d:'M11 22 L6 14 L11 11 L15 19 Z', fill:acc, opacity:.92}),
      React.createElement('path',{d:'M37 22 L42 14 L37 11 L33 19 Z', fill:acc, opacity:.92}),
    );
  }
  window.Jersey = Jersey;

  // =========================== PITCH ===========================
  function PitchBg(){
    return React.createElement('svg',{className:'pitch-lines',viewBox:'0 0 300 380',preserveAspectRatio:'none',
      style:{position:'absolute',inset:0,width:'100%',height:'100%'}},
      React.createElement('rect',{x:6,y:6,width:288,height:368,rx:6,fill:'none',stroke:'var(--pitch-line)',strokeWidth:1.5}),
      React.createElement('line',{x1:6,y1:190,x2:294,y2:190,stroke:'var(--pitch-line)',strokeWidth:1.2}),
      React.createElement('circle',{cx:150,cy:190,r:42,fill:'none',stroke:'var(--pitch-line)',strokeWidth:1.2}),
      React.createElement('circle',{cx:150,cy:190,r:2.5,fill:'var(--pitch-line)'}),
      // top box
      React.createElement('rect',{x:95,y:6,width:110,height:46,fill:'none',stroke:'var(--pitch-line)',strokeWidth:1.2}),
      React.createElement('rect',{x:125,y:6,width:50,height:18,fill:'none',stroke:'var(--pitch-line)',strokeWidth:1.2}),
      // bottom box
      React.createElement('rect',{x:95,y:328,width:110,height:46,fill:'none',stroke:'var(--pitch-line)',strokeWidth:1.2}),
      React.createElement('rect',{x:125,y:356,width:50,height:18,fill:'none',stroke:'var(--pitch-line)',strokeWidth:1.2}),
    );
  }

  function PlayerToken({player, pos, captain, vice, gwPts, mode, onClick, picked}){
    const D = window.GAFFER_DATA;
    if(!player){
      return React.createElement('button',{className:'slot slot-empty', onClick},
        React.createElement('span',{className:'slot-plus'}, React.createElement(Icon,{name:'plus',size:22,stroke:2})),
        React.createElement('span',{className:'slot-pos pos pos-'+pos}, pos)
      );
    }
    const elim = player.eliminated;
    return React.createElement('button',{className:'slot'+(elim?' is-elim':''), onClick},
      captain && React.createElement('span',{className:'cap-badge'},'C'),
      vice && React.createElement('span',{className:'cap-badge vice'},'V'),
      React.createElement('div',{className:'slot-jersey'}, React.createElement(Jersey,{code:player.country,size:46})),
      React.createElement('div',{className:'slot-flag'}, React.createElement(Flag,{code:player.country,size:13,round:true})),
      React.createElement('div',{className:'slot-name'}, player.name.split(' ').slice(-1)[0]),
      mode==='view'
        ? React.createElement('div',{className:'slot-pts num'+(typeof gwPts==='number'&&gwPts>=8?' hot':'')},
            elim ? 'OUT' : (captain? (gwPts*2):gwPts))
        : React.createElement('div',{className:'slot-price num'}, '£'+player.price.toFixed(1)),
    );
  }

  function Pitch({squad, captain, vice, mode='view', gwPoints, onSlot, compact}){
    const D = window.GAFFER_DATA;
    const order = ['GK','DEF','MID','FWD'];
    return React.createElement('div',{className:'pitch'+(compact?' compact':'')},
      React.createElement(PitchBg),
      React.createElement('div',{className:'pitch-rows'},
        order.map(pos =>
          React.createElement('div',{key:pos,className:'pitch-row'},
            (squad[pos]||[]).map((id,i)=>{
              const player = id? D.PLAYER_BY_ID[id]:null;
              return React.createElement(PlayerToken,{key:pos+i, player, pos,
                captain: id&&id===captain, vice: id&&id===vice,
                gwPts: gwPoints && id!=null ? (gwPoints[id]??0):undefined, mode,
                onClick:()=>onSlot&&onSlot(pos,i,player)});
            })
          )
        )
      )
    );
  }
  window.Pitch = Pitch; window.PitchBg = PitchBg;

  // =========================== BUDGET BAR ===========================
  function BudgetBar({budget, spent, count, max}){
    const remaining = budget - spent;
    const pct = Math.min(100, (spent/budget)*100);
    const over = remaining < -0.001;
    return React.createElement('div',{className:'budgetbar'+(over?' over':'')},
      React.createElement('div',{className:'bb-stat'},
        React.createElement('div',{className:'bb-label'},'Squad'),
        React.createElement('div',{className:'bb-val num'}, (count||0)+'/15')),
      React.createElement('div',{className:'bb-track-wrap'},
        React.createElement('div',{className:'bb-track'},
          React.createElement('div',{className:'bb-fill',style:{width:pct+'%'}})),
        React.createElement('div',{className:'bb-track-labels'},
          React.createElement('span',{className:'muted'},'£'+spent.toFixed(1)+'m spent'),
          React.createElement('span',{className:'muted'},'£'+budget.toFixed(0)+'m budget'))),
      React.createElement('div',{className:'bb-stat right'},
        React.createElement('div',{className:'bb-label'}, over?'Over by':'Remaining'),
        React.createElement('div',{className:'bb-val num '+(over?'neg':'pos')}, '£'+Math.abs(remaining).toFixed(1)+'m'))
    );
  }
  window.BudgetBar = BudgetBar;

  // =========================== MODAL / SHEET ===========================
  function Modal({open, onClose, children, title, wide, side}){
    useEffect(()=>{
      if(!open) return;
      const h = e => e.key==='Escape' && onClose && onClose();
      window.addEventListener('keydown',h); return ()=>window.removeEventListener('keydown',h);
    },[open,onClose]);
    if(!open) return null;
    return React.createElement('div',{className:'modal-overlay'+(side?' side':''), onMouseDown:e=>{ if(e.target===e.currentTarget) onClose&&onClose(); }},
      React.createElement('div',{className:'modal'+(wide?' wide':'')+(side?' modal-side':''), onMouseDown:e=>e.stopPropagation()},
        title!==undefined && React.createElement('div',{className:'modal-head'},
          React.createElement('h3',null, title),
          React.createElement('button',{className:'icon-btn', onClick:onClose}, React.createElement(Icon,{name:'close',size:20}))),
        children
      )
    );
  }
  window.Modal = Modal;

  function IconBtn({name, onClick, size=20, active, title}){
    return React.createElement('button',{className:'icon-btn'+(active?' active':''), onClick, title},
      React.createElement(Icon,{name,size}));
  }
  window.IconBtn = IconBtn;

  // =========================== STAT CARD ===========================
  function StatCard({label, value, sub, tone, icon}){
    return React.createElement('div',{className:'statcard'},
      React.createElement('div',{className:'sc-top'},
        React.createElement('span',{className:'sc-label'}, label),
        icon && React.createElement('span',{className:'sc-icon tone-'+(tone||'')}, React.createElement(Icon,{name:icon,size:16}))),
      React.createElement('div',{className:'sc-value num tone-'+(tone||'')}, value),
      sub && React.createElement('div',{className:'sc-sub'}, sub)
    );
  }
  window.StatCard = StatCard;

  // =========================== COUNTDOWN ===========================
  function Countdown({to, label}){
    const [now,setNow] = useState(Date.now());
    useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),1000); return ()=>clearInterval(t); },[]);
    let diff = Math.max(0, Math.floor((to-now)/1000));
    const d=Math.floor(diff/86400); diff-=d*86400;
    const h=Math.floor(diff/3600); diff-=h*3600;
    const m=Math.floor(diff/60); const s=diff-m*60;
    const seg=(v,l)=>React.createElement('div',{className:'cd-seg'},
      React.createElement('span',{className:'cd-num num'}, String(v).padStart(2,'0')),
      React.createElement('span',{className:'cd-unit'}, l));
    return React.createElement('div',{className:'countdown'},
      label && React.createElement('span',{className:'cd-label'}, label),
      React.createElement('div',{className:'cd-segs'}, seg(d,'days'), seg(h,'hrs'), seg(m,'min'), seg(s,'sec')));
  }
  window.Countdown = Countdown;

  // =========================== SEGMENTED ===========================
  function Segmented({options, value, onChange, size}){
    return React.createElement('div',{className:'seg'+(size==='sm'?' seg-sm':'')},
      options.map(o=>{
        const val = typeof o==='string'?o:o.value; const lab = typeof o==='string'?o:o.label;
        return React.createElement('button',{key:val, className:'seg-btn'+(val===value?' on':''), onClick:()=>onChange(val)}, lab);
      }));
  }
  window.Segmented = Segmented;

  // =========================== TOAST ===========================
  function useToast(){
    const [toast,setToast]=useState(null);
    const show=(msg,tone)=>{ setToast({msg,tone,id:Date.now()}); };
    useEffect(()=>{ if(!toast) return; const t=setTimeout(()=>setToast(null),2600); return ()=>clearTimeout(t); },[toast]);
    const node = toast && React.createElement('div',{className:'toast tone-'+(toast.tone||''), key:toast.id},
      React.createElement(Icon,{name: toast.tone==='error'?'info':'check', size:16}),
      React.createElement('span',null,toast.msg));
    return [node, show];
  }
  window.useToast = useToast;

  // sparkline for form
  function Spark({data, w=58, h=20}){
    const max=Math.max(...data,1), min=Math.min(...data,0);
    const rng=Math.max(1,max-min);
    const pts=data.map((v,i)=>[(i/(data.length-1))*w, h-((v-min)/rng)*(h-3)-1.5]);
    const d=pts.map((p,i)=>(i?'L':'M')+p[0].toFixed(1)+' '+p[1].toFixed(1)).join(' ');
    const last=data[data.length-1], prev=data[data.length-2]??last;
    const col = last>=prev? 'var(--accent)':'var(--live)';
    return React.createElement('svg',{width:w,height:h,style:{overflow:'visible'}},
      React.createElement('path',{d,fill:'none',stroke:col,strokeWidth:1.6,strokeLinecap:'round',strokeLinejoin:'round'}),
      React.createElement('circle',{cx:pts[pts.length-1][0],cy:pts[pts.length-1][1],r:2.2,fill:col}));
  }
  window.Spark = Spark;

})();
