import { p as push, f as store_get, g as slot, u as unsubscribe_stores, h as bind_props, j as pop } from './index3-0vHBXF6s.js';
import { p as page } from './stores-BavBgoWQ.js';
import './utils-Bg2Rux6K.js';
import 'clsx';
import './state.svelte-Cinh-8k8.js';
import './badge-DNI7Aq68.js';
import './false-B2gHlHjM.js';
import 'tailwind-merge';

function _layout($$payload, $$props) {
  push();
  var $$store_subs;
  let currentPath;
  let data = $$props["data"];
  data.user;
  currentPath = store_get($$store_subs ??= {}, "$page", page).url.pathname;
  currentPath.startsWith("/client-portal");
  $$payload.out.push(`<div class="min-h-screen bg-gradient-to-br from-black via-slate-900 to-black"><div class="absolute inset-0 opacity-30"><div class="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-slate-800/20 to-purple-800/20"></div> <div class="absolute inset-0" style="background-image: radial-gradient(circle at 25% 25%, rgba(30, 58, 138, 0.1) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(15, 23, 42, 0.1) 0%, transparent 50%);"></div></div> `);
  {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<main class="min-h-screen flex items-center justify-center p-4"><!---->`);
    slot($$payload, $$props, "default", {}, null);
    $$payload.out.push(`<!----></main>`);
  }
  $$payload.out.push(`<!--]--></div> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]-->`);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  bind_props($$props, { data });
  pop();
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-D7V0lWVN.js.map
