import { p as push, r as spread_attributes, t as clsx, h as bind_props, j as pop, A as element } from './index3-0vHBXF6s.js';
import { twMerge, extendTailwindMerge } from 'tailwind-merge';
import { clsx as clsx$1 } from 'clsx';

var l=e=>typeof e=="boolean"?`${e}`:e===0?"0":e,u=e=>!e||typeof e!="object"||Object.keys(e).length===0,x$1=(e,o)=>JSON.stringify(e)===JSON.stringify(o);function i(e,o){e.forEach(function(r){Array.isArray(r)?i(r,o):o.push(r);});}function y(e){let o=[];return i(e,o),o}var a=(...e)=>y(e).filter(Boolean),p=(e,o)=>{let r={},c=Object.keys(e),f=Object.keys(o);for(let t of c)if(f.includes(t)){let s=e[t],n=o[t];Array.isArray(s)||Array.isArray(n)?r[t]=a(n,s):typeof s=="object"&&typeof n=="object"?r[t]=p(s,n):r[t]=n+" "+s;}else r[t]=e[t];for(let t of f)c.includes(t)||(r[t]=o[t]);return r},g=e=>!e||typeof e!="string"?e:e.replace(/\s+/g," ").trim();

var ie={twMerge:true,twMergeConfig:{},responsiveVariants:false},x=s=>s||void 0,N=(...s)=>x(y(s).filter(Boolean).join(" ")),R=null,v={},q=false,M=(...s)=>b$1=>b$1.twMerge?((!R||q)&&(q=false,R=u(v)?twMerge:extendTailwindMerge({...v,extend:{theme:v.theme,classGroups:v.classGroups,conflictingClassGroupModifiers:v.conflictingClassGroupModifiers,conflictingClassGroups:v.conflictingClassGroups,...v.extend}})),x(R(N(s)))):N(s),_=(s,b)=>{for(let e in b)s.hasOwnProperty(e)?s[e]=N(s[e],b[e]):s[e]=b[e];return s},ce=(s,b$1)=>{let{extend:e=null,slots:O={},variants:U={},compoundVariants:W=[],compoundSlots:C=[],defaultVariants:z={}}=s,m={...ie,...b$1},k=e!=null&&e.base?N(e.base,s==null?void 0:s.base):s==null?void 0:s.base,g$1=e!=null&&e.variants&&!u(e.variants)?p(U,e.variants):U,w=e!=null&&e.defaultVariants&&!u(e.defaultVariants)?{...e.defaultVariants,...z}:z;!u(m.twMergeConfig)&&!x$1(m.twMergeConfig,v)&&(q=true,v=m.twMergeConfig);let S=u(e==null?void 0:e.slots),T=u(O)?{}:{base:N(s==null?void 0:s.base,S&&(e==null?void 0:e.base)),...O},j=S?T:_({...e==null?void 0:e.slots},u(T)?{base:s==null?void 0:s.base}:T),h$1=u(e==null?void 0:e.compoundVariants)?W:a(e==null?void 0:e.compoundVariants,W),V=l$1=>{if(u(g$1)&&u(O)&&S)return M(k,l$1==null?void 0:l$1.class,l$1==null?void 0:l$1.className)(m);if(h$1&&!Array.isArray(h$1))throw new TypeError(`The "compoundVariants" prop must be an array. Received: ${typeof h$1}`);if(C&&!Array.isArray(C))throw new TypeError(`The "compoundSlots" prop must be an array. Received: ${typeof C}`);let P=(a,n,t=[],i)=>{let r=t;if(typeof n=="string")r=r.concat(g(n).split(" ").map(o=>`${a}:${o}`));else if(Array.isArray(n))r=r.concat(n.reduce((o,c)=>o.concat(`${a}:${c}`),[]));else if(typeof n=="object"&&typeof i=="string"){for(let o in n)if(n.hasOwnProperty(o)&&o===i){let c=n[o];if(c&&typeof c=="string"){let u=g(c);r[i]?r[i]=r[i].concat(u.split(" ").map(f=>`${a}:${f}`)):r[i]=u.split(" ").map(f=>`${a}:${f}`);}else Array.isArray(c)&&c.length>0&&(r[i]=c.reduce((u,f)=>u.concat(`${a}:${f}`),[]));}}return r},D=(a$1,n=g$1,t=null,i=null)=>{var L;let r=n[a$1];if(!r||u(r))return null;let o=(L=i==null?void 0:i[a$1])!=null?L:l$1==null?void 0:l$1[a$1];if(o===null)return null;let c=l(o),u$1=Array.isArray(m.responsiveVariants)&&m.responsiveVariants.length>0||m.responsiveVariants===true,f=w==null?void 0:w[a$1],d=[];if(typeof c=="object"&&u$1)for(let[E,Q]of Object.entries(c)){let ne=r[Q];if(E==="initial"){f=Q;continue}Array.isArray(m.responsiveVariants)&&!m.responsiveVariants.includes(E)||(d=P(E,ne,d,t));}let $=c!=null&&typeof c!="object"?c:l(f),A=r[$||"false"];return typeof d=="object"&&typeof t=="string"&&d[t]?_(d,A):d.length>0?(d.push(A),t==="base"?d.join(" "):d):A},p=()=>g$1?Object.keys(g$1).map(a=>D(a,g$1)):null,ee=(a,n)=>{if(!g$1||typeof g$1!="object")return null;let t=new Array;for(let i in g$1){let r=D(i,g$1,a,n),o=a==="base"&&typeof r=="string"?r:r&&r[a];o&&(t[t.length]=o);}return t},H={};for(let a in l$1)l$1[a]!==void 0&&(H[a]=l$1[a]);let I=(a,n)=>{var i;let t=typeof(l$1==null?void 0:l$1[a])=="object"?{[a]:(i=l$1[a])==null?void 0:i.initial}:{};return {...w,...H,...t,...n}},J=(a=[],n)=>{let t=[];for(let{class:i,className:r,...o}of a){let c=true;for(let[u,f]of Object.entries(o)){let d=I(u,n)[u];if(Array.isArray(f)){if(!f.includes(d)){c=false;break}}else {let $=A=>A==null||A===false;if($(f)&&$(d))continue;if(d!==f){c=false;break}}}c&&(i&&t.push(i),r&&t.push(r));}return t},te=a=>{let n=J(h$1,a);if(!Array.isArray(n))return n;let t={};for(let i of n)if(typeof i=="string"&&(t.base=M(t.base,i)(m)),typeof i=="object")for(let[r,o]of Object.entries(i))t[r]=M(t[r],o)(m);return t},ae=a=>{if(C.length<1)return null;let n={};for(let{slots:t=[],class:i,className:r,...o}of C){if(!u(o)){let c=true;for(let u of Object.keys(o)){let f=I(u,a)[u];if(f===void 0||(Array.isArray(o[u])?!o[u].includes(f):o[u]!==f)){c=false;break}}if(!c)continue}for(let c of t)n[c]=n[c]||[],n[c].push([i,r]);}return n};if(!u(O)||!S){let a={};if(typeof j=="object"&&!u(j))for(let n of Object.keys(j))a[n]=t=>{var i,r;return M(j[n],ee(n,t),((i=te(t))!=null?i:[])[n],((r=ae(t))!=null?r:[])[n],t==null?void 0:t.class,t==null?void 0:t.className)(m)};return a}return M(k,p(),J(h$1),l$1==null?void 0:l$1.class,l$1==null?void 0:l$1.className)(m)},K=()=>{if(!(!g$1||typeof g$1!="object"))return Object.keys(g$1)};return V.variantKeys=K(),V.extend=e,V.base=k,V.slots=j,V.variants=g$1,V.defaultVariants=w,V.compoundSlots=C,V.compoundVariants=h$1,V};

function cn(...inputs) {
  return twMerge(clsx$1(inputs));
}
const buttonVariants = ce({
  base: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium outline-none transition-all focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
      destructive: "bg-destructive shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 text-white",
      outline: "bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 border",
      secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
      ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
      link: "text-primary underline-offset-4 hover:underline"
    },
    size: {
      default: "h-9 px-4 py-2 has-[>svg]:px-3",
      sm: "h-8 gap-1.5 rounded-md px-3 has-[>svg]:px-2.5",
      lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
      icon: "size-9"
    }
  },
  defaultVariants: { variant: "default", size: "default" }
});
function Button($$payload, $$props) {
  push();
  let {
    class: className,
    variant = "default",
    size = "default",
    ref = null,
    href = void 0,
    type = "button",
    disabled,
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  if (href) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<a${spread_attributes(
      {
        "data-slot": "button",
        class: clsx(cn(buttonVariants({ variant, size }), className)),
        href: disabled ? void 0 : href,
        "aria-disabled": disabled,
        role: disabled ? "link" : void 0,
        tabindex: disabled ? -1 : void 0,
        ...restProps
      },
      null
    )}>`);
    children?.($$payload);
    $$payload.out.push(`<!----></a>`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<button${spread_attributes(
      {
        "data-slot": "button",
        class: clsx(cn(buttonVariants({ variant, size }), className)),
        type,
        disabled,
        ...restProps
      },
      null
    )}>`);
    children?.($$payload);
    $$payload.out.push(`<!----></button>`);
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, { ref });
  pop();
}
const badgeVariants = ce({
  base: "focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3",
  variants: {
    variant: {
      default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90 border-transparent",
      secondary: "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90 border-transparent",
      destructive: "bg-destructive [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/70 border-transparent text-white",
      outline: "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground"
    }
  },
  defaultVariants: { variant: "default" }
});
function Badge($$payload, $$props) {
  push();
  let {
    ref = null,
    href,
    class: className,
    variant = "default",
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  element(
    $$payload,
    href ? "a" : "span",
    () => {
      $$payload.out.push(`${spread_attributes(
        {
          "data-slot": "badge",
          href,
          class: clsx(cn(badgeVariants({ variant }), className)),
          ...restProps
        },
        null
      )}`);
    },
    () => {
      children?.($$payload);
      $$payload.out.push(`<!---->`);
    }
  );
  bind_props($$props, { ref });
  pop();
}

export { Button as B, Badge as a, cn as c };
//# sourceMappingURL=badge-DNI7Aq68.js.map
