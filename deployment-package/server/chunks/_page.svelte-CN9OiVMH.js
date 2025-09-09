import { p as push, m as head, H as attr, j as pop, B as copy_payload, C as assign_payload, h as bind_props, x as spread_props, I as props_id, r as spread_attributes, J as derived, D as stringify, l as escape_html, o as ensure_array_like, v as sanitize_props, g as slot, t as clsx } from './index3-0vHBXF6s.js';
import { o as onDestroy, c as createId, b as box, m as mergeProps, a as attachRef, d as createBitsAttrs, g as getDataOrientation, e as getAriaHidden, f as getAriaOrientation } from './create-id-CetFcqcd.js';
import { C as Card, c as Card_content, a as Card_header, b as Card_title } from './card-title-DJOK6gsy.js';
import { B as Button, c as cn, a as Badge } from './badge-DNI7Aq68.js';
import 'clsx';
import { R as Refresh_cw } from './refresh-cw-DoOr0aUw.js';
import { I as Icon } from './Icon-DxK3y_oV.js';
import { T as Triangle_alert } from './triangle-alert-Bwcqo1ck.js';
import { A as Activity } from './activity-4rxLUk7e.js';
import './false-B2gHlHjM.js';
import 'tailwind-merge';

const separatorAttrs = createBitsAttrs({ component: "separator", parts: ["root"] });
class SeparatorRootState {
  static create(opts) {
    return new SeparatorRootState(opts);
  }
  opts;
  attachment;
  constructor(opts) {
    this.opts = opts;
    this.attachment = attachRef(opts.ref);
  }
  #props = derived(() => ({
    id: this.opts.id.current,
    role: this.opts.decorative.current ? "none" : "separator",
    "aria-orientation": getAriaOrientation(this.opts.orientation.current),
    "aria-hidden": getAriaHidden(this.opts.decorative.current),
    "data-orientation": getDataOrientation(this.opts.orientation.current),
    [separatorAttrs.root]: "",
    ...this.attachment
  }));
  get props() {
    return this.#props();
  }
  set props($$value) {
    return this.#props($$value);
  }
}
function Separator$1($$payload, $$props) {
  push();
  const uid = props_id($$payload);
  let {
    id = createId(uid),
    ref = null,
    child,
    children,
    decorative = false,
    orientation = "horizontal",
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  const rootState = SeparatorRootState.create({
    ref: box.with(() => ref, (v) => ref = v),
    id: box.with(() => id),
    decorative: box.with(() => decorative),
    orientation: box.with(() => orientation)
  });
  const mergedProps = mergeProps(restProps, rootState.props);
  if (child) {
    $$payload.out.push("<!--[-->");
    child($$payload, { props: mergedProps });
    $$payload.out.push(`<!---->`);
  } else {
    $$payload.out.push("<!--[!-->");
    $$payload.out.push(`<div${spread_attributes({ ...mergedProps }, null)}>`);
    children?.($$payload);
    $$payload.out.push(`<!----></div>`);
  }
  $$payload.out.push(`<!--]-->`);
  bind_props($$props, { ref });
  pop();
}
function Circle_check($$payload, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
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
   */
  const iconNode = [
    ["circle", { "cx": "12", "cy": "12", "r": "10" }],
    ["path", { "d": "m9 12 2 2 4-4" }]
  ];
  Icon($$payload, spread_props([
    { name: "circle-check" },
    $$sanitized_props,
    {
      /**
       * @component @name CircleCheck
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgLz4KICA8cGF0aCBkPSJtOSAxMiAyIDIgNC00IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/circle-check
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$payload2) => {
        $$payload2.out.push(`<!---->`);
        slot($$payload2, $$props, "default", {}, null);
        $$payload2.out.push(`<!---->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Clock($$payload, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
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
   */
  const iconNode = [
    ["path", { "d": "M12 6v6l4 2" }],
    ["circle", { "cx": "12", "cy": "12", "r": "10" }]
  ];
  Icon($$payload, spread_props([
    { name: "clock" },
    $$sanitized_props,
    {
      /**
       * @component @name Clock
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTIgNnY2bDQgMiIgLz4KICA8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSIxMCIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/clock
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$payload2) => {
        $$payload2.out.push(`<!---->`);
        slot($$payload2, $$props, "default", {}, null);
        $$payload2.out.push(`<!---->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Database($$payload, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
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
   */
  const iconNode = [
    ["ellipse", { "cx": "12", "cy": "5", "rx": "9", "ry": "3" }],
    ["path", { "d": "M3 5V19A9 3 0 0 0 21 19V5" }],
    ["path", { "d": "M3 12A9 3 0 0 0 21 12" }]
  ];
  Icon($$payload, spread_props([
    { name: "database" },
    $$sanitized_props,
    {
      /**
       * @component @name Database
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8ZWxsaXBzZSBjeD0iMTIiIGN5PSI1IiByeD0iOSIgcnk9IjMiIC8+CiAgPHBhdGggZD0iTTMgNVYxOUE5IDMgMCAwIDAgMjEgMTlWNSIgLz4KICA8cGF0aCBkPSJNMyAxMkE5IDMgMCAwIDAgMjEgMTIiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/database
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$payload2) => {
        $$payload2.out.push(`<!---->`);
        slot($$payload2, $$props, "default", {}, null);
        $$payload2.out.push(`<!---->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Server($$payload, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
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
   */
  const iconNode = [
    [
      "rect",
      {
        "width": "20",
        "height": "8",
        "x": "2",
        "y": "2",
        "rx": "2",
        "ry": "2"
      }
    ],
    [
      "rect",
      {
        "width": "20",
        "height": "8",
        "x": "2",
        "y": "14",
        "rx": "2",
        "ry": "2"
      }
    ],
    ["line", { "x1": "6", "x2": "6.01", "y1": "6", "y2": "6" }],
    ["line", { "x1": "6", "x2": "6.01", "y1": "18", "y2": "18" }]
  ];
  Icon($$payload, spread_props([
    { name: "server" },
    $$sanitized_props,
    {
      /**
       * @component @name Server
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cmVjdCB3aWR0aD0iMjAiIGhlaWdodD0iOCIgeD0iMiIgeT0iMiIgcng9IjIiIHJ5PSIyIiAvPgogIDxyZWN0IHdpZHRoPSIyMCIgaGVpZ2h0PSI4IiB4PSIyIiB5PSIxNCIgcng9IjIiIHJ5PSIyIiAvPgogIDxsaW5lIHgxPSI2IiB4Mj0iNi4wMSIgeTE9IjYiIHkyPSI2IiAvPgogIDxsaW5lIHgxPSI2IiB4Mj0iNi4wMSIgeTE9IjE4IiB5Mj0iMTgiIC8+Cjwvc3ZnPgo=) - https://lucide.dev/icons/server
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$payload2) => {
        $$payload2.out.push(`<!---->`);
        slot($$payload2, $$props, "default", {}, null);
        $$payload2.out.push(`<!---->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Zap($$payload, $$props) {
  const $$sanitized_props = sanitize_props($$props);
  /**
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
   */
  const iconNode = [
    [
      "path",
      {
        "d": "M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
      }
    ]
  ];
  Icon($$payload, spread_props([
    { name: "zap" },
    $$sanitized_props,
    {
      /**
       * @component @name Zap
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNNCAxNGExIDEgMCAwIDEtLjc4LTEuNjNsOS45LTEwLjJhLjUuNSAwIDAgMSAuODYuNDZsLTEuOTIgNi4wMkExIDEgMCAwIDAgMTMgMTBoN2ExIDEgMCAwIDEgLjc4IDEuNjNsLTkuOSAxMC4yYS41LjUgMCAwIDEtLjg2LS40NmwxLjkyLTYuMDJBMSAxIDAgMCAwIDExIDE0eiIgLz4KPC9zdmc+Cg==) - https://lucide.dev/icons/zap
       * @see https://lucide.dev/guide/packages/lucide-svelte - Documentation
       *
       * @param {Object} props - Lucide icons props and any valid SVG attribute
       * @returns {FunctionalComponent} Svelte component
       *
       */
      iconNode,
      children: ($$payload2) => {
        $$payload2.out.push(`<!---->`);
        slot($$payload2, $$props, "default", {}, null);
        $$payload2.out.push(`<!---->`);
      },
      $$slots: { default: true }
    }
  ]));
}
function Card_description($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    children,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  $$payload.out.push(`<p${spread_attributes(
    {
      "data-slot": "card-description",
      class: clsx(cn("text-muted-foreground text-sm", className)),
      ...restProps
    },
    null
  )}>`);
  children?.($$payload);
  $$payload.out.push(`<!----></p>`);
  bind_props($$props, { ref });
  pop();
}
function Separator($$payload, $$props) {
  push();
  let {
    ref = null,
    class: className,
    $$slots,
    $$events,
    ...restProps
  } = $$props;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    $$payload2.out.push(`<!---->`);
    Separator$1($$payload2, spread_props([
      {
        "data-slot": "separator",
        class: cn("bg-border shrink-0 data-[orientation=horizontal]:h-px data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px", className)
      },
      restProps,
      {
        get ref() {
          return ref;
        },
        set ref($$value) {
          ref = $$value;
          $$settled = false;
        }
      }
    ]));
    $$payload2.out.push(`<!---->`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { ref });
  pop();
}
function _page($$payload, $$props) {
  push();
  let healthStatus = null;
  let activeAlerts = null;
  let lastUpdated = "";
  let autoRefresh = true;
  let refreshInterval;
  let loading = true;
  let error = "";
  async function fetchHealthStatus() {
    try {
      const response = await fetch("/api/health?details=true&cache=false");
      if (response.ok) {
        healthStatus = await response.json();
        error = "";
      } else {
        error = `Health check failed: ${response.status}`;
        healthStatus = null;
      }
    } catch (e) {
      error = `Network error: ${e instanceof Error ? e.message : "Unknown error"}`;
      healthStatus = null;
    }
  }
  async function fetchAlerts() {
    try {
      const response = await fetch("/api/alerts?action=active");
      if (response.ok) {
        activeAlerts = await response.json();
      } else if (response.status !== 403) {
        console.warn("Failed to fetch alerts:", response.status);
      }
    } catch (e) {
      console.warn("Failed to fetch alerts:", e);
    }
  }
  async function refreshData() {
    loading = true;
    await Promise.all([fetchHealthStatus(), fetchAlerts()]);
    lastUpdated = (/* @__PURE__ */ new Date()).toLocaleTimeString();
    loading = false;
  }
  function getStatusIcon(status) {
    switch (status) {
      case "healthy":
      case "pass":
        return Circle_check;
      case "degraded":
      case "warn":
        return Triangle_alert;
      case "unhealthy":
      case "fail":
        return Triangle_alert;
      default:
        return Activity;
    }
  }
  function getStatusColor(status) {
    switch (status) {
      case "healthy":
      case "pass":
        return "text-green-600";
      case "degraded":
      case "warn":
        return "text-yellow-600";
      case "unhealthy":
      case "fail":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  }
  function getStatusBadgeVariant(status) {
    switch (status) {
      case "healthy":
      case "pass":
        return "default";
      case "degraded":
      case "warn":
        return "secondary";
      case "unhealthy":
      case "fail":
        return "destructive";
      default:
        return "outline";
    }
  }
  function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor(seconds % 86400 / 3600);
    const minutes = Math.floor(seconds % 3600 / 60);
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }
  function formatBytes(bytes) {
    const sizes = ["Bytes", "KB", "MB", "GB"];
    if (bytes === 0) return "0 Bytes";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + " " + sizes[i];
  }
  function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  }
  function getSeverityColor(severity) {
    switch (severity.toLowerCase()) {
      case "low":
        return "text-blue-600";
      case "medium":
        return "text-yellow-600";
      case "high":
        return "text-orange-600";
      case "critical":
        return "text-red-600";
      default:
        return "text-gray-600";
    }
  }
  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });
  if (!refreshInterval) {
    refreshInterval = setInterval(refreshData, 3e4);
  }
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>System Status - Client Portal</title>`;
  });
  $$payload.out.push(`<div class="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6"><div class="max-w-6xl mx-auto space-y-8"><div class="text-center space-y-2"><h1 class="text-3xl font-bold tracking-tight">System Status</h1> <p class="text-muted-foreground">Real-time monitoring and health information</p></div> <div class="flex items-center justify-between"><div class="flex items-center gap-4">`);
  Button($$payload, {
    disabled: loading,
    size: "sm",
    children: ($$payload2) => {
      Refresh_cw($$payload2, {
        class: `h-4 w-4 mr-2 ${stringify(loading ? "animate-spin" : "")}`
      });
      $$payload2.out.push(`<!----> Refresh`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!----> <label class="flex items-center gap-2 text-sm"><input type="checkbox"${attr("checked", autoRefresh, true)} class="rounded"/> Auto-refresh (30s)</label></div> `);
  if (lastUpdated) {
    $$payload.out.push("<!--[-->");
    $$payload.out.push(`<div class="text-sm text-muted-foreground flex items-center gap-2">`);
    Clock($$payload, { class: "h-4 w-4" });
    $$payload.out.push(`<!----> Last updated: ${escape_html(lastUpdated)}</div>`);
  } else {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div> `);
  if (error) {
    $$payload.out.push("<!--[-->");
    Card($$payload, {
      class: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950",
      children: ($$payload2) => {
        Card_content($$payload2, {
          class: "p-6",
          children: ($$payload3) => {
            $$payload3.out.push(`<div class="flex items-center gap-2 text-red-700 dark:text-red-300">`);
            Triangle_alert($$payload3, { class: "h-5 w-5" });
            $$payload3.out.push(`<!----> <span class="font-medium">Error</span></div> <p class="mt-2 text-red-600 dark:text-red-400">${escape_html(error)}</p>`);
          },
          $$slots: { default: true }
        });
      },
      $$slots: { default: true }
    });
  } else {
    $$payload.out.push("<!--[!-->");
    if (healthStatus) {
      $$payload.out.push("<!--[-->");
      Card($$payload, {
        class: `border-2 ${stringify(healthStatus.status === "healthy" ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950" : healthStatus.status === "degraded" ? "border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950" : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950")}`,
        children: ($$payload2) => {
          Card_content($$payload2, {
            class: "p-8",
            children: ($$payload3) => {
              $$payload3.out.push(`<div class="flex items-center justify-between"><div class="flex items-center gap-4"><!---->`);
              getStatusIcon(healthStatus.status)?.($$payload3, {
                class: `h-12 w-12 ${stringify(getStatusColor(healthStatus.status))}`
              });
              $$payload3.out.push(`<!----> <div><h2 class="text-2xl font-bold">System ${escape_html(healthStatus.status === "healthy" ? "Operational" : healthStatus.status === "degraded" ? "Degraded" : "Down")}</h2> <p class="text-muted-foreground">All systems are ${escape_html(healthStatus.status)}</p></div></div> <div class="text-right space-y-2"><div class="text-sm text-muted-foreground">Version: ${escape_html(healthStatus.version)}</div> <div class="text-sm text-muted-foreground">Environment: ${escape_html(healthStatus.environment)}</div> <div class="text-sm text-muted-foreground">Uptime: ${escape_html(formatUptime(healthStatus.uptime))}</div></div></div>`);
            },
            $$slots: { default: true }
          });
        },
        $$slots: { default: true }
      });
      $$payload.out.push(`<!----> <div class="grid grid-cols-1 md:grid-cols-3 gap-6">`);
      Card($$payload, {
        children: ($$payload2) => {
          Card_header($$payload2, {
            class: "pb-3",
            children: ($$payload3) => {
              Card_title($$payload3, {
                class: "flex items-center gap-2",
                children: ($$payload4) => {
                  Database($$payload4, { class: "h-5 w-5" });
                  $$payload4.out.push(`<!----> Database`);
                },
                $$slots: { default: true }
              });
            },
            $$slots: { default: true }
          });
          $$payload2.out.push(`<!----> `);
          Card_content($$payload2, {
            children: ($$payload3) => {
              $$payload3.out.push(`<div class="flex items-center justify-between">`);
              Badge($$payload3, {
                variant: getStatusBadgeVariant(healthStatus.checks.database.status),
                children: ($$payload4) => {
                  $$payload4.out.push(`<!---->${escape_html(healthStatus.checks.database.status)}`);
                },
                $$slots: { default: true }
              });
              $$payload3.out.push(`<!----> <span class="text-sm text-muted-foreground">${escape_html(healthStatus.checks.database.responseTime)}ms</span></div> `);
              if (healthStatus.checks.database.message) {
                $$payload3.out.push("<!--[-->");
                $$payload3.out.push(`<p class="mt-2 text-sm text-muted-foreground">${escape_html(healthStatus.checks.database.message)}</p>`);
              } else {
                $$payload3.out.push("<!--[!-->");
              }
              $$payload3.out.push(`<!--]-->`);
            },
            $$slots: { default: true }
          });
          $$payload2.out.push(`<!---->`);
        },
        $$slots: { default: true }
      });
      $$payload.out.push(`<!----> `);
      Card($$payload, {
        children: ($$payload2) => {
          Card_header($$payload2, {
            class: "pb-3",
            children: ($$payload3) => {
              Card_title($$payload3, {
                class: "flex items-center gap-2",
                children: ($$payload4) => {
                  Server($$payload4, { class: "h-5 w-5" });
                  $$payload4.out.push(`<!----> Memory`);
                },
                $$slots: { default: true }
              });
            },
            $$slots: { default: true }
          });
          $$payload2.out.push(`<!----> `);
          Card_content($$payload2, {
            children: ($$payload3) => {
              $$payload3.out.push(`<div class="flex items-center justify-between">`);
              Badge($$payload3, {
                variant: getStatusBadgeVariant(healthStatus.checks.memory.status),
                children: ($$payload4) => {
                  $$payload4.out.push(`<!---->${escape_html(healthStatus.checks.memory.status)}`);
                },
                $$slots: { default: true }
              });
              $$payload3.out.push(`<!----> <span class="text-sm text-muted-foreground">${escape_html(healthStatus.checks.memory.responseTime)}ms</span></div> `);
              if (healthStatus.checks.memory.message) {
                $$payload3.out.push("<!--[-->");
                $$payload3.out.push(`<p class="mt-2 text-sm text-muted-foreground">${escape_html(healthStatus.checks.memory.message)}</p>`);
              } else {
                $$payload3.out.push("<!--[!-->");
              }
              $$payload3.out.push(`<!--]-->`);
            },
            $$slots: { default: true }
          });
          $$payload2.out.push(`<!---->`);
        },
        $$slots: { default: true }
      });
      $$payload.out.push(`<!----> `);
      Card($$payload, {
        children: ($$payload2) => {
          Card_header($$payload2, {
            class: "pb-3",
            children: ($$payload3) => {
              Card_title($$payload3, {
                class: "flex items-center gap-2",
                children: ($$payload4) => {
                  Zap($$payload4, { class: "h-5 w-5" });
                  $$payload4.out.push(`<!----> Performance`);
                },
                $$slots: { default: true }
              });
            },
            $$slots: { default: true }
          });
          $$payload2.out.push(`<!----> `);
          Card_content($$payload2, {
            children: ($$payload3) => {
              $$payload3.out.push(`<div class="space-y-2"><div class="flex justify-between"><span class="text-sm">Response Time</span> <span class="text-sm font-mono">${escape_html(healthStatus.performance.responseTime)}ms</span></div> <div class="flex justify-between"><span class="text-sm">Memory Usage</span> <span class="text-sm font-mono">${escape_html(formatBytes(healthStatus.performance.memoryUsage.heapUsed))}</span></div> <div class="flex justify-between"><span class="text-sm">Total Heap</span> <span class="text-sm font-mono">${escape_html(formatBytes(healthStatus.performance.memoryUsage.heapTotal))}</span></div></div>`);
            },
            $$slots: { default: true }
          });
          $$payload2.out.push(`<!---->`);
        },
        $$slots: { default: true }
      });
      $$payload.out.push(`<!----></div> `);
      if (activeAlerts && activeAlerts.count > 0) {
        $$payload.out.push("<!--[-->");
        Card($$payload, {
          children: ($$payload2) => {
            Card_header($$payload2, {
              children: ($$payload3) => {
                Card_title($$payload3, {
                  class: "flex items-center gap-2",
                  children: ($$payload4) => {
                    Triangle_alert($$payload4, { class: "h-5 w-5 text-red-600" });
                    $$payload4.out.push(`<!----> Active Alerts (${escape_html(activeAlerts.count)})`);
                  },
                  $$slots: { default: true }
                });
                $$payload3.out.push(`<!----> `);
                Card_description($$payload3, {
                  children: ($$payload4) => {
                    $$payload4.out.push(`<!---->System alerts requiring attention`);
                  },
                  $$slots: { default: true }
                });
                $$payload3.out.push(`<!---->`);
              },
              $$slots: { default: true }
            });
            $$payload2.out.push(`<!----> `);
            Card_content($$payload2, {
              children: ($$payload3) => {
                const each_array = ensure_array_like(activeAlerts.alerts);
                $$payload3.out.push(`<div class="space-y-4"><!--[-->`);
                for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
                  let alert = each_array[$$index];
                  $$payload3.out.push(`<div class="border rounded-lg p-4 space-y-2"><div class="flex items-center justify-between"><h4 class="font-semibold">${escape_html(alert.title)}</h4> <div class="flex items-center gap-2">`);
                  Badge($$payload3, {
                    variant: "outline",
                    class: getSeverityColor(alert.severity),
                    children: ($$payload4) => {
                      $$payload4.out.push(`<!---->${escape_html(alert.severity)}`);
                    },
                    $$slots: { default: true }
                  });
                  $$payload3.out.push(`<!----> <span class="text-xs text-muted-foreground">${escape_html(formatTimestamp(alert.timestamp))}</span></div></div> <p class="text-sm text-muted-foreground">${escape_html(alert.message)}</p></div>`);
                }
                $$payload3.out.push(`<!--]--></div>`);
              },
              $$slots: { default: true }
            });
            $$payload2.out.push(`<!---->`);
          },
          $$slots: { default: true }
        });
      } else {
        $$payload.out.push("<!--[!-->");
        if (activeAlerts) {
          $$payload.out.push("<!--[-->");
          Card($$payload, {
            children: ($$payload2) => {
              Card_content($$payload2, {
                class: "p-8 text-center",
                children: ($$payload3) => {
                  Circle_check($$payload3, { class: "h-12 w-12 text-green-600 mx-auto mb-4" });
                  $$payload3.out.push(`<!----> <h3 class="text-lg font-semibold mb-2">No Active Alerts</h3> <p class="text-muted-foreground">All systems are operating normally</p>`);
                },
                $$slots: { default: true }
              });
            },
            $$slots: { default: true }
          });
        } else {
          $$payload.out.push("<!--[!-->");
        }
        $$payload.out.push(`<!--]-->`);
      }
      $$payload.out.push(`<!--]-->`);
    } else {
      $$payload.out.push("<!--[!-->");
      if (loading) {
        $$payload.out.push("<!--[-->");
        $$payload.out.push(`<div class="text-center py-12">`);
        Refresh_cw($$payload, { class: "h-8 w-8 animate-spin mx-auto mb-4" });
        $$payload.out.push(`<!----> <p class="text-muted-foreground">Loading system status...</p></div>`);
      } else {
        $$payload.out.push("<!--[!-->");
      }
      $$payload.out.push(`<!--]-->`);
    }
    $$payload.out.push(`<!--]-->`);
  }
  $$payload.out.push(`<!--]--> `);
  Separator($$payload, {});
  $$payload.out.push(`<!----> <div class="text-center text-sm text-muted-foreground"><p>System monitoring powered by internal health checks and alerting system</p></div></div></div>`);
  pop();
}

export { _page as default };
//# sourceMappingURL=_page.svelte-CN9OiVMH.js.map
