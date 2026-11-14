/* fff-texturi · texturi generate fractal pentru fundal și suprafețe, calculate local (WebGL2, cu rezervă în JS), fără rețea și fără fișiere de imagine.
 * Sursa canonică e ACEST fișier (tools/fff-texturi.js); aplicațiile îl primesc prin `node tools/inject-shared.mjs`, nu prin copiere de mână
 * (`inject-shared.mjs --check` verifică că fiecare copie e identică cu sursa). Rulează și în Node (module.exports) pentru teste; fără dependențe.
 *
 * Cum se obține imaginea: zgomot de gradient periodic (fBm, 4–12 octave), deformare de domeniu, multifractal „ridged”, celule Worley, benzi, țesătură,
 * fibre, iluminat cu hartă de normale din înălțime (Lambert + Blinn–Phong + ocluzie ambientală) și mulțimile Julia/Mandelbrot cu capcane de orbită.
 * Rezultatul e un strat translucid (alfa) pus pe fundalul paginii și pe suprafețele mari (carduri, panouri, antete, butoane): culorile aplicației
 * rămân ale ei, se adaugă doar materialul. Plăcile sunt periodice (se repetă fără cusătură); la rezoluție mare se văd fibre, pori, granule, zgârieturi.
 * Reguli: nu rulează în browsere automatizate (navigator.webdriver; se forțează cu ?fffx=1), în iframe, cu contrast ridicat / culori forțate /
 * economie de date / transparență redusă, nici la imprimare; se oprește cu ?notex=1, <meta name="fff-texturi" content="off"> sau din dialogul „Transparență”.
 * Imaginile sunt `data:` (CSP-ul aplicațiilor nu permite `blob:`); stilul se pune prin CSSOM (adoptedStyleSheets), deci nu intră în DOM-ul serializat.
 */
(function (root, factory) {
  var T = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = T;
  if (root && root.document && typeof root.document.createElement === 'function') {
    try { var F = root.FFF || {}; root.FFF = F; if (root.FFF === F) F.texturi = T; } catch (e) { /* inert */ }
    T._boot();
  }
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';
  var VERSION = '1.0.0';
  var DOC = root.document || null;

  /* ================= 1. PRESETE DE MATERIALE ================= */
  var DEF = {base: 4, oct: 9, gain: 0.5, aniso: [1, 1], warp: 0, ridge: 0, cell: [0, 0], stripe: [0, 0, 0], weave: 0, fiber: 0, fdir: 2, speck: 0, low: 0.3, curve: 1, c: [0, 0], cen: [0, 0], scale: 3, it: 200,
    bump: 1, spec: 0.15, shine: 24, ao: 0.5, pal: ['#202020', '#606060', '#a0a0a0', '#f0f0f0'], mott: ['#000000', 0],
    hi: '#ffffff', lo: '#000000', chroma: 0.25, A: 1, light: [-0.5, -0.55, 0.7]};
  var PRESETS = {
    parchment: {base: 3, oct: 10, gain: 0.47, warp: 0.3, fiber: 0.5, fdir: 4, speck: 0.07, bump: 0.7, spec: 0.03, shine: 12, ao: 0.5, pal: ['#6b4a22', '#a98550', '#d9bf8c', '#f4e6bf'], mott: ['#8a5a20', 0.45], hi: '#fff6dc', lo: '#3a2410', chroma: 0.3},
    washi: {base: 3, oct: 9, gain: 0.46, warp: 0.1, fiber: 1.1, fdir: 8, bump: 0.4, spec: 0.03, ao: 0.3, pal: ['#b8aa8a', '#d6cbb0', '#ece4d0', '#fbf7ec'], mott: ['#cdbf9c', 0.35], hi: '#ffffff', lo: '#4a3f2a', chroma: 0.2},
    linen: {base: 2, oct: 7, weave: 56, fiber: 0.6, warp: 0.05, bump: 1.7, spec: 0.05, ao: 0.55, pal: ['#8a7b62', '#b9aa8e', '#dccfb4', '#f3ead6'], hi: '#fffaf0', lo: '#3a3024', chroma: 0.25},
    leather: {base: 3, oct: 8, gain: 0.46, warp: 0.25, ridge: 0.05, cell: [14, 0.9], bump: 1.4, spec: 0.28, shine: 16, ao: 0.8, pal: ['#1c0e06', '#3b2010', '#5e3820', '#8b5a34'], mott: ['#000000', 0.25], hi: '#d9b48a', lo: '#0d0603', chroma: 0.4},
    wood: {base: 3, oct: 9, gain: 0.47, aniso: [1, 14], warp: 0.3, stripe: [9, 0.5, 0.7], fiber: 0.2, bump: 0.8, spec: 0.14, shine: 22, ao: 0.45, pal: ['#3a200c', '#6e421d', '#a0682f', '#d19a56'], mott: ['#2a1405', 0.3], hi: '#f0c98a', lo: '#1e0f04', chroma: 0.45},
    marble: {base: 2, oct: 10, gain: 0.42, warp: 1.1, ridge: 0.8, curve: 2.6, bump: 0.12, spec: 0.5, shine: 90, ao: 0.1, pal: ['#f7f7f9', '#e3e5ec', '#a5abba', '#2d3340'], hi: '#ffffff', lo: '#10131a', chroma: 0.12, low: 0.7},
    granite: {base: 6, oct: 10, gain: 0.46, ridge: 0.08, cell: [28, 0.3], speck: 0.38, bump: 0.8, spec: 0.2, shine: 40, ao: 0.5, pal: ['#101114', '#3c3d44', '#8b8c94', '#d8d8de'], hi: '#e9e9ee', lo: '#0b0b0e', chroma: 0.2},
    slate: {base: 3, oct: 9, gain: 0.45, aniso: [1, 3], ridge: 0.3, cell: [4, 0.25], warp: 0.15, bump: 1, spec: 0.12, shine: 30, ao: 0.6, pal: ['#0d1114', '#26323a', '#55666f', '#8fa3ab'], hi: '#b9c9d0', lo: '#05080a', chroma: 0.2},
    brass: {base: 2, oct: 9, aniso: [1, 40], warp: 0.05, bump: 0.35, spec: 0.85, shine: 34, ao: 0.1, pal: ['#3a2604', '#7d5a10', '#c8982c', '#f5dc8a'], mott: ['#4f7a58', 0.18], hi: '#fff1b5', lo: '#2a1b02', chroma: 0.4, low: 0.5},
    gold: {base: 2, oct: 8, gain: 0.47, aniso: [1, 20], warp: 0.12, bump: 0.5, spec: 0.95, shine: 38, ao: 0.15, pal: ['#4a3204', '#9a7010', '#e8b923', '#fff3b0'], mott: ['#c47a10', 0.15], hi: '#fff6c4', lo: '#2e1d00', chroma: 0.45, low: 0.5},
    steel: {base: 2, oct: 9, aniso: [1, 60], warp: 0.02, bump: 0.25, spec: 0.95, shine: 80, ao: 0.1, pal: ['#15181d', '#4a505b', '#a9b0bd', '#f4f8ff'], hi: '#ffffff', lo: '#0a0c10', chroma: 0.1},
    jade: {base: 2, oct: 9, gain: 0.45, warp: 0.9, ridge: 0.3, cell: [5, 0.22], bump: 0.5, spec: 0.5, shine: 30, ao: 0.3, pal: ['#04201a', '#0e5a46', '#4fb08a', '#c4f2d8'], mott: ['#a7e0b8', 0.2], hi: '#d8fbe6', lo: '#021510', chroma: 0.5, low: 0.6},
    ice: {base: 3, oct: 8, gain: 0.45, warp: 0.45, ridge: 0.45, cell: [8, 0.5], bump: 0.5, spec: 0.6, shine: 60, ao: 0.15, pal: ['#07182c', '#1c4f7c', '#7cc0e8', '#f0fdff'], hi: '#ffffff', lo: '#04101f', chroma: 0.45, low: 0.5},
    nebula: {base: 2, oct: 10, gain: 0.48, warp: 1.6, ridge: 0.35, speck: -0.5, bump: 0.12, spec: 0, ao: 0, pal: ['#03020c', '#241060', '#a02a9c', '#ffb6e8'], mott: ['#2a5cff', 0.4], hi: '#fff0ff', lo: '#02010a', chroma: 0.8, low: 1},
    moss: {base: 3, oct: 10, gain: 0.46, warp: 0.9, ridge: 0.2, cell: [16, 0.3], bump: 1, spec: 0.08, ao: 0.6, pal: ['#08140a', '#1f4a16', '#5f9a2e', '#c4e07a'], mott: ['#6b4f1e', 0.2], hi: '#d6efa0', lo: '#050d05', chroma: 0.5, low: 0.4},
    sand: {base: 4, oct: 9, gain: 0.46, aniso: [1, 2], ridge: 0.25, speck: 0.12, warp: 0.3, bump: 0.7, spec: 0.05, ao: 0.35, pal: ['#5b4426', '#9a7a4a', '#d4b783', '#f6e4c0'], hi: '#fff0cf', lo: '#3a2a14', chroma: 0.3, low: 0.5},
    julia: {frac: 'julia', c: [-0.7269, 0.1889], cen: [0, 0], scale: 3, it: 260, bump: 1.2, spec: 0.5, shine: 40, pal: ['#04010f', '#2b0f6b', '#c13d8f', '#ffe9b8'], hi: '#fff0d0', lo: '#05010f', chroma: 0.75},
    mandel: {frac: 'mandel', cen: [-0.7453, 0.1127], scale: 0.05, it: 320, bump: 1.2, spec: 0.5, shine: 40, pal: ['#020813', '#0b3d7a', '#2fb5c4', '#fff2c8'], hi: '#f2fdff', lo: '#020813', chroma: 0.75}
  };
  var ALIAS = {hartie: 'washi', pergament: 'parchment', lemn: 'wood', marmura: 'marble', piatra: 'granite', piele: 'leather', bronz: 'brass', aur: 'gold', otel: 'steel',
    gheata: 'ice', cosmos: 'nebula', muschi: 'moss', nisip: 'sand', panza: 'linen', ardezie: 'slate', fractal: 'julia'};

  /* ================= 2. TEXTE (8 limbi) ================= */
  var TXT = {
    ro: {h: 'Texturi fractale', l: 'Texturi generate fractal pe fundal și suprafețe', t: 'Se calculează local, fără rețea. Se opresc automat la contrast ridicat sau la economie de date.'},
    en: {h: 'Fractal textures', l: 'Fractal-generated textures on background and surfaces', t: 'Computed locally, no network. Switched off automatically for high contrast or data saver.'},
    fr: {h: 'Textures fractales', l: 'Textures générées par fractales sur le fond et les surfaces', t: 'Calculées localement, sans réseau. Désactivées automatiquement en contraste élevé ou en économie de données.'},
    it: {h: 'Texture frattali', l: 'Texture generate con frattali su sfondo e superfici', t: 'Calcolate in locale, senza rete. Disattivate automaticamente con contrasto elevato o risparmio dati.'},
    es: {h: 'Texturas fractales', l: 'Texturas generadas con fractales en el fondo y las superficies', t: 'Se calculan localmente, sin red. Se desactivan automáticamente con alto contraste o ahorro de datos.'},
    pt: {h: 'Texturas fractais', l: 'Texturas geradas com fractais no fundo e nas superfícies', t: 'Calculadas localmente, sem rede. Desativadas automaticamente com alto contraste ou poupança de dados.'},
    de: {h: 'Fraktale Texturen', l: 'Fraktal erzeugte Texturen auf Hintergrund und Flächen', t: 'Lokal berechnet, ohne Netzwerk. Bei hohem Kontrast oder Datensparmodus automatisch aus.'},
    hu: {h: 'Fraktál textúrák', l: 'Fraktálokkal generált textúrák a háttéren és a felületeken', t: 'Helyben számolva, hálózat nélkül. Nagy kontraszt vagy adatkímélő mód esetén automatikusan kikapcsol.'}
  };

  /* ================= utilitare ================= */
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function hex(c) { c = String(c || '#000').replace('#', ''); if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2]; var n = parseInt(c, 16) || 0; return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) if (b[k] !== undefined && b[k] !== null) o[k] = b[k]; return o; }
  function resolve(name, over) {
    var key = ALIAS[name] || name, p = PRESETS[key] || PRESETS.parchment;
    var o = merge(DEF, p); if (over) o = merge(o, over); o.name = PRESETS[key] ? key : 'parchment'; return o;
  }

  /* ================= 3. SHADERE (GLSL ES 3.00) ================= */
  var VS = '#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.0,1.0);}';
  var GL_COMMON = ['#version 300 es', 'precision highp float;', 'precision highp int;', 'uniform vec2 uSize;', 'uniform int uSeed;', 'uniform vec3 uPal[4];', 'uniform vec3 uLight;',
    'uniform vec4 uShade;', 'out vec4 oc;',
    'vec3 ramp(float t){t=clamp(t,0.0,1.0)*3.0;int i=int(min(floor(t),2.0));float f=t-float(i);f=f*f*(3.0-2.0*f);return mix(uPal[i],uPal[i+1],f);}',
    'vec3 shade(vec3 al,vec3 N,float ao,float sp){vec3 L=normalize(uLight);float ndl=clamp(dot(N,L),0.0,1.0);vec3 Hh=normalize(L+vec3(0.0,0.0,1.0));',
    'float s=pow(clamp(dot(N,Hh),0.0,1.0),uShade.z)*uShade.y*sp;return al*(0.42+0.95*ndl)*ao+s*vec3(1.0,0.96,0.88);}'].join('\n');
  var FS_MAT = GL_COMMON + '\n' + [
    'uniform int uBase;', 'uniform int uOct;', 'uniform float uTile;', 'uniform float uZoom;', 'uniform float uGain;', 'uniform float uWarp;', 'uniform float uRidge;',
    'uniform float uWeave;', 'uniform float uFiber;', 'uniform int uFdir;', 'uniform float uSpeck;', 'uniform float uCurve;', 'uniform ivec2 uAniso;', 'uniform vec2 uCell;', 'uniform vec3 uStripe;', 'uniform vec4 uMott;',
    'float gR;',
    'ivec2 wrp(ivec2 i,ivec2 p){return i-p*ivec2(floor(vec2(i)/vec2(p)));}',
    'vec2 h2(ivec2 i,ivec2 per,int salt){i=wrp(i,per);uvec2 v=uvec2(i)+uvec2(uint(uSeed)*374761393u+uint(salt)*668265263u,uint(uSeed)*2246822519u+uint(salt)*3266489917u);',
    'v=v*1664525u+1013904223u;v.x+=v.y*1664525u;v.y+=v.x*1664525u;v^=v>>16u;v.x+=v.y*1664525u;v.y+=v.x*1664525u;v^=v>>16u;return vec2(v)*(1.0/4294967296.0);}',
    'float gn(vec2 p,ivec2 per,int salt){ivec2 i=ivec2(floor(p));vec2 f=p-vec2(i);vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);',
    'float a0=6.2831853*h2(i,per,salt).x,a1=6.2831853*h2(i+ivec2(1,0),per,salt).x,a2=6.2831853*h2(i+ivec2(0,1),per,salt).x,a3=6.2831853*h2(i+ivec2(1,1),per,salt).x;',
    'float v00=cos(a0)*f.x+sin(a0)*f.y,v10=cos(a1)*(f.x-1.0)+sin(a1)*f.y,v01=cos(a2)*f.x+sin(a2)*(f.y-1.0),v11=cos(a3)*(f.x-1.0)+sin(a3)*(f.y-1.0);',
    'return 1.4142*mix(mix(v00,v10,u.x),mix(v01,v11,u.x),u.y);}',
    'float fbm(vec2 p,ivec2 per,int oct,float gain,int salt){float s=0.0,a=1.0,n=0.0;for(int k=0;k<12;k++){if(k>=oct)break;s+=a*gn(p,per,salt+k*7);n+=a;p*=2.0;per*=2;a*=gain;}return s/n;}',
    'float rn(vec2 p,ivec2 per,int oct,float gain,int salt){float s=0.0,a=1.0,w=1.0,n=0.0;for(int k=0;k<12;k++){if(k>=oct)break;float g=1.0-abs(gn(p,per,salt+k*7));g*=g;g*=w;w=clamp(g*2.0,0.0,1.0);s+=g*a;n+=a;p*=2.0;per*=2;a*=gain;}return s/n;}',
    'vec3 wl(vec2 p,ivec2 per,int salt){ivec2 ip=ivec2(floor(p));vec2 fp=p-vec2(ip);float d1=9.0,d2=9.0,r1=0.0;',
    'for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){ivec2 g=ivec2(x,y);vec2 h=h2(ip+g,per,salt);vec2 r=vec2(g)+h-fp;float d=dot(r,r);',
    'if(d<d1){d2=d1;d1=d;r1=h2(ip+g,per,salt+1).x;}else if(d<d2){d2=d;}}}return vec3(sqrt(d1),sqrt(d2),r1);}',
    'const ivec2 FD[8]=ivec2[8](ivec2(1,0),ivec2(0,1),ivec2(1,1),ivec2(-1,1),ivec2(2,1),ivec2(-1,2),ivec2(1,2),ivec2(-2,1));',
    'void dom(vec2 uv,out vec2 p,out ivec2 per){if(uTile>0.5){p=uv*float(uBase);per=ivec2(uBase);}else{p=uv*uZoom;per=ivec2(1048576);}}',
    'float H(vec2 uv){gR=0.5;vec2 p;ivec2 per;dom(uv,p,per);vec2 q=p;',
    'if(uWarp>0.0){vec2 w=vec2(fbm(p+vec2(5.2,1.3),per,5,0.5,31),fbm(p+vec2(1.7,9.2),per,5,0.5,47));q=p+uWarp*1.5*w;}',
    'ivec2 pa=per*uAniso;vec2 qa=q*vec2(uAniso);float h=fbm(qa,pa,uOct,uGain,1)*0.5+0.5;',
    'if(uRidge>0.0)h=mix(h,rn(qa,pa,uOct,uGain,5),uRidge);',
    'if(uStripe.y>0.0){float wv=fbm(q,per,5,0.5,77);float s=0.5+0.5*sin(6.2831853*(uStripe.x*uv.y+uStripe.z*wv));h=mix(h,0.5*h+0.5*s,uStripe.y);}',
    'if(uCell.y>0.0){int cs=int(uCell.x);vec3 w=wl(q*uCell.x,per*cs,13);float e=smoothstep(0.0,0.22,w.y-w.x);h=mix(h,0.45*h+0.55*e+(w.z-0.5)*0.10,uCell.y);gR=w.z;}',
    'if(uWeave>0.0){vec2 t=uv*uWeave+0.08*vec2(fbm(q*2.0,per*2,3,0.5,201),fbm(q*2.0+vec2(7.0,3.0),per*2,3,0.5,203));vec2 ft=fract(t),it=floor(t);float chk=mod(it.x+it.y,2.0);',
    'float tv=sin(3.14159265*ft.x),th=sin(3.14159265*ft.y);h=mix(h,mix(th*0.55+0.25,tv*0.55+0.25,chk)+0.25*h,0.75);}',
    'if(uFiber>0.0){float fs=0.0;for(int k=0;k<8;k++){if(k>=uFdir)break;ivec2 d=FD[k];vec2 c=vec2(float(d.x)*q.x+float(d.y)*q.y,28.0*(float(d.x)*q.y-float(d.y)*q.x));fs+=fbm(c,per*ivec2(1,28),4,0.55,301+k*11);}h+=uFiber*0.18*sqrt(2.0/float(uFdir))*fs;}',
    'if(uSpeck!=0.0){vec3 w=wl(q*9.0,per*9,91);float dt=smoothstep(0.20,0.03,w.x)*step(1.0-abs(uSpeck)*0.9,w.z);h-=sign(uSpeck)*dt*0.22;}',
    'return pow(clamp(h,0.0,1.0),uCurve);}',
    'void main(){vec2 fc=vec2(gl_FragCoord.x,uSize.y-gl_FragCoord.y);vec2 uv=uTile>0.5?fc/uSize:fc/uSize.y;vec2 st=uTile>0.5?1.0/uSize:vec2(1.0/uSize.y);',
    'float h0=H(uv);float r0=gR;float hx=H(uv+vec2(st.x,0.0));float hy=H(uv+vec2(0.0,st.y));float k=uShade.x*uSize.x*0.035;',
    'vec3 N=normalize(vec3(-(hx-h0)*k,-(hy-h0)*k,1.0));vec2 p;ivec2 per;dom(uv,p,per);float low=fbm(p,per,3,0.5,201);',
    'vec3 al=ramp(h0+0.10*(r0-0.5)*step(0.001,uCell.y));al=mix(al,uMott.rgb,uMott.a*smoothstep(-0.25,0.5,low));',
    'float ao=mix(1.0,0.5+0.5*smoothstep(0.05,0.75,h0),uShade.w);',
    'vec3 col=shade(al,N,ao,0.4+0.6*h0);col+=(h2(ivec2(gl_FragCoord.xy),ivec2(65536),999).x-0.5)/255.0;oc=vec4(clamp(col,0.0,1.0),1.0);}'
  ].join('\n');
  var FS_FRAC = GL_COMMON + '\n' + [
    'uniform vec2 uC;', 'uniform vec2 uCen;', 'uniform float uScale;', 'uniform float uJulia;', 'uniform int uIt;',
    'vec2 fz(vec2 z0){vec2 z=uJulia>0.5?z0:vec2(0.0);vec2 c=uJulia>0.5?uC:z0;float it=0.0,trap=1e9;bool esc=false;',
    'for(int i=0;i<640;i++){if(i>=uIt)break;z=vec2(z.x*z.x-z.y*z.y,2.0*z.x*z.y)+c;trap=min(trap,abs(z.x*z.y)+0.12*abs(length(z)-1.0));',
    'if(dot(z,z)>1024.0){esc=true;break;}it+=1.0;}',
    'return vec2(esc?it-log2(log2(dot(z,z)))+4.0:-1.0,trap);}',
    'float P(vec2 v){return v.x>=0.0?0.55*log(1.0+v.x)+0.35*exp(-5.0*v.y):0.7*exp(-4.0*v.y);}',
    'void main(){vec2 fc=vec2(gl_FragCoord.x,uSize.y-gl_FragCoord.y);vec2 z0=uCen+(fc-0.5*uSize)/uSize.y*uScale;float px=uScale/uSize.y;',
    'vec2 a=fz(z0),b=fz(z0+vec2(px,0.0)),c=fz(z0+vec2(0.0,px));float h0=P(a);float k=uShade.x*uSize.y*0.5;',
    'vec3 N=normalize(vec3(-(P(b)-h0)*k,-(P(c)-h0)*k,1.0));',
    'vec3 al=ramp(a.x>=0.0?0.25+0.75*(0.5+0.5*sin(0.25*a.x+6.0*a.y)):0.12+0.5*clamp(1.0-3.5*a.y,0.0,1.0));',
    'vec3 col=shade(al,N,mix(1.0,0.55+0.45*clamp(h0,0.0,1.0),uShade.w),0.5+0.5*clamp(h0,0.0,1.0));',
    'col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;oc=vec4(clamp(col,0.0,1.0),1.0);}'
  ].join('\n');

  /* ================= 4. RANDARE WebGL2 (pe benzi, ca firul principal să nu înghețe) ================= */
  var GLOK = null;
  function now() { return (root.performance && root.performance.now) ? root.performance.now() : Date.now(); }
  function hasGL() {
    if (GLOK !== null) return GLOK;
    try { var c = DOC.createElement('canvas'), g = c.getContext('webgl2'); GLOK = !!g; if (g) { var l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); } } catch (e) { GLOK = false; }
    return GLOK;
  }
  function compile(gl, type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { var e = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error('shader: ' + e); }
    return s;
  }
  function program(gl, fs) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS)); gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    return p;
  }
  function uni(gl, p) {
    var c = {};
    function L(n) { return n in c ? c[n] : (c[n] = gl.getUniformLocation(p, n)); }
    return {
      f: function (n, a) { gl.uniform1f(L(n), a); }, i: function (n, a) { gl.uniform1i(L(n), a); },
      v2: function (n, a, b) { gl.uniform2f(L(n), a, b); }, i2: function (n, a, b) { gl.uniform2i(L(n), a, b); },
      v3: function (n, a, b, c3) { gl.uniform3f(L(n), a, b, c3); }, v4: function (n, a, b, c3, d) { gl.uniform4f(L(n), a, b, c3, d); },
      v3a: function (n, arr) { gl.uniform3fv(L(n), arr); }
    };
  }
  function setUniforms(U, P, spec) {
    var pal = []; P.pal.forEach(function (c) { var h = hex(c); pal.push(h[0], h[1], h[2]); });
    U.v2('uSize', spec.w, spec.h); U.i('uSeed', spec.seed | 0); U.v3a('uPal', new Float32Array(pal));
    U.v3('uLight', P.light[0], P.light[1], P.light[2]); U.v4('uShade', P.bump, P.spec, P.shine, P.ao);
    if (P.frac) { U.v2('uC', P.c[0], P.c[1]); U.v2('uCen', P.cen[0], P.cen[1]); U.f('uScale', P.scale); U.f('uJulia', P.frac === 'julia' ? 1 : 0); U.i('uIt', P.it | 0); return; }
    U.i('uBase', P.base | 0); U.i('uOct', P.oct | 0); U.f('uTile', spec.tile ? 1 : 0); U.f('uZoom', spec.zoom || 6);
    U.f('uCurve', P.curve); U.f('uGain', P.gain); U.f('uWarp', P.warp); U.f('uRidge', P.ridge); U.f('uWeave', P.weave); U.f('uFiber', P.fiber); U.i('uFdir', Math.max(1, Math.min(8, P.fdir | 0))); U.f('uSpeck', P.speck);
    U.i2('uAniso', P.aniso[0] | 0, P.aniso[1] | 0); U.v2('uCell', P.cell[0], P.cell[1]); U.v3('uStripe', P.stripe[0], P.stripe[1], P.stripe[2]);
    var m = hex(P.mott[0]); U.v4('uMott', m[0], m[1], m[2], P.mott[1]);
  }
  function glRender(P, spec) {
    return new Promise(function (resolve, reject) {
      var gl, cv;
      try {
        cv = DOC.createElement('canvas'); cv.width = spec.w; cv.height = spec.h;
        gl = cv.getContext('webgl2', {antialias: false, depth: false, stencil: false, alpha: false, preserveDrawingBuffer: true});
        if (!gl) throw new Error('fără WebGL2');
        var prog = program(gl, P.frac ? FS_FRAC : FS_MAT);
        gl.useProgram(prog); setUniforms(uni(gl, prog), P, spec);
        gl.viewport(0, 0, spec.w, spec.h); gl.enable(gl.SCISSOR_TEST);
      } catch (e) { return reject(e); }
      var bh = Math.max(16, Math.floor((spec.band || 160000) / spec.w)), y = 0;
      (function step() {
        try { var hh = Math.min(bh, spec.h - y); gl.scissor(0, y, spec.w, hh); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.finish(); y += hh; } catch (e) { return reject(e); }
        if (y < spec.h) return setTimeout(step, 0);
        try {
          var c2 = DOC.createElement('canvas'); c2.width = spec.w; c2.height = spec.h;
          var x = c2.getContext('2d', {willReadFrequently: true}); x.drawImage(cv, 0, 0);
          var id = x.getImageData(0, 0, spec.w, spec.h), lose = gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
          resolve(id);
        } catch (e2) { reject(e2); }
      })();
    });
  }

  /* ================= 5. DE LA PIXELI OPACI LA STRAT TRANSLUCID ================= */
  // Medie pe fereastră (2r+1) cu înfășurare (plăcile sunt periodice), separabilă, O(n).
  function blurWrap(a, w, h, r) {
    var n = w * h, t = new Float32Array(n), o = new Float32Array(n), x, y, k, s, d = 2 * r + 1;
    for (y = 0; y < h; y++) {
      s = 0; for (k = -r; k <= r; k++) s += a[y * w + (((k % w) + w) % w)];
      for (x = 0; x < w; x++) { t[y * w + x] = s / d; s += a[y * w + ((x + r + 1) % w)] - a[y * w + ((((x - r) % w) + w) % w)]; }
    }
    for (x = 0; x < w; x++) {
      s = 0; for (k = -r; k <= r; k++) s += t[(((k % h) + h) % h) * w + x];
      for (y = 0; y < h; y++) { o[y * w + x] = s / d; s += t[((y + r + 1) % h) * w + x] - t[((((y - r) % h) + h) % h) * w + x]; }
    }
    return o;
  }
  // Normalizează luminanța (medie 0, abatere standard fixă), apoi: peste medie → nuanța „hi” cu alfa ∝ abatere, sub medie → nuanța „lo”.
  // Așa orice material are aceeași amplitudine și nu schimbă luminozitatea medie a suprafeței pe care stă.
  function overlayize(id, o) {
    if (o.mode === 'opaque') return id;
    var d = id.data, n = d.length >> 2, i, s = 0, s2 = 0, Lm = new Float32Array(n), low = o.low == null ? 0.3 : o.low;
    for (i = 0; i < n; i++) Lm[i] = (d[i * 4] * 77 + d[i * 4 + 1] * 150 + d[i * 4 + 2] * 29) / 256;
    if (low < 1 && id.width > 32 && id.height > 32) {   // trece-sus: din frecvențele joase rămâne doar fracția „low” (1 = tot, 0 = nimic)
      var bl = blurWrap(Lm, id.width, id.height, Math.max(4, Math.round(Math.min(id.width, id.height) / 16))), f = 1 - low;
      for (i = 0; i < n; i++) Lm[i] -= f * bl[i];
    }
    for (i = 0; i < n; i++) { s += Lm[i]; s2 += Lm[i] * Lm[i]; }
    var mean = s / n, sd = Math.sqrt(Math.max(1, s2 / n - mean * mean)), k = (o.k || 3) * sd;
    var hi = hex(o.hi), lo = hex(o.lo), ch = clamp(o.chroma, 0, 1), A = 255 * clamp(o.A, 0, 1), gm = o.gamma || 1;
    for (i = 0; i < n; i++) {
      var r = d[i * 4], g = d[i * 4 + 1], b = d[i * 4 + 2];
      var t = clamp((Lm[i] - mean) / k, -1, 1), a = Math.abs(t), tn = t > 0 ? hi : lo;
      if (gm !== 1) a = Math.pow(a, gm);
      d[i * 4] = (1 - ch) * tn[0] * 255 + ch * r; d[i * 4 + 1] = (1 - ch) * tn[1] * 255 + ch * g; d[i * 4 + 2] = (1 - ch) * tn[2] * 255 + ch * b;
      d[i * 4 + 3] = a * A;
    }
    return id;
  }
  function toURL(id, alpha) {
    if (!(root.ImageData && id instanceof root.ImageData)) id = new root.ImageData(new Uint8ClampedArray(id.data), id.width, id.height);
    var cv = DOC.createElement('canvas'); cv.width = id.width; cv.height = id.height;
    cv.getContext('2d').putImageData(id, 0, 0);
    var u = cv.toDataURL('image/webp', 0.86);
    if (u.indexOf('data:image/webp') === 0) return u;
    return alpha ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.9);
  }

  /* ================= 6. RANDARE CPU (rezervă și teste; aceleași formule ca în shader, cu mai puține octave) ================= */
  var _hx = 0, _hy = 0, _w1 = 0, _w2 = 0, _wr = 0, imul = Math.imul || function (a, b) { return ((a & 0xffff) * b + (((a >>> 16) * b & 0xffff) << 16)) | 0; };
  function h2(ix, iy, px, py, salt, seed) {
    ix -= px * Math.floor(ix / px); iy -= py * Math.floor(iy / py);
    var vx = (ix + imul(seed, 374761393) + imul(salt, 668265263)) >>> 0, vy = (iy + imul(seed, 2246822519) + imul(salt, 3266489917)) >>> 0;
    vx = (imul(vx, 1664525) + 1013904223) >>> 0; vy = (imul(vy, 1664525) + 1013904223) >>> 0;
    vx = (vx + imul(vy, 1664525)) >>> 0; vy = (vy + imul(vx, 1664525)) >>> 0;
    vx = (vx ^ (vx >>> 16)) >>> 0; vy = (vy ^ (vy >>> 16)) >>> 0;
    vx = (vx + imul(vy, 1664525)) >>> 0; vy = (vy + imul(vx, 1664525)) >>> 0;
    vx = (vx ^ (vx >>> 16)) >>> 0; vy = (vy ^ (vy >>> 16)) >>> 0;
    _hx = vx / 4294967296; _hy = vy / 4294967296;
  }
  function gn(px, py, perx, pery, salt, seed) {
    var ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
    var ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10), uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    h2(ix, iy, perx, pery, salt, seed); var a0 = 6.2831853 * _hx;
    h2(ix + 1, iy, perx, pery, salt, seed); var a1 = 6.2831853 * _hx;
    h2(ix, iy + 1, perx, pery, salt, seed); var a2 = 6.2831853 * _hx;
    h2(ix + 1, iy + 1, perx, pery, salt, seed); var a3 = 6.2831853 * _hx;
    var v00 = Math.cos(a0) * fx + Math.sin(a0) * fy, v10 = Math.cos(a1) * (fx - 1) + Math.sin(a1) * fy;
    var v01 = Math.cos(a2) * fx + Math.sin(a2) * (fy - 1), v11 = Math.cos(a3) * (fx - 1) + Math.sin(a3) * (fy - 1);
    var a = v00 + (v10 - v00) * ux, b = v01 + (v11 - v01) * ux;
    return 1.4142 * (a + (b - a) * uy);
  }
  function fbm(px, py, perx, pery, oct, gain, salt, seed) {
    var s = 0, a = 1, n = 0;
    for (var k = 0; k < oct; k++) { s += a * gn(px, py, perx, pery, salt + k * 7, seed); n += a; px *= 2; py *= 2; perx *= 2; pery *= 2; a *= gain; }
    return s / n;
  }
  function rnoise(px, py, perx, pery, oct, gain, salt, seed) {
    var s = 0, a = 1, w = 1, n = 0;
    for (var k = 0; k < oct; k++) {
      var g = 1 - Math.abs(gn(px, py, perx, pery, salt + k * 7, seed)); g *= g; g *= w; w = clamp(g * 2, 0, 1);
      s += g * a; n += a; px *= 2; py *= 2; perx *= 2; pery *= 2; a *= gain;
    }
    return s / n;
  }
  function wl(px, py, perx, pery, salt, seed) {
    var ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy, d1 = 9, d2 = 9, r1 = 0;
    for (var y = -1; y <= 1; y++) for (var x = -1; x <= 1; x++) {
      h2(ix + x, iy + y, perx, pery, salt, seed);
      var rx = x + _hx - fx, ry = y + _hy - fy, d = rx * rx + ry * ry;
      if (d < d1) { d2 = d1; d1 = d; h2(ix + x, iy + y, perx, pery, salt + 1, seed); r1 = _hx; } else if (d < d2) d2 = d;
    }
    _w1 = Math.sqrt(d1); _w2 = Math.sqrt(d2); _wr = r1;
  }
  function sstep(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  var FDIR = [[1, 0], [0, 1], [1, 1], [-1, 1], [2, 1], [-1, 2], [1, 2], [-2, 1]];
  function makeH(P, spec) {
    var seed = spec.seed | 0, tile = !!spec.tile, base = P.base | 0, zoom = spec.zoom || 6, oct = Math.min(P.oct | 0, spec.maxOct || 12);
    var ax = P.aniso[0] | 0, ay = P.aniso[1] | 0;
    function H(u, v) {
      H.r = 0.5;
      var px, py, per;
      if (tile) { px = u * base; py = v * base; per = base; } else { px = u * zoom; py = v * zoom; per = 1048576; }
      var qx = px, qy = py;
      if (P.warp > 0) {
        var wx = fbm(px + 5.2, py + 1.3, per, per, 5, 0.5, 31, seed), wy = fbm(px + 1.7, py + 9.2, per, per, 5, 0.5, 47, seed);
        qx = px + P.warp * 1.5 * wx; qy = py + P.warp * 1.5 * wy;
      }
      var pax = per * ax, pay = per * ay, qax = qx * ax, qay = qy * ay;
      var h = fbm(qax, qay, pax, pay, oct, P.gain, 1, seed) * 0.5 + 0.5;
      if (P.ridge > 0) h += (rnoise(qax, qay, pax, pay, oct, P.gain, 5, seed) - h) * P.ridge;
      if (P.stripe[1] > 0) {
        var wv = fbm(qx, qy, per, per, 5, 0.5, 77, seed), s = 0.5 + 0.5 * Math.sin(6.2831853 * (P.stripe[0] * v + P.stripe[2] * wv));
        h += (0.5 * h + 0.5 * s - h) * P.stripe[1];
      }
      if (P.cell[1] > 0) {
        var cs = P.cell[0] | 0; wl(qx * cs, qy * cs, per * cs, per * cs, 13, seed);
        var e = sstep(0, 0.22, _w2 - _w1); h += (0.45 * h + 0.55 * e + (_wr - 0.5) * 0.1 - h) * P.cell[1]; H.r = _wr;
      }
      if (P.weave > 0) {
        var tx = u * P.weave + 0.08 * fbm(qx * 2, qy * 2, per * 2, per * 2, 3, 0.5, 201, seed), ty = v * P.weave + 0.08 * fbm(qx * 2 + 7, qy * 2 + 3, per * 2, per * 2, 3, 0.5, 203, seed);
        var fx = tx - Math.floor(tx), fy = ty - Math.floor(ty), chk = (Math.floor(tx) + Math.floor(ty)) & 1;
        var tv = Math.sin(3.14159265 * fx), th = Math.sin(3.14159265 * fy), m = chk ? tv * 0.55 + 0.25 : th * 0.55 + 0.25;
        h += (m + 0.25 * h - h) * 0.75;
      }
      if (P.fiber > 0) {
        var fd = Math.max(1, Math.min(8, P.fdir | 0)), fs = 0;
        for (var fk = 0; fk < fd; fk++) { var dx = FDIR[fk][0], dy = FDIR[fk][1]; fs += fbm(dx * qx + dy * qy, 28 * (dx * qy - dy * qx), per, per * 28, 4, 0.55, 301 + fk * 11, seed); }
        h += P.fiber * 0.18 * Math.sqrt(2 / fd) * fs;
      }
      if (P.speck !== 0) {
        wl(qx * 9, qy * 9, per * 9, per * 9, 91, seed);
        var dt = sstep(0.2, 0.03, _w1) * (_wr >= 1 - Math.abs(P.speck) * 0.9 ? 1 : 0); h -= (P.speck > 0 ? 1 : -1) * dt * 0.22;
      }
      return P.curve === 1 ? clamp(h, 0, 1) : Math.pow(clamp(h, 0, 1), P.curve);
    }
    H.r = 0.5; return H;
  }
  function cpuRender(P, spec) {
    return new Promise(function (resolve) {
      var w = spec.w, h = spec.h, data = new Uint8ClampedArray(w * h * 4), y = 0, tile = !!spec.tile;
      var pal = P.pal.map(hex), mott = hex(P.mott[0]), ma = P.mott[1], seed = spec.seed | 0, base = P.base | 0;
      var L = P.light, ll = 1 / Math.sqrt(L[0] * L[0] + L[1] * L[1] + L[2] * L[2]), lx = L[0] * ll, ly = L[1] * ll, lz = L[2] * ll;
      var hx0 = lx, hy0 = ly, hz0 = lz + 1, hl = 1 / Math.sqrt(hx0 * hx0 + hy0 * hy0 + hz0 * hz0);
      var H = P.frac ? null : makeH(P, merge(spec, {maxOct: spec.maxOct || 6})), k = P.bump * (P.frac ? h * 0.5 : w * 0.035);
      function ramp(t) { t = clamp(t, 0, 1) * 3; var i = Math.min(Math.floor(t), 2), f = t - i; f = f * f * (3 - 2 * f); var a = pal[i], b = pal[i + 1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
      var fm = 0, ft = 0;
      function fz(x0, y0) {
        var julia = P.frac === 'julia', zx = julia ? x0 : 0, zy = julia ? y0 : 0, cx = julia ? P.c[0] : x0, cy = julia ? P.c[1] : y0, it = 0, trap = 1e9, esc = false;
        for (var i = 0; i < Math.min(P.it, 160); i++) {
          var t = zx * zx - zy * zy + cx; zy = 2 * zx * zy + cy; zx = t;
          trap = Math.min(trap, Math.abs(zx * zy) + 0.12 * Math.abs(Math.sqrt(zx * zx + zy * zy) - 1));
          if (zx * zx + zy * zy > 1024) { esc = true; break; } it++;
        }
        fm = esc ? it - Math.log(Math.log(zx * zx + zy * zy) / Math.LN2) / Math.LN2 + 4 : -1; ft = trap;
      }
      function Pf() { return fm >= 0 ? 0.55 * Math.log(1 + fm) + 0.35 * Math.exp(-5 * ft) : 0.7 * Math.exp(-4 * ft); }
      function row(yy) {
        for (var xx = 0; xx < w; xx++) {
          var u = (xx + 0.5) / (tile ? w : h), v = (yy + 0.5) / h, stx = tile ? 1 / w : 1 / h, sty = 1 / h, h0, hx, hy, al, ao, sp;
          if (P.frac) {
            var sc = P.scale / h, z0x = P.cen[0] + (xx + 0.5 - 0.5 * w) * sc, z0y = P.cen[1] + (yy + 0.5 - 0.5 * h) * sc;
            fz(z0x, z0y); var m0 = fm, t0 = ft; h0 = Pf(); fz(z0x + sc, z0y); hx = Pf(); fz(z0x, z0y + sc); hy = Pf();
            al = ramp(m0 >= 0 ? 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(0.25 * m0 + 6 * t0)) : 0.12 + 0.5 * clamp(1 - 3.5 * t0, 0, 1));
            ao = 1 + (0.55 + 0.45 * clamp(h0, 0, 1) - 1) * P.ao; sp = 0.5 + 0.5 * clamp(h0, 0, 1);
          } else {
            h0 = H(u, v); var r0 = H.r; hx = H(u + stx, v); hy = H(u, v + sty);
            var qx = tile ? u * base : u * (spec.zoom || 6), qy = tile ? v * base : v * (spec.zoom || 6), per = tile ? base : 1048576;
            var low = ma > 0 ? fbm(qx, qy, per, per, 3, 0.5, 201, seed) : 0;
            al = ramp(h0 + (P.cell[1] > 0 ? 0.1 * (r0 - 0.5) : 0));
            var mm = ma * sstep(-0.25, 0.5, low); al = [al[0] + (mott[0] - al[0]) * mm, al[1] + (mott[1] - al[1]) * mm, al[2] + (mott[2] - al[2]) * mm];
            ao = 1 + (0.5 + 0.5 * sstep(0.05, 0.75, h0) - 1) * P.ao; sp = 0.4 + 0.6 * h0;
          }
          var nx = -(hx - h0) * k, ny = -(hy - h0) * k, nl = 1 / Math.sqrt(nx * nx + ny * ny + 1); nx *= nl; ny *= nl;
          var ndl = clamp(nx * lx + ny * ly + nl * lz, 0, 1), ndh = clamp((nx * hx0 + ny * hy0 + nl * hz0) * hl, 0, 1);
          var s = Math.pow(ndh, P.shine) * P.spec * sp, dif = (0.42 + 0.95 * ndl) * ao, o = (yy * w + xx) * 4;
          data[o] = (al[0] * dif + s) * 255; data[o + 1] = (al[1] * dif + s * 0.96) * 255; data[o + 2] = (al[2] * dif + s * 0.88) * 255; data[o + 3] = 255;
        }
      }
      (function step() {
        var t0 = now();
        while (y < h && now() - t0 < 12) row(y++);
        if (y < h) setTimeout(step, 0); else resolve({data: data, width: w, height: h});
      })();
    });
  }

  /* ================= 7. TEXTURA FINALĂ ================= */
  function makeTexture(name, o) {
    o = o || {};
    var P = resolve(name, o.over), t0 = now(), w = o.w || o.size || 768, h = o.h || w;
    var spec = {w: w, h: h, seed: o.seed | 0, tile: o.tile !== false && !P.frac, zoom: o.zoom, band: o.band, maxOct: o.maxOct};
    var mode = o.mode || (P.frac ? 'opaque' : 'overlay'), backend = (!o.cpu && DOC && hasGL()) ? 'webgl2' : 'cpu';
    var ov = {A: (o.A != null ? o.A : 0.5) * P.A, hi: P.hi, lo: P.lo, chroma: P.chroma, k: o.k || 3, mode: mode, gamma: o.gamma, low: o.low != null ? o.low : P.low};
    function small() { var cw = Math.min(w, 288); return merge(spec, {w: cw, h: spec.tile ? cw : Math.min(h, Math.round(cw * h / w))}); }
    var run = backend === 'webgl2' ? glRender(P, spec).catch(function (e) { api.lastError = String(e && e.message || e); backend = 'cpu'; return cpuRender(P, small()); }) : cpuRender(P, small());
    return run.then(function (id) {
      overlayize(id, ov);
      var out = {w: id.width, h: id.height, backend: backend, ms: Math.round(now() - t0), preset: P.name, mode: mode};
      if (o.raw || !DOC) out.image = id; else out.url = toURL(id, mode === 'overlay');
      return out;
    });
  }

  /* ================= 8. SUPRAFEȚE: ce primește textura ================= */
  var SKIP = {SCRIPT: 1, STYLE: 1, LINK: 1, META: 1, CANVAS: 1, IMG: 1, VIDEO: 1, AUDIO: 1, IFRAME: 1, PICTURE: 1, SOURCE: 1, BR: 1, HR: 1, OPTION: 1, OPTGROUP: 1, TEMPLATE: 1,
    NOSCRIPT: 1, HEAD: 1, TITLE: 1, PROGRESS: 1, METER: 1, MAP: 1, AREA: 1, OBJECT: 1, EMBED: 1, DIALOG_: 1};
  var NOINPUT = /^(checkbox|radio|range|color|file|hidden|image)$/;
  var EXC_DEF = '.fff-dlg,.fff-dlg *,[class^="fff-"],[id^="fff-"],[data-fffx-skip],[data-fffx-skip] *';
  function alphaOf(s) {
    s = String(s || ''); if (s === 'transparent') return 0;
    var m = /rgba\(\s*[\d.]+[ ,]+[\d.]+[ ,]+[\d.]+\s*[,\/]\s*([\d.]+)(%?)\s*\)/.exec(s) || /\/\s*([\d.]+)(%?)\s*\)/.exec(s);
    if (m) return parseFloat(m[1]) / (m[2] ? 100 : 1);
    return 1;
  }
  function pageTarget() {
    var b = DOC.body, h = DOC.documentElement, cb = root.getComputedStyle(b), ch = root.getComputedStyle(h);
    if (cb.backgroundImage !== 'none' && ch.backgroundImage !== 'none') return null;
    if (alphaOf(cb.backgroundColor) >= 0.55 && cb.backgroundImage === 'none') return b;
    if (alphaOf(ch.backgroundColor) >= 0.55 && ch.backgroundImage === 'none') return h;
    return cb.backgroundImage === 'none' && ch.backgroundImage === 'none' ? h : null;
  }
  // Parcurge elementele (în felii), alege suprafețele mari cu fundal plin și fără imagine și le marchează cu data-fffx="p|c".
  function scan(rootEl, st, done) {
    var all = [rootEl].concat([].slice.call(rootEl.getElementsByTagName('*'), 0, 14000)), i = 0, cand = [], vw = root.innerWidth || 1024, exc = st.exc || EXC_DEF, inc = st.inc || '';
    function slice() {
      var t0 = now();
      while (i < all.length && now() - t0 < 10) {
        var el = all[i++];
        if (el === DOC.body || el === DOC.documentElement || el.nodeType !== 1 || el.namespaceURI !== 'http://www.w3.org/1999/xhtml' || SKIP[el.tagName] || el.hasAttribute('data-fffx')) continue;
        if (el.tagName === 'INPUT' && NOINPUT.test(el.type)) continue;
        var r = el.getBoundingClientRect(), area = r.width * r.height;
        if (area < (st.minArea || 3000) || r.height < 28) continue;
        var cs = root.getComputedStyle(el), force = inc && el.matches(inc);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.backgroundImage !== 'none' || parseFloat(cs.opacity) < 0.3) continue;
        if (!force && alphaOf(cs.backgroundColor) < 0.55) continue;
        if (el.matches(exc)) continue;
        if (cs.position === 'fixed' && r.width >= vw * 0.95 && r.height >= (root.innerHeight || 700) * 0.9) continue;
        cand.push({el: el, area: area, big: area >= 30000 || (r.width >= vw * 0.5 && r.height >= 64)});
      }
      if (i < all.length) return setTimeout(slice, 0);
      cand.sort(function (a, b) { return b.area - a.area; });
      var n = 0, room = Math.max(0, (st.max || 220) - st.count);
      cand.slice(0, room).forEach(function (c) { c.el.setAttribute('data-fffx', c.big ? 'p' : 'c'); n++; });
      st.count += n; done(n);
    }
    slice();
  }
  function cssText(t) {
    var s = '', c = '!important;background-repeat:repeat!important;background-position:0 0';
    if (t.page) s += '[data-fffx="g"]{background-image:url("' + t.page.url + '")' + c + '!important;background-size:' + t.pageCss + 'px ' + t.pageCss + 'px!important}';
    if (t.panel) s += '[data-fffx="p"],[data-fffx="c"]{background-image:url("' + t.panel.url + '")' + c + '!important}[data-fffx="p"]{background-size:' + t.panelCss + 'px ' + t.panelCss + 'px!important}[data-fffx="c"]{background-size:' + Math.round(t.panelCss * 0.55) + 'px ' + Math.round(t.panelCss * 0.55) + 'px!important}';
    if (t.hero) s += '[data-fffx="h"]{background-image:url("' + t.hero.url + '")!important;background-size:cover!important;background-position:center!important;background-repeat:no-repeat!important}';
    return s + '@media print,(forced-colors:active),(prefers-contrast:more){[data-fffx]{background-image:none!important}}';
  }
  var sheet = null, styleEl = null;
  function removeCSS() {
    if (sheet) { DOC.adoptedStyleSheets = DOC.adoptedStyleSheets.filter(function (x) { return x !== sheet; }); sheet = null; }
    if (styleEl && styleEl.parentNode) styleEl.parentNode.removeChild(styleEl); styleEl = null;
  }
  function installCSS(text) {
    removeCSS();
    try {
      if (root.CSSStyleSheet && DOC.adoptedStyleSheets !== undefined && root.CSSStyleSheet.prototype.replaceSync) {
        sheet = new root.CSSStyleSheet(); sheet.replaceSync(text); DOC.adoptedStyleSheets = DOC.adoptedStyleSheets.concat([sheet]); return;
      }
    } catch (e) { sheet = null; }
    styleEl = DOC.createElement('style'); styleEl.id = 'fff-texturi-css'; styleEl.textContent = text; (DOC.head || DOC.documentElement).appendChild(styleEl);
  }

  /* ================= 9. CONFIGURARE, PORNIRE, INTERFAȚĂ ================= */
  var CFG = {m: 'parchment', p: '', a: 1, seed: 7, size: 0, hero: null, inc: '', exc: '', max: 220, minArea: 3000, over: null, pover: null, low: null};
  var S = {on: false, started: false, booted: false, tex: null, st: null, obs: null, timer: 0, info: null, force: false};
  function lang() { try { var l = (root.FFF && root.FFF.lang && root.FFF.lang()) || DOC.documentElement.lang || 'en'; l = String(l).slice(0, 2).toLowerCase(); return TXT[l] ? l : 'en'; } catch (e) { return 'en'; } }
  function TT(k) { return (TXT[lang()] || TXT.en)[k]; }
  function mq(q) { try { return !!(root.matchMedia && root.matchMedia(q).matches); } catch (e) { return false; } }
  function metaOff() { var m = DOC.querySelector('meta[name="fff-texturi"]'); return !!m && /^(off|0|false)$/i.test(m.getAttribute('content') || ''); }
  function pref() {
    try { var F = root.FFF; if (F && F.store && F.store.get) return F.store.get('texturi', null); } catch (e) { /* inert */ }
    try { return root.localStorage.getItem('fff.texturi'); } catch (e2) { return null; }
  }
  function allowed(ignorePref) {
    var q = root.location ? root.location.search : '';
    S.force = /[?&]fffx=1\b/.test(q) || !!root.FFF_TEXTURI_FORCE;
    if (/[?&](notex|kiosk|embed)=(1|true)\b/.test(q) || metaOff()) return false;
    if (mq('print') || mq('(forced-colors: active)') || mq('(prefers-contrast: more)') || mq('(prefers-reduced-transparency: reduce)') || mq('(prefers-reduced-data: reduce)')) return false;
    try { if (root.navigator.connection && root.navigator.connection.saveData) return false; } catch (e) { /* inert */ }
    if (!S.force) { if (root.navigator && root.navigator.webdriver) return false; try { if (root.top !== root.self) return false; } catch (e3) { return false; } }
    if (!ignorePref) { var p = pref(); if (p === 'off' || p === '0' || p === false) return false; }
    return true;
  }
  function pickSize() {
    var n = root.navigator || {}, mem = n.deviceMemory || 4, cores = n.hardwareConcurrency || 4, dpr = Math.min(root.devicePixelRatio || 1, 2);
    var size = CFG.size || root.FFF_TEXTURI_SIZE || (mem <= 2 || cores <= 2 ? 512 : (dpr >= 2 && mem >= 4 ? 1024 : 768));
    return {size: size, css: Math.round(size / Math.max(1.5, dpr))};
  }
  function recount() { S.st.count = DOC.querySelectorAll('[data-fffx]').length; }
  function watch() {
    if (S.obs || !root.MutationObserver || !DOC.body) return;
    var pend = [];
    S.obs = new root.MutationObserver(function (ms) {
      ms.forEach(function (m) { [].forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1 && !n.hasAttribute('data-fffx')) pend.push(n); }); });
      if (!pend.length || S.timer) return;
      S.timer = setTimeout(function () {
        S.timer = 0; var roots = pend.splice(0, 40); recount();
        (function next() { var r = roots.shift(); if (!r || !S.on) return; if (!DOC.contains(r)) return next(); scan(r, S.st, next); })();
      }, 400);
    });
    S.obs.observe(DOC.body, {childList: true, subtree: true});
  }
  function start() {
    if (S.started) return Promise.resolve(S.info);
    S.started = true; S.on = true;
    var sz = pickSize(), t0 = now(), A = CFG.a, out = {};
    S.st = {count: 0, max: CFG.max, minArea: CFG.minArea, inc: CFG.inc, exc: CFG.exc ? EXC_DEF + ',' + CFG.exc : EXC_DEF};
    return makeTexture(CFG.m, {size: sz.size, seed: CFG.seed, A: 0.3 * A, over: CFG.over, low: CFG.low}).then(function (r) {
      out.panel = r;
      return makeTexture(CFG.p || CFG.m, {size: sz.size, seed: CFG.seed + 11, A: 0.34 * A, over: CFG.p ? CFG.pover : CFG.over, low: CFG.low});
    }).then(function (r) {
      out.page = r; var h = CFG.hero;
      if (!h) return null;
      return makeTexture(h.m || 'julia', {w: h.w || 1280, h: h.h || 720, tile: false, seed: CFG.seed + 23, A: h.A != null ? h.A : 0.9, mode: h.mode, over: h.over});
    }).then(function (r) {
      if (r) out.hero = r;
      if (!S.on) return null;
      out.panelCss = sz.css; out.pageCss = Math.round(sz.css * 1.25); S.tex = out;
      installCSS(cssText(out)); DOC.documentElement.setAttribute('data-fffx-on', '');
      var pt = pageTarget(); if (pt) pt.setAttribute('data-fffx', 'g');
      if (out.hero && CFG.hero.sel) [].forEach.call(DOC.querySelectorAll(CFG.hero.sel), function (el) { if (root.getComputedStyle(el).backgroundImage === 'none') el.setAttribute('data-fffx', 'h'); });
      return new Promise(function (ok) {
        scan(DOC.body, S.st, function (n) {
          watch();
          S.info = {on: true, backend: out.panel.backend, preset: out.panel.preset, size: sz.size, ms: Math.round(now() - t0), surfaces: n, page: pt ? pt.tagName.toLowerCase() : '', hero: !!out.hero};
          try { if (root.FFF && root.FFF.bus) root.FFF.bus.emit('texturi:ready', S.info); } catch (e) { /* inert */ }
          ok(S.info);
        });
      });
    }).catch(function (e) { S.info = {on: false, error: String(e && e.message || e)}; return S.info; });
  }
  function dialogRow() {
    var d = DOC.querySelector('dialog.fff-dlg .fff-in');
    if (!d || d.querySelector('[data-fffx-ui]')) return;
    var sec = DOC.createElement('section'), h3 = DOC.createElement('h3'), lab = DOC.createElement('label'), cb = DOC.createElement('input'), tx = DOC.createElement('span'), p = DOC.createElement('p');
    sec.className = 'fff-sec'; sec.setAttribute('data-fffx-ui', ''); sec.setAttribute('aria-labelledby', 'fffx-h'); h3.id = 'fffx-h'; h3.textContent = TT('h');
    lab.style.cssText = 'display:flex;gap:.6em;align-items:flex-start;cursor:pointer;min-height:24px';
    cb.type = 'checkbox'; cb.id = 'fffx-cb'; cb.checked = S.on; cb.setAttribute('aria-describedby', 'fffx-t'); tx.textContent = TT('l');
    p.id = 'fffx-t'; p.className = 'fff-mut fff-sm'; p.textContent = TT('t');
    cb.addEventListener('change', function () { api.set(cb.checked); });
    lab.appendChild(cb); lab.appendChild(tx); sec.appendChild(h3); sec.appendChild(lab); sec.appendChild(p); d.appendChild(sec);
  }
  function boot() {
    if (S.booted || !DOC) return; S.booted = true;
    var go = function () {
      if (!allowed(false)) return;
      var ric = root.requestIdleCallback || function (f) { return setTimeout(f, 80); };
      ric(function () { start(); }, {timeout: 2000});
    };
    if (DOC.readyState === 'complete') go(); else root.addEventListener('load', go, {once: true});
    try { if (root.FFF && root.FFF.bus && root.FFF.bus.on) root.FFF.bus.on('label:open', function () { if (allowed(true)) setTimeout(dialogRow, 0); }); } catch (e) { /* inert */ }
  }
  var api = {
    version: VERSION,
    materials: function () { return Object.keys(PRESETS); },
    presets: PRESETS, resolve: resolve, _makeH: makeH, makeTexture: makeTexture, cpuRender: cpuRender, overlayize: overlayize, hasGL: function () { return !!DOC && hasGL(); },
    configure: function (c) { if (c) for (var k in c) if (k in CFG && c[k] !== undefined) CFG[k] = c[k]; return CFG; },
    start: start, info: function () { return S.info; }, get: function () { return S.on; },
    set: function (on) {
      on = !!on;
      try { var F = root.FFF; if (F && F.store && F.store.set) F.store.set('texturi', on ? 'on' : 'off'); else root.localStorage.setItem('fff.texturi', on ? 'on' : 'off'); } catch (e) { /* inert */ }
      if (on) { S.on = true; if (!S.started) start(); else if (S.tex) { installCSS(cssText(S.tex)); DOC.documentElement.setAttribute('data-fffx-on', ''); watch(); } }
      else { S.on = false; removeCSS(); DOC.documentElement.removeAttribute('data-fffx-on'); if (S.obs) { S.obs.disconnect(); S.obs = null; } }
      return S.on;
    },
    _boot: boot
  };
  return api;
});
