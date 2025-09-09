import { p as push, f as store_get, B as copy_payload, C as assign_payload, u as unsubscribe_stores, j as pop, m as head } from './index3-0vHBXF6s.js';
import { p as page } from './stores-BavBgoWQ.js';
import './badge-DNI7Aq68.js';
import 'clsx';
import './false-B2gHlHjM.js';
import './utils-Bg2Rux6K.js';
import './state.svelte-Cinh-8k8.js';
import 'tailwind-merge';

function _page($$payload, $$props) {
  push();
  var $$store_subs;
  store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("error") || store_get($$store_subs ??= {}, "$page", page).url.searchParams.get("reason");
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Login - Client Portal</title>`;
      $$payload3.out.push(`<meta name="description" content="Login to your Client Portal"/>`);
    });
    {
      $$payload2.out.push("<!--[!-->");
    }
    $$payload2.out.push(`<!--]-->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  if ($$store_subs) unsubscribe_stores($$store_subs);
  pop();
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DcN-a2Hr.js.map
