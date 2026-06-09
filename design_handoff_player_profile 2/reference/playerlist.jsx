/* ============================================================
   GAFFER — PlayerRow + filter bar (picker & market)
   ============================================================ */
(function(){
  const { useState, useMemo } = React;
  const Icon = window.Icon, Flag = window.Flag, Spark = window.Spark;

  function PlayerRow({p, variant='pick', onPick, onProfile, picked, disabled, reason}){
    return React.createElement('div',{
        className:'prow'+(picked?' picked':'')+(disabled?' dis-add':'')},
      // ---- identity zone: tap to view full profile ----
      React.createElement('button',{className:'prow-id-btn', onClick:()=> onProfile && onProfile(p),
          title:'View '+p.name+'\u2019s profile'},
        React.createElement('div',{className:'prow-flag'}, React.createElement(Flag,{code:p.country,size:22,round:true})),
        React.createElement('div',{className:'prow-id'},
          React.createElement('div',{className:'prow-name'}, p.name,
            p.status==='doubt' && React.createElement('span',{className:'dot-doubt',title:'Fitness doubt'}),
            p.status==='out' && React.createElement('span',{className:'dot-out',title:'Injured / out'})),
          React.createElement('div',{className:'prow-meta'},
            React.createElement('span',{className:'pos pos-'+p.pos}, p.pos),
            React.createElement('span',{className:'muted'}, window.COUNTRY_NAME(p.country)),
            variant==='market' && React.createElement('span',{className:'muted dim'}, p.selBy+'% picked'))),
        variant==='market'
          ? React.createElement('div',{className:'prow-spark'}, React.createElement(Spark,{data:p.form}))
          : null,
        React.createElement('div',{className:'prow-num'},
          React.createElement('div',{className:'prow-pts num'}, p.pts),
          React.createElement('div',{className:'prow-sub'}, variant==='market'? (p.ppg.toFixed(1)+' /gm'):'proj pts')),
        React.createElement('div',{className:'prow-price num'}, '£'+p.price.toFixed(1)),
        React.createElement('span',{className:'prow-hint', 'aria-hidden':true}, React.createElement(Icon,{name:'eye',size:15}))),
      // ---- action zone: tap to add (separate hit target) ----
      variant==='pick' && React.createElement('button',{
          className:'prow-action'+(disabled?' disabled':''), disabled,
          title: disabled? reason : 'Add '+p.name+' to squad',
          onClick:()=> !disabled && onPick && onPick(p)},
        picked ? React.createElement('span',{className:'pill pill-accent'}, React.createElement(Icon,{name:'check',size:13}),' In')
        : disabled ? React.createElement(Icon,{name:'lock',size:16,style:{color:'var(--text-3)'}})
        : React.createElement('span',{className:'add-btn'}, React.createElement(Icon,{name:'plus',size:18})))
    );
  }
  window.PlayerRow = PlayerRow;

  function FilterBar({pos, setPos, country, setCountry, sort, setSort, q, setQ, maxPrice, setMaxPrice, showSort=true}){
    const D = window.GAFFER_DATA;
    const countries = Object.keys(D.COUNTRIES);
    return React.createElement('div',{className:'filterbar'},
      React.createElement('div',{className:'search'},
        React.createElement(Icon,{name:'search',size:18,style:{color:'var(--text-3)'}}),
        React.createElement('input',{value:q, onChange:e=>setQ(e.target.value), placeholder:'Search players…'}),
        q && React.createElement('button',{className:'clear',onClick:()=>setQ('')}, React.createElement(Icon,{name:'close',size:15}))),
      React.createElement('div',{className:'filter-chips'},
        ['ALL','GK','DEF','MID','FWD'].map(x=>
          React.createElement('button',{key:x, className:'fchip'+(pos===x?' on':''), onClick:()=>setPos(x)},
            x==='ALL'?'All':x))),
      React.createElement('div',{className:'filter-selects'},
        React.createElement('div',{className:'sel'},
          React.createElement(Icon,{name:'flag',size:14,style:{color:'var(--text-3)'}}),
          React.createElement('select',{value:country, onChange:e=>setCountry(e.target.value)},
            React.createElement('option',{value:'ALL'},'All countries'),
            countries.map(c=>React.createElement('option',{key:c,value:c}, D.COUNTRIES[c].name)))),
        showSort && React.createElement('div',{className:'sel'},
          React.createElement(Icon,{name:'sort',size:14,style:{color:'var(--text-3)'}}),
          React.createElement('select',{value:sort, onChange:e=>setSort(e.target.value)},
            React.createElement('option',{value:'pts'},'Total points'),
            React.createElement('option',{value:'ppg'},'Points / game'),
            React.createElement('option',{value:'price-d'},'Price: high → low'),
            React.createElement('option',{value:'price-a'},'Price: low → high'),
            React.createElement('option',{value:'sel'},'Most picked'))),
        setMaxPrice && React.createElement('div',{className:'sel price-sel'},
          React.createElement('label',null,'Max £', React.createElement('b',{className:'num'}, maxPrice.toFixed(1))),
          React.createElement('input',{type:'range',min:4,max:13,step:.5,value:maxPrice, onChange:e=>setMaxPrice(+e.target.value)})))
    );
  }
  window.FilterBar = FilterBar;

  function usePlayerFilter(initialPos='ALL'){
    const D = window.GAFFER_DATA;
    const [pos,setPos]=useState(initialPos), [country,setCountry]=useState('ALL');
    const [sort,setSort]=useState('pts'), [q,setQ]=useState(''), [maxPrice,setMaxPrice]=useState(13);
    const list = useMemo(()=>{
      let r = D.PLAYERS.slice();
      if(pos!=='ALL') r = r.filter(p=>p.pos===pos);
      if(country!=='ALL') r = r.filter(p=>p.country===country);
      r = r.filter(p=>p.price<=maxPrice+0.001);
      if(q.trim()) r = r.filter(p=>p.name.toLowerCase().includes(q.toLowerCase()));
      const cmp = { pts:(a,b)=>b.pts-a.pts, ppg:(a,b)=>b.ppg-a.ppg, 'price-d':(a,b)=>b.price-a.price,
        'price-a':(a,b)=>a.price-b.price, sel:(a,b)=>b.selBy-a.selBy };
      r.sort(cmp[sort]||cmp.pts);
      return r;
    },[pos,country,sort,q,maxPrice]);
    return { list, props:{pos,setPos,country,setCountry,sort,setSort,q,setQ,maxPrice,setMaxPrice}, setPos };
  }
  window.usePlayerFilter = usePlayerFilter;
})();
