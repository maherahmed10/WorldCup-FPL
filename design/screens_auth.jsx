/* ============================================================
   GAFFER — Landing / Auth
   ============================================================ */
(function(){
  const { useState } = React;
  const Icon=window.Icon, Flag=window.Flag, PitchBg=window.PitchBg;

  function AuthScreen({onEnter}){
    const [mode,setMode]=useState('signup');
    const signup = mode==='signup';
    const teams=['BRA','FRA','ARG','ESP','ENG','GER','POR','NED','MEX','USA','MAR','JPN'];
    return React.createElement('div',{className:'auth'},
      React.createElement('div',{className:'auth-hero'},
        React.createElement('div',{className:'auth-pitch'}, React.createElement('div',{className:'auth-pitch-inner'}, React.createElement(PitchBg))),
        React.createElement('div',{className:'auth-hero-content'},
          React.createElement('div',{className:'brand',style:{padding:0,marginBottom:34}},
            React.createElement('div',{className:'brand-mark'},'G'),
            React.createElement('div',{className:'brand-name'},'GAFFER')),
          React.createElement('h1',{className:'auth-title'},'Pick your squad.',React.createElement('br'),'Predict. ',React.createElement('span',{style:{color:'var(--accent)'}},'Compete.')),
          React.createElement('p',{className:'auth-lede'},'The fantasy game for World Cup 2026. Build a squad of the world\u2019s best within budget, captain your stars, stake points on match markets, and climb mini-leagues with friends.'),
          React.createElement('div',{className:'auth-flags'},
            teams.map(c=>React.createElement(Flag,{key:c,code:c,size:22,round:true}))),
          React.createElement('div',{className:'auth-stats'},
            React.createElement('div',null,React.createElement('div',{className:'as-num num'},'48'),React.createElement('div',{className:'as-lab'},'Nations')),
            React.createElement('div',null,React.createElement('div',{className:'as-num num'},'104'),React.createElement('div',{className:'as-lab'},'Matches')),
            React.createElement('div',null,React.createElement('div',{className:'as-num num'},'2.4M'),React.createElement('div',{className:'as-lab'},'Managers'))))),
      React.createElement('div',{className:'auth-panel'},
        React.createElement('div',{className:'auth-card'},
          React.createElement('div',{className:'brand auth-card-brand'},
            React.createElement('div',{className:'brand-mark'},'G'),
            React.createElement('div',{className:'brand-name'},'GAFFER')),
          React.createElement('h2',{className:'auth-h2'}, signup?'Create your account':'Welcome back'),
          React.createElement('p',{className:'auth-p'}, signup?'Join free and pick your World Cup squad.':'Log in to manage your squad.'),
          React.createElement('div',{className:'social'},
            React.createElement('button',{className:'social-btn',onClick:onEnter},
              React.createElement(Icon,{name:'google',size:18}),'Continue with Google'),
            React.createElement('button',{className:'social-btn',onClick:onEnter},
              React.createElement(Icon,{name:'apple',size:18}),'Continue with Apple')),
          React.createElement('div',{className:'auth-or'},React.createElement('span',null,'or')),
          React.createElement('div',{className:'fields'},
            signup&&React.createElement('div',null,
              React.createElement('label',{className:'fld-label'},'Team name'),
              React.createElement('input',{className:'fld',placeholder:'Gaffer FC'})),
            React.createElement('div',null,
              React.createElement('label',{className:'fld-label'},'Email'),
              React.createElement('input',{className:'fld',type:'email',placeholder:'you@email.com'})),
            React.createElement('div',null,
              React.createElement('label',{className:'fld-label'},'Password'),
              React.createElement('input',{className:'fld',type:'password',placeholder:'••••••••'}))),
          React.createElement('button',{className:'btn btn-primary btn-block',style:{marginTop:18},onClick:onEnter},
            signup?'Create Account':'Log In'),
          React.createElement('p',{className:'auth-switch'},
            signup?'Already have an account? ':'New to GAFFER? ',
            React.createElement('button',{onClick:()=>setMode(signup?'login':'signup')}, signup?'Log in':'Sign up')),
          React.createElement('p',{className:'auth-legal'},'Virtual points only — no real-money gambling. By continuing you agree to the Terms & Legal Disclosure Policy.'))
      )
    );
  }
  window.AuthScreen = AuthScreen;
})();
