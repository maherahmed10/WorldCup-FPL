/* ============================================================
   GAFFER — Fixtures / Results + Transfers
   ============================================================ */
(function(){
  const { useState } = React;
  const Icon=window.Icon, Flag=window.Flag, Segmented=window.Segmented, BudgetBar=window.BudgetBar,
        SQUAD=window.SQUAD, Countdown=window.Countdown;

  // ---------------- FIXTURES ----------------
  function FixturesScreen(){
    const D=window.GAFFER_DATA;
    const rounds = Object.keys(D.FIXTURES);
    const [round,setRound]=useState('Round of 16');
    const list = D.FIXTURES[round]||[];
    const isGroup = round.startsWith('Group');

    return React.createElement('div',{className:'screen'},
      React.createElement('div',{className:'screen-head'},
        React.createElement('h1',null,'Fixtures'),
        React.createElement('div',{className:'sub'},'World Cup 2026 · USA · Canada · Mexico')),

      React.createElement('div',{className:'round-scroll'},
        D.ROUNDS.map(r=>{
          const has = !!D.FIXTURES[r];
          return React.createElement('button',{key:r,className:'round-chip'+(r===round?' on':'')+(has?'':' soon'),
            onClick:()=>has&&setRound(r), disabled:!has},
            r.replace('Group Stage','GS '), !has&&React.createElement('span',{className:'soon-dot'}));
        })),

      React.createElement('div',{className:'fixtures'},
        list.map((m,i)=>React.createElement(FixtureRow,{key:i,m}))),

      isGroup && React.createElement(React.Fragment,null,
        React.createElement('div',{className:'section-title'},'Group Standings'),
        React.createElement('div',{className:'groups'},
          Object.entries(D.GROUPS).map(([g,rows])=>React.createElement(GroupTable,{key:g,g,rows})))),

      round==='Round of 16' && React.createElement(React.Fragment,null,
        React.createElement('div',{className:'section-title'},'Group Standings · Final'),
        React.createElement('div',{className:'groups'},
          Object.entries(D.GROUPS).map(([g,rows])=>React.createElement(GroupTable,{key:g,g,rows,qualified:2}))))
    );
  }

  function FixtureRow({m}){
    const live = m.status==='live', fin = m.status==='finished';
    return React.createElement('div',{className:'fix'+(live?' live':'')},
      React.createElement('div',{className:'fix-time'},
        live? React.createElement('span',{className:'fix-livetag'}, React.createElement('span',{className:'live-dot'}),'LIVE')
        : fin? React.createElement('span',{className:'fix-ft'},'FT')
        : React.createElement('span',{className:'fix-up'}, m.day,React.createElement('br'),m.time)),
      React.createElement('div',{className:'fix-teams'},
        React.createElement('div',{className:'fix-team right'},
          React.createElement('span',{className:'fix-name'}, window.COUNTRY_NAME(m.home)),
          React.createElement(Flag,{code:m.home,size:22,round:true})),
        React.createElement('div',{className:'fix-score'},
          (live||fin)? React.createElement('span',{className:'num'}, m.hs+' : '+m.as_)
          : React.createElement('span',{className:'fix-v'},'v')),
        React.createElement('div',{className:'fix-team'},
          React.createElement(Flag,{code:m.away,size:22,round:true}),
          React.createElement('span',{className:'fix-name'}, window.COUNTRY_NAME(m.away)))),
      React.createElement('div',{className:'fix-venue muted'}, m.venue)
    );
  }

  function GroupTable({g,rows,qualified}){
    return React.createElement('div',{className:'group-card'},
      React.createElement('div',{className:'group-head'},'Group '+g),
      React.createElement('div',{className:'gt-row gt-head'},
        React.createElement('span',{className:'gt-pos'},'#'),
        React.createElement('span',{className:'gt-team'},'Team'),
        React.createElement('span',null,'P'),React.createElement('span',null,'W'),
        React.createElement('span',null,'D'),React.createElement('span',null,'L'),
        React.createElement('span',null,'GD'),React.createElement('span',{className:'gt-pts'},'Pts')),
      rows.map((r,i)=>React.createElement('div',{key:i,className:'gt-row'+(qualified&&i<qualified?' qual':'')},
        React.createElement('span',{className:'gt-pos num'}, i+1),
        React.createElement('span',{className:'gt-team'}, React.createElement(Flag,{code:r.c,size:16,round:true}),
          React.createElement('span',null, window.COUNTRY_NAME(r.c))),
        React.createElement('span',{className:'num'},r.pld),React.createElement('span',{className:'num'},r.w),
        React.createElement('span',{className:'num'},r.d),React.createElement('span',{className:'num'},r.l),
        React.createElement('span',{className:'num'}, (r.gf-r.ga>=0?'+':'')+(r.gf-r.ga)),
        React.createElement('span',{className:'gt-pts num'}, r.pts)))
    );
  }
  window.FixturesScreen = FixturesScreen;

  // ---------------- TRANSFERS ----------------
  function TransfersScreen({squad, setSquad, captain, vice, go, toast}){
    const D=window.GAFFER_DATA;
    const [windowOpen,setWindowOpen]=useState(true);
    const [picker,setPicker]=useState(null);
    const v = SQUAD.validate(squad, D.BUDGET);
    const PlayerPicker = window.PlayerPicker;

    function swap(pos,i,bench){ if(!windowOpen) return; setPicker({pos: bench? squad.bench[i].pos: pos, i, bench}); }
    function doSwap(p){
      const next=JSON.parse(JSON.stringify(squad));
      if(picker.bench) next.bench[picker.i].id=p.id; else next[picker.pos][picker.i]=p.id;
      setSquad(next); setPicker(null); toast&&toast('Transfer made','accent');
    }
    const Row=({id,pos,bench,i})=>{ const p=D.PLAYER_BY_ID[id]; if(!p) return null;
      return React.createElement('div',{className:'tr-row'},
        React.createElement(Flag,{code:p.country,size:20,round:true}),
        React.createElement('span',{className:'pos pos-'+p.pos}, p.pos),
        React.createElement('span',{className:'tr-name'}, p.name),
        React.createElement('span',{className:'tr-price num'},'£'+p.price.toFixed(1)),
        React.createElement('button',{className:'btn btn-ghost btn-sm',disabled:!windowOpen,onClick:()=>swap(pos,i,bench)},
          React.createElement(Icon,{name:'swap',size:14}), windowOpen?'Swap':'Locked'));
    };

    return React.createElement('div',{className:'screen'},
      React.createElement('div',{className:'screen-head head-row'},
        React.createElement('div',null,
          React.createElement('h1',null,'Transfers'),
          React.createElement('div',{className:'sub'},'Swap players between knockout rounds. 2 free transfers this window.')),
        React.createElement('div',{className:'row',style:{gap:8}},
          React.createElement('span',{className:'muted',style:{fontSize:12}},'Demo state:'),
          React.createElement(Segmented,{size:'sm',value:windowOpen?'open':'locked',onChange:x=>setWindowOpen(x==='open'),
            options:[{value:'open',label:'Open'},{value:'locked',label:'Locked'}]}))),

      windowOpen
        ? React.createElement('div',{className:'banner open'},
            React.createElement('div',{className:'banner-l'},
              React.createElement('div',{className:'banner-ico'},React.createElement(Icon,{name:'unlock',size:20,style:{color:'var(--accent)'}})),
              React.createElement('div',null,
                React.createElement('h4',null,'Transfer window open'),
                React.createElement('p',null,'Make changes before the Round of 16 deadline.'))),
            React.createElement(Countdown,{to:D.PROFILE.deadline}))
        : React.createElement('div',{className:'banner'},
            React.createElement('div',{className:'banner-l'},
              React.createElement('div',{className:'banner-ico'},React.createElement(Icon,{name:'lock',size:20,style:{color:'var(--text-3)'}})),
              React.createElement('div',null,
                React.createElement('h4',null,'Transfers locked'),
                React.createElement('p',null,'Squads are frozen mid-round. The next window opens after the Round of 16.')))),

      React.createElement('div',{style:{marginTop:14}}, React.createElement(BudgetBar,{budget:D.BUDGET,spent:v.spent,count:v.total,max:15})),

      React.createElement('div',{className:'card',style:{padding:14,marginTop:14}},
        React.createElement('div',{className:'sum-title',style:{marginBottom:8}},'Starting XI'),
        ['GK','DEF','MID','FWD'].map(pos=>(squad[pos]||[]).map((id,i)=>
          React.createElement(Row,{key:pos+i,id,pos,i}))),
        React.createElement('div',{className:'sum-divider'}),
        React.createElement('div',{className:'sum-title',style:{margin:'4px 0 8px'}},'Substitutes'),
        squad.bench.map((b,i)=>React.createElement(Row,{key:'b'+i,id:b.id,pos:b.pos,bench:true,i}))),

      picker && PlayerPicker && React.createElement(PlayerPicker,{slot:picker,squad,budget:D.BUDGET,
        onSelect:doSwap,onClose:()=>setPicker(null)})
    );
  }
  window.TransfersScreen = TransfersScreen;
})();
