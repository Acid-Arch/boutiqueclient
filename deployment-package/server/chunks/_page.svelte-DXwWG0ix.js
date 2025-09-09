import { p as push, m as head, l as escape_html, h as bind_props, j as pop, o as ensure_array_like } from './index3-0vHBXF6s.js';
import { C as Card, a as Card_header, b as Card_title, c as Card_content } from './card-title-DJOK6gsy.js';
import 'clsx';
import { B as Button, a as Badge } from './badge-DNI7Aq68.js';
import { P as Play, C as Circle_check_big, a as Circle_alert } from './play-D52iXwUR.js';
import { A as Activity } from './activity-4rxLUk7e.js';
import './false-B2gHlHjM.js';
import 'tailwind-merge';
import './Icon-DxK3y_oV.js';

function _page($$payload, $$props) {
  push();
  let recentActivity;
  let data = $$props["data"];
  data.stats || {
    };
  recentActivity = data.recentActivity || [];
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>Dashboard - Client Portal</title>`;
  });
  $$payload.out.push(`<div class="space-y-6"><div class="glass-card p-6 rounded-xl"><div class="flex items-center justify-between"><div><h1 class="text-2xl font-bold text-white mb-2">Welcome back, ${escape_html(data.user?.name?.split(" ")[0] || "User")}! 👋</h1> <p class="text-slate-300">Here's what's happening with your Instagram accounts today.</p></div> <div class="hidden md:block">`);
  Button($$payload, {
    class: "bg-blue-600 hover:bg-blue-700 text-white",
    children: ($$payload2) => {
      Play($$payload2, { class: "w-4 h-4 mr-2" });
      $$payload2.out.push(`<!----> Start Automation`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!----></div></div></div> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> <div class="grid grid-cols-1 lg:grid-cols-3 gap-6"><div class="lg:col-span-2">`);
  Card($$payload, {
    class: "glass-card border-white/10",
    children: ($$payload2) => {
      Card_header($$payload2, {
        children: ($$payload3) => {
          Card_title($$payload3, {
            class: "text-white flex items-center",
            children: ($$payload4) => {
              Activity($$payload4, { class: "w-5 h-5 mr-2 text-blue-400" });
              $$payload4.out.push(`<!----> Recent Activity`);
            },
            $$slots: { default: true }
          });
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----> `);
      Card_content($$payload2, {
        children: ($$payload3) => {
          $$payload3.out.push(`<div class="space-y-4">`);
          if (recentActivity.length > 0) {
            $$payload3.out.push("<!--[-->");
            const each_array = ensure_array_like(recentActivity);
            $$payload3.out.push(`<!--[-->`);
            for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
              let activity = each_array[$$index];
              $$payload3.out.push(`<div class="flex items-center justify-between p-3 glass rounded-lg"><div class="flex items-center space-x-3"><div class="flex-shrink-0">`);
              if (activity.status === "success" || activity.status === "completed") {
                $$payload3.out.push("<!--[-->");
                Circle_check_big($$payload3, { class: "w-5 h-5 text-green-400" });
              } else {
                $$payload3.out.push("<!--[!-->");
                Circle_alert($$payload3, { class: "w-5 h-5 text-yellow-400" });
              }
              $$payload3.out.push(`<!--]--></div> <div><p class="text-sm font-medium text-white">`);
              if (activity.type === "accountlogin") {
                $$payload3.out.push("<!--[-->");
                $$payload3.out.push(`Account login: <span class="text-blue-300">${escape_html(activity.account)}</span>`);
              } else {
                $$payload3.out.push("<!--[!-->");
                if (activity.type === "deviceassignment") {
                  $$payload3.out.push("<!--[-->");
                  $$payload3.out.push(`Device assigned: <span class="text-slate-300">${escape_html(activity.device || "Device")}</span> → <span class="text-blue-300">${escape_html(activity.account)}</span>`);
                } else {
                  $$payload3.out.push("<!--[!-->");
                  if (activity.type === "scrapingsession") {
                    $$payload3.out.push("<!--[-->");
                    $$payload3.out.push(`Scraping completed: <span class="text-blue-300">${escape_html(activity.account)}</span>`);
                  } else {
                    $$payload3.out.push("<!--[!-->");
                    if (activity.type === "userlogin") {
                      $$payload3.out.push("<!--[-->");
                      $$payload3.out.push(`User login: <span class="text-blue-300">${escape_html(activity.account)}</span>`);
                    } else {
                      $$payload3.out.push("<!--[!-->");
                      $$payload3.out.push(`Activity: <span class="text-blue-300">${escape_html(activity.type)}</span>`);
                    }
                    $$payload3.out.push(`<!--]-->`);
                  }
                  $$payload3.out.push(`<!--]-->`);
                }
                $$payload3.out.push(`<!--]-->`);
              }
              $$payload3.out.push(`<!--]--></p> <p class="text-xs text-slate-400">${escape_html(activity.time)}</p></div></div> `);
              Badge($$payload3, {
                variant: "outline",
                class: activity.status === "success" || activity.status === "completed" ? "border-green-500 text-green-400" : activity.status === "error" ? "border-red-500 text-red-400" : "border-yellow-500 text-yellow-400",
                children: ($$payload4) => {
                  $$payload4.out.push(`<!---->${escape_html(activity.status)}`);
                },
                $$slots: { default: true }
              });
              $$payload3.out.push(`<!----></div>`);
            }
            $$payload3.out.push(`<!--]-->`);
          } else {
            $$payload3.out.push("<!--[!-->");
            $$payload3.out.push(`<div class="text-center py-8">`);
            Activity($$payload3, { class: "w-12 h-12 mx-auto text-slate-500 mb-4" });
            $$payload3.out.push(`<!----> <p class="text-slate-400 text-sm">No recent activity found</p> <p class="text-slate-500 text-xs mt-1">Account activities will appear here when available</p></div>`);
          }
          $$payload3.out.push(`<!--]--></div>`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!---->`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!----></div> <div>`);
  Card($$payload, {
    class: "glass-card border-white/10",
    children: ($$payload2) => {
      Card_header($$payload2, {
        children: ($$payload3) => {
          Card_title($$payload3, {
            class: "text-white text-sm",
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->Account Status`);
            },
            $$slots: { default: true }
          });
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!----> `);
      Card_content($$payload2, {
        class: "space-y-3",
        children: ($$payload3) => {
          $$payload3.out.push(`<div class="flex items-center justify-between"><span class="text-sm text-slate-300">Subscription</span> `);
          Badge($$payload3, {
            class: "bg-blue-500/20 text-blue-300",
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->${escape_html(data.user.subscription || "Basic")}`);
            },
            $$slots: { default: true }
          });
          $$payload3.out.push(`<!----></div> <div class="flex items-center justify-between"><span class="text-sm text-slate-300">Account Limit</span> <span class="text-sm text-white">${escape_html(data.stats?.totalAccounts || 0)} / ${escape_html(data.user.accountsLimit || 10)}</span></div> <div class="flex items-center justify-between"><span class="text-sm text-slate-300">Status</span> `);
          Badge($$payload3, {
            class: "bg-green-500/20 text-green-300",
            children: ($$payload4) => {
              $$payload4.out.push(`<!---->${escape_html(data.user.isActive ? "Active" : "Inactive")}`);
            },
            $$slots: { default: true }
          });
          $$payload3.out.push(`<!----></div>`);
        },
        $$slots: { default: true }
      });
      $$payload2.out.push(`<!---->`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!----></div></div></div>`);
  bind_props($$props, { data });
  pop();
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DXwWG0ix.js.map
