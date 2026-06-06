/* ============================================================
   GAFFER — Leagues / Leaderboard
   ============================================================ */
(function(){
  const { useState } = React;
  const Icon=window.Icon, Modal=window.Modal, Segmented=window.Segmented;

  function LeaguesScreen({leagues, setLeagues, toast}){
    const [active,setActive]=useState(leagues[0]?.id);
    const [view,setView]=useState('total');
    const [modal,setModal]=useState(null); // 'create' | 'join'
    const league = leagues.find(l=>l.id===active) || leagues[0];

    return React.createElement('div',{className:'screen'},
      React.createElement('div',{className:'screen-head head-row'},
        React.createElement('div',null,
          React.createElement('h1',null,'Leagues'),
          React.createElement('div',{className:'sub'},'Compete with friends and the world.')),
        React.createElement('div',{className:'row',style:{gap:8}},
          React.createElement('button',{className:'btn btn-ghost btn-sm',onClick:()=>setModal('join')},
            React.createElement(Icon,{name:'plus',size:15}),'Join'),
          React.createElement('button',{className:'btn btn-primary btn-sm',onClick:()=>setModal('create')},
            React.createElement(Icon,{name:'trophy',size:15}),'Create League'))),

      React.createElement('div',{className:'league-tabs'},
        leagues.map(l=>React.createElement('button',{key:l.id,className:'ltab'+(l.id===active?' on':''),onClick:()=>setActive(l.id)},
          React.createElement('span',{className:'ltab-name'}, l.name),
          React.createElement('span',{className:'ltab-sub'}, l.type==='global'? (l.members.toLocaleString()+' managers'): (l.members+' members'))))),

      React.createElement('div',{className:'league-bar'},
        React.createElement('div',{className:'row',style:{gap:10}},
          league.code && React.createElement('span',{className:'pill'},'Code: ',React.createElement('b',{style:{color:'var(--text)',marginLeft:4}},league.code)),
          league.code && React.createElement('button',{className:'btn btn-ghost btn-sm',onClick:()=>toast&&toast('Invite code copied','accent')},
            React.createElement(Icon,{name:'plus',size:14}),'Copy invite')),
        React.createElement(Segmented,{size:'sm',value:view,onChange:setView,
          options:[{value:'total',label:'Overall'},{value:'gw',label:'This round'}]})),

      React.createElement('div',{className:'standings'},
        React.createElement('div',{className:'st-row st-head'},
          React.createElement('span',{className:'st-rank'},'#'),
          React.createElement('span',{className:'st-team'},'Manager'),
          React.createElement('span',{className:'st-gw'}, view==='gw'?'Round':'GW'),
          React.createElement('span',{className:'st-total'}, view==='gw'?'Round pts':'Total')),
        league.standings.slice().sort((a,b)=> view==='gw'? b.gw-a.gw : b.total-a.total)
          .map((s,i)=>React.createElement('div',{key:i,className:'st-row'+(s.you?' you':'')},
            React.createElement('span',{className:'st-rank'},
              React.createElement('span',{className:'rk num'}, i+1),
              s.delta!=null && s.delta!==0 && React.createElement('span',{className:'rk-delta '+(s.delta>0?'up':'down')},
                React.createElement(Icon,{name:s.delta>0?'arrowup':'arrowdown',size:11}), Math.abs(s.delta))),
            React.createElement('span',{className:'st-team'},
              React.createElement('span',{className:'st-avatar'}, s.name[0]),
              React.createElement('span',null,
                React.createElement('div',{className:'st-mgr'}, s.name, s.you&&React.createElement('span',{className:'pill pill-accent',style:{marginLeft:6}},'You')),
                React.createElement('div',{className:'st-fc muted'}, s.team))),
            React.createElement('span',{className:'st-gw num'}, '+'+s.gw),
            React.createElement('span',{className:'st-total num'}, view==='gw'? ('+'+s.gw) : s.total)))),

      modal && React.createElement(LeagueModal,{mode:modal, onClose:()=>setModal(null),
        onDone:(name)=>{ if(modal==='create'){ const code='GAF-'+Math.random().toString(36).slice(2,6).toUpperCase();
            setLeagues([...leagues,{id:'l'+Date.now(),name,code,members:1,type:'private',
              standings:[{rank:1,name:'You',team:'Gaffer FC',gw:78,total:806,delta:0,you:true}]}]);
            toast&&toast('League created · '+code,'accent'); }
          else toast&&toast('Joined league','accent');
          setModal(null); }})
    );
  }

  function LeagueModal({mode, onClose, onDone}){
    const [val,setVal]=useState('');
    const create = mode==='create';
    return React.createElement(Modal,{open:true,onClose,title: create?'Create a League':'Join a League'},
      React.createElement('div',{style:{padding:'18px'}},
        React.createElement('p',{style:{color:'var(--text-2)',fontSize:14,marginBottom:16,marginTop:0}},
          create? 'Name your league. We\u2019ll generate a join code you can share with friends.'
                : 'Enter the invite code your friend shared to join their mini-league.'),
        React.createElement('label',{className:'fld-label'}, create?'League name':'Invite code'),
        React.createElement('input',{className:'fld', value:val, onChange:e=>setVal(e.target.value),
          placeholder: create?'e.g. Sunday League Legends':'GAF-XXXX', autoFocus:true}),
        React.createElement('button',{className:'btn btn-primary btn-block',style:{marginTop:18},
          disabled:!val.trim(), onClick:()=>onDone(val.trim())}, create?'Create League':'Join League'))
    );
  }
  window.LeaguesScreen = LeaguesScreen;
})();
