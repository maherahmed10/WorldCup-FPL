/* ============================================================
   GAFFER — My Team / Dashboard
   ============================================================ */
(function(){
  const Icon=window.Icon, Flag=window.Flag, Pitch=window.Pitch, StatCard=window.StatCard,
        Countdown=window.Countdown, SQUAD=window.SQUAD, Jersey=window.Jersey;

  function DashScreen({squad, captain, vice, hasTeam, go}){
    const D=window.GAFFER_DATA, P=D.PROFILE;
    if(!hasTeam){
      return React.createElement('div',{className:'screen'},
        React.createElement('div',{className:'screen-head'}, React.createElement('h1',null,'My Team')),
        React.createElement('div',{className:'empty'},
          React.createElement('div',{className:'empty-ico'}, React.createElement(Icon,{name:'team',size:28})),
          React.createElement('h3',null,'No squad yet'),
          React.createElement('p',null,'Pick your 15-player World Cup squad to start earning points this round.'),
          React.createElement('button',{className:'btn btn-primary',onClick:()=>go('squad')},
            React.createElement(Icon,{name:'plus',size:17}),'Pick Your Team')));
    }
    const gw = D.DEFAULT_SQUAD.gwPoints;
    // mark a couple eliminated players for demo (Japan eliminated after group)
    const elimCountries = new Set(['JPN','SEN']);
    const liveSquad = JSON.parse(JSON.stringify(squad));
    ['GK','DEF','MID','FWD'].forEach(pos=> liveSquad[pos]=liveSquad[pos].map(id=>id));
    // compute gw points (captain doubled handled in token)
    let gwTotal=0; SQUAD.flatten(squad).forEach(id=>{ const base=gw[id]||0; gwTotal += id===captain? base*2: base; });

    return React.createElement('div',{className:'screen'},
      React.createElement('div',{className:'screen-head head-row'},
        React.createElement('div',null,
          React.createElement('h1',null,'Gaffer FC'),
          React.createElement('div',{className:'sub'}, P.gameweek+' · Managed by '+P.handle)),
        React.createElement('button',{className:'btn btn-ghost',onClick:()=>go('squad')},
          React.createElement(Icon,{name:'settings',size:16}),'Edit Squad')),

      React.createElement('div',{className:'grid-stats'},
        React.createElement(StatCard,{label:'Total Points', value:P.totalPoints, sub:'Season', tone:'', icon:'bolt'}),
        React.createElement(StatCard,{label:'This Round', value:'+'+gwTotal, sub:'Live · '+P.gameweek, tone:'accent', icon:'arrowup'}),
        React.createElement(StatCard,{label:'League Rank', value:'#3', sub:'Office Pundits ▲2', tone:'gold', icon:'trophy'}),
        React.createElement(StatCard,{label:'Squad Value', value:'£'+P.budgetValue.toFixed(1)+'m', sub:'+£0.6m', tone:'blue', icon:'coins'})),

      React.createElement('div',{className:'banner warn',style:{marginTop:14}},
        React.createElement('div',{className:'banner-l'},
          React.createElement('div',{className:'banner-ico'}, React.createElement(Icon,{name:'clock',size:20,style:{color:'var(--gold)'}})),
          React.createElement('div',null,
            React.createElement('h4',null,'Round of 16 deadline'),
            React.createElement('p',null,'Make your captain and transfer choices before kickoff.'))),
        React.createElement(Countdown,{to:P.deadline})),

      React.createElement('div',{className:'two-col',style:{marginTop:16}},
        React.createElement('div',null,
          React.createElement('div',{className:'pitch-wrap'},
            React.createElement(Pitch,{squad:liveSquad, captain, vice, mode:'view', gwPoints:gw,
              onSlot:(pos,i,p)=>{}}),
            React.createElement(DashBench,{squad, gw}))),
        React.createElement('div',null,
          React.createElement(TopScorers,{squad, gw, captain}),
          React.createElement(EliminatedNote,{squad, elimCountries})))
    );
  }

  function DashBench({squad, gw}){
    const D=window.GAFFER_DATA;
    return React.createElement('div',{className:'bench'},
      React.createElement('div',{className:'bench-label'},'Bench'),
      React.createElement('div',{className:'bench-row'},
        squad.bench.map((b,i)=>{ const p=b.id?D.PLAYER_BY_ID[b.id]:null;
          return React.createElement('div',{key:i,className:'bench-slot'},
            React.createElement('span',{className:'bench-pos pos pos-'+b.pos}, b.pos),
            p&&React.createElement(React.Fragment,null,
              React.createElement(Jersey,{code:p.country,size:32}),
              React.createElement('span',{className:'bench-name'}, p.name.split(' ').slice(-1)[0]),
              React.createElement('span',{className:'bench-pts num'}, gw[p.id]??0)));
        }))
    );
  }

  function TopScorers({squad, gw, captain}){
    const D=window.GAFFER_DATA;
    const rows = SQUAD.flatten(squad).map(id=>({p:D.PLAYER_BY_ID[id], pts:(gw[id]||0)*(id===captain?2:1), cap:id===captain}))
      .sort((a,b)=>b.pts-a.pts).slice(0,5);
    return React.createElement('div',{className:'card',style:{padding:16,marginBottom:14}},
      React.createElement('div',{className:'sum-title',style:{marginBottom:10}},'Top performers · this round'),
      rows.map((r,i)=>React.createElement('div',{key:i,className:'score-row'},
        React.createElement(Flag,{code:r.p.country,size:18,round:true}),
        React.createElement('span',{className:'sr-name'}, r.p.name, r.cap&&React.createElement('span',{className:'pill pill-gold',style:{marginLeft:6}},'C')),
        React.createElement('span',{className:'pos pos-'+r.p.pos}, r.p.pos),
        React.createElement('span',{className:'sr-pts num'}, '+'+r.pts))));
  }

  function EliminatedNote({squad, elimCountries}){
    const D=window.GAFFER_DATA;
    const elim = SQUAD.flatten(squad).map(id=>D.PLAYER_BY_ID[id]).filter(p=>elimCountries.has(p.country));
    if(!elim.length) return null;
    return React.createElement('div',{className:'card',style:{padding:16}},
      React.createElement('div',{className:'sum-title',style:{marginBottom:10,color:'var(--live)'}},'Eliminated players'),
      React.createElement('p',{style:{fontSize:13,color:'var(--text-2)',marginBottom:10}},'These players\u2019 nations are out. They score 0 until you transfer them in the next window.'),
      elim.map((p,i)=>React.createElement('div',{key:i,className:'score-row elim'},
        React.createElement(Flag,{code:p.country,size:18,round:true}),
        React.createElement('span',{className:'sr-name'}, p.name),
        React.createElement('span',{className:'pill pill-live'},'Eliminated'))));
  }

  window.DashScreen = DashScreen;
})();
