import{ak as m,al as u,am as h,ai as d,g,s as w,c as p,f as E,a as y}from"./3zx2OM-S.js";import{i as o,b as N}from"./BQu96azb.js";import"./DsnmJJEf.js";import"./DX-Oc8op.js";import{I as x,s as D}from"./BID1lDIu.js";import{l as T,s as v}from"./Dwjkgfq3.js";class L{#e;#t;constructor(t){this.#e=t,this.#t=Symbol(t)}get key(){return this.#t}exists(){return m(this.#t)}get(){const t=u(this.#t);if(t===void 0)throw new Error(`Context "${this.#e}" not found`);return t}getOr(t){const r=u(this.#t);return r===void 0?t:r}set(t){return h(this.#t,t)}}const _=1,$=9,C=11;function s(e){return o(e)&&e.nodeType===_&&typeof e.nodeName=="string"}function c(e){return o(e)&&e.nodeType===$}function A(e){return o(e)&&e.constructor?.name==="VisualViewport"}function O(e){return o(e)&&e.nodeType!==void 0}function a(e){return O(e)&&e.nodeType===C&&"host"in e}function U(e,t){if(!e||!t||!s(e)||!s(t))return!1;const r=t.getRootNode?.();if(e===t||e.contains(t))return!0;if(r&&a(r)){let n=t;for(;n;){if(e===n)return!0;n=n.parentNode||n.host}}return!1}function S(e){return c(e)?e:A(e)?e.document:e?.ownerDocument??document}function M(e){return a(e)?M(e.host):c(e)?e.defaultView??window:s(e)?e.ownerDocument?.defaultView??window:window}function R(e){let t=e.activeElement;for(;t?.shadowRoot;){const r=t.shadowRoot.activeElement;if(r===t)break;t=r}return t}class j{element;#e=d(()=>this.element.current?this.element.current.getRootNode()??document:document);get root(){return g(this.#e)}set root(t){w(this.#e,t)}constructor(t){typeof t=="function"?this.element=N.with(t):this.element=t}getDocument=()=>S(this.root);getWindow=()=>this.getDocument().defaultView??window;getActiveElement=()=>R(this.root);isActiveElement=t=>t===this.getActiveElement();getElementById(t){return this.root.getElementById(t)}querySelector=t=>this.root?this.root.querySelector(t):null;querySelectorAll=t=>this.root?this.root.querySelectorAll(t):[];setTimeout=(t,r)=>this.getWindow().setTimeout(t,r);clearTimeout=t=>this.getWindow().clearTimeout(t)}function z(e,t){const r=T(t,["children","$$slots","$$events","$$legacy"]);/**
 * @license lucide-svelte v0.539.0 - ISC
 *
 * ISC License
 *
 * Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 */const n=[["path",{d:"M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"}],["circle",{cx:"12",cy:"12",r:"3"}]];x(e,v({name:"settings"},()=>r,{get iconNode(){return n},children:(l,b)=>{var i=p(),f=E(i);D(f,t,"default",{},null),y(l,i)},$$slots:{default:!0}}))}export{L as C,j as D,z as S,U as c,M as g};
