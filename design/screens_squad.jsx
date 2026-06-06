/* ============================================================
   GAFFER — Squad Selection (centerpiece) + Player Picker
   ============================================================ */
(function(){
  const { useState, useMemo } = React;
  const Icon=window.Icon, Flag=window.Flag, Pitch=window.Pitch, BudgetBar=window.BudgetBar,
        Modal=window.Modal, Segmented=window.Segmented, PlayerRow=window.PlayerRow,
        FilterBar=window.FilterBar, usePlayerFilter=window.usePlayerFilter, SQUAD=window.SQUAD, Jersey=window.Jersey;

  // ---------- Player Picker ----------
  function PlayerPicker({slot, squad, budget, onSelect, onClose}){
    const D = window.GAFFER_DATA;
    const lockPos = slot.pos;
    const { list, props } = usePlayerFilter(lockPos);
    const inSquad = useMemo(()=> new Set(SQUAD.flatten(squad)), [squad]);
    const cc = useMemo(()=> SQUAD.countryCounts(squad), [squad]);
    // players to show: only the slot position
    const filtered = list.filter(p=>p.pos===lockPos);
    const remaining = budget - SQUAD.spent(squad);
    return React.createElement(Modal,{open:true,onClose,side:true,title:'Pick '+({GK:'Goalkeeper',DEF:'Defender',MID:'Midfielder',FWD:'Forward'}[lockPos])},
      React.createElement('div',{className:'picker'},
        React.createElement('div',{className:'picker-bar'},
          React.createElement('span',{className:'pill pill-blue'}, '£'+remaining.toFixed(1)+'m to spend'),
          React.createElement('span',{className:'muted',style:{fontSize:13}}, filtered.length+' available')),
        React.createElement('div',{className:'picker-filters'},
          React.createElement(FilterBar,Object.assign({}, props, {pos:lockPos, setPos:()=>{}, setMaxPrice:props.setMaxPrice}))),
        React.createElement('div',{className:'picker-list'},
          filtered.length===0
            ? React.createElement('div',{className:'picker-empty'},'No players match your filters.')
            : filtered.map(p=>{
                const picked = inSquad.has(p.id);
                const countryFull = !picked && (cc[p.country]||0) >= 3;
                return React.createElement(PlayerRow,{key:p.id, p, variant:'pick', picked,
                  disabled: picked || countryFull,
                  reason: countryFull? 'Max 3 from '+window.COUNTRY_NAME(p.country):'Already in squad',
                  onPick: ()=>onSelect(p)});
              })
        )
      )
    );
  }

  // ---------- Player action sheet ----------
  function PlayerActions({player, isCaptain, isVice, onCap, onVice, onRemove, onClose}){
    if(!player) return null;
    const D=window.GAFFER_DATA;
    const Item=({icon,label,onClick,tone})=>React.createElement('button',{className:'act-item'+(tone?' tone-'+tone:''),onClick},
      React.createElement(Icon,{name:icon,size:19}), React.createElement('span',null,label));
    return React.createElement(Modal,{open:true,onClose,title:null},
      React.createElement('div',{className:'act-head'},
        React.createElement('div',{className:'act-jersey'}, React.createElement(Jersey,{code:player.country,size:54})),
        React.createElement('div',null,
          React.createElement('div',{className:'act-name'}, player.name),
          React.createElement('div',{className:'act-meta'},
            React.createElement('span',{className:'pos pos-'+player.pos},player.pos),
            React.createElement(Flag,{code:player.country,size:13,round:true}),
            React.createElement('span',{className:'muted'}, window.COUNTRY_NAME(player.country)),
            React.createElement('span',{className:'muted dim'}, '£'+player.price.toFixed(1)+'m'))),
        ),
      React.createElement('div',{className:'act-list'},
        React.createElement(Item,{icon:'star',label: isCaptain?'Captain (×2) — selected':'Make Captain (×2)',onClick:()=>{onCap();onClose();}}),
        React.createElement(Item,{icon:'user',label: isVice?'Vice-captain — selected':'Make Vice-captain',onClick:()=>{onVice();onClose();}}),
        React.createElement(Item,{icon:'swap',label:'Remove from squad',onClick:()=>{onRemove();onClose();},tone:'live'})),
      React.createElement('div',{style:{padding:'0 18px 18px'}},
        React.createElement('button',{className:'btn btn-ghost btn-block',onClick:onClose},'Close'))
    );
  }

  // ---------- Bench ----------
  function Bench({squad, onSlot}){
    const D=window.GAFFER_DATA;
    return React.createElement('div',{className:'bench'},
      React.createElement('div',{className:'bench-label'},'Substitutes'),
      React.createElement('div',{className:'bench-row'},
        squad.bench.map((b,i)=>{
          const p = b.id? D.PLAYER_BY_ID[b.id]:null;
          return React.createElement('button',{key:i,className:'bench-slot'+(p?'':' empty'),onClick:()=>onSlot('bench',i,p)},
            React.createElement('span',{className:'bench-pos pos pos-'+b.pos}, b.pos),
            p? React.createElement(React.Fragment,null,
                React.createElement(Jersey,{code:p.country,size:34}),
                React.createElement('span',{className:'bench-name'}, p.name.split(' ').slice(-1)[0]),
                React.createElement('span',{className:'bench-price num'}, '£'+p.price.toFixed(1)))
              : React.createElement('span',{className:'bench-plus'}, React.createElement(Icon,{name:'plus',size:18})));
        }))
    );
  }

  // ---------- Squad Selection Screen ----------
  function SquadScreen({squad, setSquad, formation, setFormation, onSave, toast}){
    const D=window.GAFFER_DATA;
    const [picker,setPicker]=useState(null);   // {pos,index}
    const [actions,setActions]=useState(null);  // player slot
    const [captain,setCaptain]=useState(D.DEFAULT_SQUAD.captain);
    const [vice,setVice]=useState(D.DEFAULT_SQUAD.vice);

    const v = SQUAD.validate(squad, D.BUDGET);

    function handleSlot(pos,i,player){
      if(pos==='bench'){
        if(player) setActions({player, pos, i, bench:true});
        else setPicker({pos: squad.bench[i].pos, i, bench:true});
        return;
      }
      if(player) setActions({player, pos, i});
      else setPicker({pos, i});
    }
    function selectPlayer(p){
      const next = JSON.parse(JSON.stringify(squad));
      if(picker.bench) next.bench[picker.i] = {pos:picker.pos, id:p.id};
      else next[picker.pos][picker.i] = p.id;
      setSquad(next); setPicker(null);
    }
    function removePlayer(){
      const a=actions; const next=JSON.parse(JSON.stringify(squad));
      if(a.bench) next.bench[a.i].id=null; else next[a.pos][a.i]=null;
      if(captain===a.player.id) setCaptain(null);
      if(vice===a.player.id) setVice(null);
      setSquad(next);
    }
    function changeFormation(f){ setFormation(f); setSquad(SQUAD.reshape(squad,f)); }

    return React.createElement('div',{className:'screen'},
      React.createElement('div',{className:'screen-head head-row'},
        React.createElement('div',null,
          React.createElement('h1',null,'Pick Your Team'),
          React.createElement('div',{className:'sub'},'Build a 15-player squad within £100m. Max 3 players per country.')),
        React.createElement('button',{className:'btn btn-primary', disabled:!v.valid, onClick:()=>{onSave&&onSave(captain,vice); toast&&toast('Team saved','accent');}},
          React.createElement(Icon,{name:'check',size:17}), 'Save Team')),

      React.createElement(BudgetBar,{budget:D.BUDGET, spent:v.spent, count:v.total, max:15}),

      v.errors.length>0 && React.createElement('div',{className:'valid-msgs',style:{marginTop:12}},
        v.errors.map((e,i)=>React.createElement('div',{key:i,className:'vmsg err'},
          React.createElement('span',{className:'ic'},React.createElement(Icon,{name:'info',size:16})), e.msg))),
      v.valid && React.createElement('div',{className:'valid-msgs',style:{marginTop:12}},
        React.createElement('div',{className:'vmsg ok'},
          React.createElement('span',{className:'ic'},React.createElement(Icon,{name:'check',size:16})),
          'Squad valid — captain set, formation '+formation+'. Ready to save.')),

      React.createElement('div',{className:'two-col',style:{marginTop:16}},
        React.createElement('div',null,
          React.createElement('div',{className:'pitch-toolbar'},
            React.createElement('span',{className:'pt-label'},'Formation'),
            React.createElement(Segmented,{size:'sm', value:formation, onChange:changeFormation,
              options:Object.keys(SQUAD.FORMATIONS)})),
          React.createElement('div',{className:'pitch-wrap'},
            React.createElement(Pitch,{squad, captain, vice, mode:'edit', onSlot:handleSlot}),
            React.createElement(Bench,{squad, onSlot:handleSlot}))),
        React.createElement('div',{className:'pick-aside'},
          React.createElement(SquadSummary,{squad, captain, formation}))
      ),

      picker && React.createElement(PlayerPicker,{slot:picker, squad, budget:D.BUDGET,
        onSelect:selectPlayer, onClose:()=>setPicker(null)}),
      actions && React.createElement(PlayerActions,{player:actions.player,
        isCaptain:captain===actions.player.id, isVice:vice===actions.player.id,
        onCap:()=>setCaptain(actions.player.id), onVice:()=>setVice(actions.player.id),
        onRemove:removePlayer, onClose:()=>setActions(null)})
    );
  }

  function SquadSummary({squad, captain, formation}){
    const D=window.GAFFER_DATA;
    const cc = SQUAD.countryCounts(squad);
    const cap = captain? D.PLAYER_BY_ID[captain]:null;
    const proj = SQUAD.projectedPoints(squad);
    const entries = Object.entries(cc).sort((a,b)=>b[1]-a[1]);
    return React.createElement('div',{className:'card',style:{padding:16}},
      React.createElement('div',{className:'sum-row'},
        React.createElement('span',{className:'muted'},'Captain'),
        cap? React.createElement('span',{className:'sum-cap'},
          React.createElement(Flag,{code:cap.country,size:14,round:true}), React.createElement('b',null,cap.name),
          React.createElement('span',{className:'pill pill-gold'},'×2'))
          : React.createElement('span',{className:'dim'},'Not set')),
      React.createElement('div',{className:'sum-row'},
        React.createElement('span',{className:'muted'},'Projected points'),
        React.createElement('b',{className:'num'},proj)),
      React.createElement('div',{className:'sum-divider'}),
      React.createElement('div',{className:'sum-title'},'Country quota'),
      React.createElement('div',{className:'quota'},
        entries.length? entries.map(([c,n])=>
          React.createElement('div',{key:c,className:'quota-item'+(n>=3?' full':'')},
            React.createElement(Flag,{code:c,size:15,round:true}),
            React.createElement('span',{className:'qc'}, c),
            React.createElement('span',{className:'qn num'+(n>3?' over':'')}, n+'/3')))
          : React.createElement('span',{className:'dim',style:{fontSize:13}},'No players yet')),
      React.createElement('p',{className:'sum-hint'},'Tap a player to set captain, vice or remove. Tap an empty slot to add.')
    );
  }

  window.SquadScreen = SquadScreen;
  window.PlayerPicker = PlayerPicker;
})();
