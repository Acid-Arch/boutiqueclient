import { p as push, B as copy_payload, C as assign_payload, h as bind_props, j as pop, m as head, l as escape_html, v as sanitize_props, x as spread_props, g as slot, F as attr_class, D as stringify } from './index3-0vHBXF6s.js';
import 'clsx';
import { B as Button } from './badge-DNI7Aq68.js';
import { I as Icon } from './Icon-DxK3y_oV.js';
import './false-B2gHlHjM.js';
import 'tailwind-merge';

function Save($$payload, $$props) {
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
        "d": "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
      }
    ],
    ["path", { "d": "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" }],
    ["path", { "d": "M7 3v4a1 1 0 0 0 1 1h7" }]
  ];
  Icon($$payload, spread_props([
    { name: "save" },
    $$sanitized_props,
    {
      /**
       * @component @name Save
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTUuMiAzYTIgMiAwIDAgMSAxLjQuNmwzLjggMy44YTIgMiAwIDAgMSAuNiAxLjRWMTlhMiAyIDAgMCAxLTIgMkg1YTIgMiAwIDAgMS0yLTJWNWEyIDIgMCAwIDEgMi0yeiIgLz4KICA8cGF0aCBkPSJNMTcgMjF2LTdhMSAxIDAgMCAwLTEtMUg4YTEgMSAwIDAgMC0xIDF2NyIgLz4KICA8cGF0aCBkPSJNNyAzdjRhMSAxIDAgMCAwIDEgMWg3IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/save
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
function _page($$payload, $$props) {
  push();
  let userSettings;
  let data = $$props["data"];
  let saving = false;
  let saveMessage = "";
  async function saveSettings() {
    console.log("🔥 saveSettings function called!");
    if (saving) return;
    saving = true;
    saveMessage = "";
    try {
      console.log("🔥 Saving settings...", userSettings);
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: {
            name: userSettings.profile.name,
            company: userSettings.profile.company
          },
          notifications: userSettings.notifications
        })
      });
      if (response.ok) {
        const result = await response.json();
        saveMessage = "✅ Settings saved successfully!";
        console.log("Settings saved:", result);
        setTimeout(
          () => {
            saveMessage = "";
          },
          3e3
        );
      } else {
        const error = await response.json();
        saveMessage = `❌ Error: ${error.error || "Failed to save settings"}`;
        console.error("Save error:", error);
      }
    } catch (error) {
      saveMessage = "❌ Network error occurred while saving";
      console.error("Network error:", error);
    } finally {
      saving = false;
    }
  }
  userSettings = data.userSettings;
  let $$settled = true;
  let $$inner_payload;
  function $$render_inner($$payload2) {
    head($$payload2, ($$payload3) => {
      $$payload3.title = `<title>Settings - Client Portal</title>`;
    });
    $$payload2.out.push(`<div class="space-y-6"><div class="flex items-center justify-between"><div><h1 class="text-3xl font-bold text-white">Settings</h1> <p class="text-slate-300 mt-1">Manage your account preferences and configuration</p></div> <div class="flex flex-col items-end gap-2 relative z-10">`);
    if (saveMessage) {
      $$payload2.out.push("<!--[-->");
      $$payload2.out.push(`<div${attr_class(`text-sm ${stringify(saveMessage.startsWith("✅") ? "text-green-400" : "text-red-400")}`)}>${escape_html(saveMessage)}</div>`);
    } else {
      $$payload2.out.push("<!--[!-->");
    }
    $$payload2.out.push(`<!--]--> `);
    Button($$payload2, {
      onclick: saveSettings,
      disabled: saving,
      class: "bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed relative z-20",
      children: ($$payload3) => {
        Save($$payload3, { class: "w-4 h-4 mr-2" });
        $$payload3.out.push(`<!----> ${escape_html(saving ? "Saving..." : "Save Changes")}`);
      },
      $$slots: { default: true }
    });
    $$payload2.out.push(`<!----></div></div> `);
    {
      $$payload2.out.push("<!--[!-->");
    }
    $$payload2.out.push(`<!--]--></div>`);
  }
  do {
    $$settled = true;
    $$inner_payload = copy_payload($$payload);
    $$render_inner($$inner_payload);
  } while (!$$settled);
  assign_payload($$payload, $$inner_payload);
  bind_props($$props, { data });
  pop();
}

export { _page as default };
//# sourceMappingURL=_page.svelte-C8OVcGQ0.js.map
