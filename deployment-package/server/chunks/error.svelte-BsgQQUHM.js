import { p as push, l as escape_html, j as pop, k as getContext } from './index3-0vHBXF6s.js';
import 'clsx';
import './state.svelte-Cinh-8k8.js';
import './utils-Bg2Rux6K.js';
import { w as writable } from './index2-BbWlCfnE.js';
import './false-B2gHlHjM.js';

function create_updated_store() {
  const { set, subscribe } = writable(false);
  {
    return {
      subscribe,
      // eslint-disable-next-line @typescript-eslint/require-await
      check: async () => false
    };
  }
}
const stores = {
  updated: /* @__PURE__ */ create_updated_store()
};
({
  check: stores.updated.check
});
function context() {
  return getContext("__request__");
}
const page$1 = {
  get error() {
    return context().page.error;
  },
  get status() {
    return context().page.status;
  }
};
const page = page$1;
function Error$1($$payload, $$props) {
  push();
  $$payload.out.push(`<h1>${escape_html(page.status)}</h1> <p>${escape_html(page.error?.message)}</p>`);
  pop();
}

export { Error$1 as default };
//# sourceMappingURL=error.svelte-BsgQQUHM.js.map
