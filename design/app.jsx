/* ============================================================
   GAFFER — app shell, routing, state, mount
   ============================================================ */
(function(){
  const { useState, useEffect } = React;
  const Icon=window.Icon, SQUAD=window.SQUAD, useToast=window.useToast;

  const NAV = [
    { id:'team', label:'My Team', icon:'team' },
    { id:'market', label:'Players', icon:'players' },
    { id:'predict', label:'Predictions', icon:'predictions' },
    { id:'leagues', label:'Leagues', icon:'leagues' },
    { id:'fixtures', label:'Fixtures', icon:'fixtures' },
  ];
  // routes that belong to the "team" tab group
  const TEAM_ROUTES = new Set(['team','squad','transfers']);
  const tabFor = r => TEAM_ROUTES.has(r) ? 'team' : r;

  const LS = 'gaffer_state_v1';
  function load(){ try { return JSON.parse(localStorage.getItem(LS))||{}; } catch(e){ return {}; } }

  function App(){
    const D = window.GAFFER_DATA;
    const init = load();
    const [authed,setAuthed]=useState(!!init.authed);
    const [route,setRoute]=useState(init.route||'team');
    const [squad,setSquad]=useState(SQUAD.fromDefault());
    const [formation,setFormation]=useState('4-4-2');
    const [captain,setCaptain]=useState(D.DEFAULT_SQUAD.captain);
    const [vice,setVice]=useState(D.DEFAULT_SQUAD.vice);
    const [hasTeam,setHasTeam]=useState(init.hasTeam!==false);
    const [balance,setBalance]=useState(init.balance ?? D.PROFILE.predBalance);
    const [openBets,setOpenBets]=useState(init.openBets||[]);
    const [leagues,setLeagues]=useState(D.LEAGUES);
    const [toastNode, toast]=useToast();

    useEffect(()=>{ localStorage.setItem(LS, JSON.stringify({authed,route,hasTeam,balance,openBets})); },
      [authed,route,hasTeam,balance,openBets]);

    const go = r => { setRoute(r); window.scrollTo(0,0); };

    if(!authed) return React.createElement(window.AuthScreen,{onEnter:()=>{ setAuthed(true); go('team'); }});

    let screen;
    if(route==='team') screen = React.createElement(window.DashScreen,{squad,captain,vice,hasTeam,go});
    else if(route==='squad') screen = React.createElement(window.SquadScreen,{squad,setSquad,formation,setFormation,
      onSave:(c,v)=>{ setCaptain(c); setVice(v); setHasTeam(true); go('team'); }, toast});
    else if(route==='transfers') screen = React.createElement(window.TransfersScreen,{squad,setSquad,captain,vice,go,toast});
    else if(route==='market') screen = React.createElement(window.MarketScreen);
    else if(route==='predict') screen = React.createElement(window.PredictScreen,{balance,setBalance,openBets,setOpenBets,toast});
    else if(route==='leagues') screen = React.createElement(window.LeaguesScreen,{leagues,setLeagues,toast});
    else if(route==='fixtures') screen = React.createElement(window.FixturesScreen);

    const activeTab = tabFor(route);

    return React.createElement('div',{className:'app'},
      // ---- desktop sidebar ----
      React.createElement('aside',{className:'sidebar'},
        React.createElement('div',{className:'brand'},
          React.createElement('div',{className:'brand-mark'},'G'),
          React.createElement('div',{className:'brand-name'},'GAFFER')),
        React.createElement('nav',{className:'nav'},
          NAV.map(n=>React.createElement('button',{key:n.id,className:'nav-item'+(activeTab===n.id?' on':''),onClick:()=>go(n.id)},
            React.createElement('span',{className:'nav-ico'},React.createElement(Icon,{name:n.icon,size:20})),
            React.createElement('span',null,n.label),
            n.id==='predict'&&openBets.length>0&&React.createElement('span',{className:'pill pill-gold nav-badge'},openBets.length)))),
        React.createElement('div',{className:'side-foot'},
          React.createElement('button',{className:'nav-item',onClick:()=>go('squad')},
            React.createElement('span',{className:'nav-ico'},React.createElement(Icon,{name:'plus',size:20})),'Pick / Edit Team'),
          React.createElement('button',{className:'nav-item',onClick:()=>go('transfers')},
            React.createElement('span',{className:'nav-ico'},React.createElement(Icon,{name:'swap',size:20})),'Transfers'),
          React.createElement('div',{className:'side-user',style:{marginTop:10},onClick:()=>{ setAuthed(false); }},
            React.createElement('div',{className:'avatar'},'G'),
            React.createElement('div',{style:{flex:1}},
              React.createElement('div',{className:'su-name'},'Gaffer FC'),
              React.createElement('div',{className:'su-sub'},'@thegaffer · log out')),
            React.createElement(Icon,{name:'chevright',size:16,style:{color:'var(--text-3)'}})))),

      // ---- mobile top bar ----
      React.createElement('header',{className:'topbar'},
        React.createElement('div',{className:'brand',style:{padding:0}},
          React.createElement('div',{className:'brand-mark',style:{width:30,height:30,fontSize:17}},'G'),
          React.createElement('div',{className:'brand-name',style:{fontSize:19}},'GAFFER')),
        React.createElement('div',{className:'row',style:{gap:6}},
          React.createElement('span',{className:'pill pill-gold'},
            React.createElement(Icon,{name:'coins',size:13}), balance),
          React.createElement('div',{className:'avatar',style:{width:32,height:32,fontSize:14},onClick:()=>setAuthed(false)},'G'))),

      // ---- content ----
      React.createElement('main',{className:'app-main'}, screen),

      // ---- mobile tab bar ----
      React.createElement('nav',{className:'tabbar'},
        NAV.map(n=>React.createElement('button',{key:n.id,className:'tab'+(activeTab===n.id?' on':''),onClick:()=>go(n.id)},
          React.createElement('span',{className:'tab-ico'},React.createElement(Icon,{name:n.icon,size:23})),
          React.createElement('span',null,n.label)))),

      toastNode
    );
  }

  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
})();
