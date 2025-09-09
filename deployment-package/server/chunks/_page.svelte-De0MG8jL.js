import { p as push, m as head, h as bind_props, j as pop, v as sanitize_props, x as spread_props, g as slot } from './index3-0vHBXF6s.js';
import 'clsx';
import { B as Button } from './badge-DNI7Aq68.js';
import 'exceljs';
import { R as Refresh_cw } from './refresh-cw-DoOr0aUw.js';
import { I as Icon } from './Icon-DxK3y_oV.js';
import './false-B2gHlHjM.js';
import 'tailwind-merge';

function Download($$payload, $$props) {
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
    ["path", { "d": "M12 15V3" }],
    ["path", { "d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" }],
    ["path", { "d": "m7 10 5 5 5-5" }]
  ];
  Icon($$payload, spread_props([
    { name: "download" },
    $$sanitized_props,
    {
      /**
       * @component @name Download
       * @description Lucide SVG icon component, renders SVG Element with children.
       *
       * @preview ![img](data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIgogIHdpZHRoPSIyNCIKICBoZWlnaHQ9IjI0IgogIHZpZXdCb3g9IjAgMCAyNCAyNCIKICBmaWxsPSJub25lIgogIHN0cm9rZT0iIzAwMCIgc3R5bGU9ImJhY2tncm91bmQtY29sb3I6ICNmZmY7IGJvcmRlci1yYWRpdXM6IDJweCIKICBzdHJva2Utd2lkdGg9IjIiCiAgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIgogIHN0cm9rZS1saW5lam9pbj0icm91bmQiCj4KICA8cGF0aCBkPSJNMTIgMTVWMyIgLz4KICA8cGF0aCBkPSJNMjEgMTV2NGEyIDIgMCAwIDEtMiAySDVhMiAyIDAgMCAxLTItMnYtNCIgLz4KICA8cGF0aCBkPSJtNyAxMCA1IDUgNS01IiAvPgo8L3N2Zz4K) - https://lucide.dev/icons/download
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
  let analyticsData;
  let data = $$props["data"];
  function generateGrowthData(total) {
    if (total === 0) return [0, 0, 0, 0, 0, 0, 0];
    const growthRate = 1.15;
    const data2 = [];
    let current = Math.floor(total / Math.pow(growthRate, 6));
    for (let i = 0; i < 7; i++) {
      data2.push(Math.floor(current));
      current *= growthRate;
    }
    return data2;
  }
  function generateEngagementData(avgRate) {
    if (avgRate === 0) return [0, 0, 0, 0, 0, 0, 0];
    return [
      Math.max(0, avgRate - 0.4 + Math.random() * 0.2),
      Math.max(0, avgRate + 0.3 + Math.random() * 0.2),
      Math.max(0, avgRate - 0.1 + Math.random() * 0.2),
      Math.max(0, avgRate + 0.5 + Math.random() * 0.2),
      Math.max(0, avgRate - 0.2 + Math.random() * 0.2),
      Math.max(0, avgRate + 0.8 + Math.random() * 0.2),
      Math.max(0, avgRate + 0.4 + Math.random() * 0.2)
    ].map((val) => Math.round(val * 10) / 10);
  }
  function calculatePostPerformanceDistribution(data2) {
    if (!data2.totalPosts || data2.totalPosts === 0) return [0, 0, 0];
    const avgRate = data2.avgEngagementRate || 0;
    const highPerforming = Math.round((avgRate > 0 ? 25 : 0) + Math.random() * 10);
    const lowPerforming = Math.round((avgRate > 0 ? 15 : 0) + Math.random() * 10);
    const mediumPerforming = 100 - highPerforming - lowPerforming;
    return [highPerforming, mediumPerforming, lowPerforming];
  }
  function exportAnalytics() {
    console.log("📊 Starting Excel export...");
    try {
      const workbook = XLSX.utils.book_new();
      const summaryData = [
        ["Analytics Summary Report"],
        ["Generated:", (/* @__PURE__ */ new Date()).toLocaleDateString()],
        [""],
        ["Metric", "Value", "Growth"],
        [
          "Total Followers",
          analyticsData.totalFollowers.toLocaleString(),
          `+${analyticsData.followerGrowth}%`
        ],
        [
          "Total Engagement",
          analyticsData.totalEngagement.toLocaleString(),
          `${analyticsData.engagementGrowth}%`
        ],
        [
          "Avg. Engagement Rate",
          `${analyticsData.avgEngagementRate}%`,
          "Above Industry Standard"
        ],
        [
          "Total Posts",
          analyticsData.totalPosts.toLocaleString(),
          "This Month"
        ],
        [""],
        ["Follower Growth Trend (Last 7 Months)"],
        ["Month", "Followers"],
        ...generateGrowthData(analyticsData.totalFollowers).map((value, index) => [
          ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"][index],
          value.toLocaleString()
        ]),
        [""],
        ["Weekly Engagement Rate"],
        ["Day", "Engagement Rate"],
        ...generateEngagementData(analyticsData.avgEngagementRate).map((value, index) => [
          ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][index],
          `${value}%`
        ])
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      if (!summarySheet["!merges"]) summarySheet["!merges"] = [];
      summarySheet["!merges"].push({ s: { c: 0, r: 0 }, e: { c: 2, r: 0 } });
      summarySheet["!cols"] = [{ width: 25 }, { width: 20 }, { width: 25 }];
      XLSX.utils.book_append_sheet(workbook, summarySheet, "Analytics Summary");
      if (analyticsData.accounts && analyticsData.accounts.length > 0) {
        const accountHeaders = [
          "Instagram Username",
          "Status",
          "Account Type",
          "Model",
          "Visibility",
          "Device ID",
          "Clone Number",
          "Created Date",
          "Last Login"
        ];
        const accountData = [
          accountHeaders,
          ...analyticsData.accounts.map((account) => [
            account.instagramUsername || "N/A",
            account.status || "Unknown",
            account.accountType || "Standard",
            account.model || "N/A",
            account.visibility || "Private",
            account.assignedDeviceId || "Unassigned",
            account.assignedCloneNumber || "N/A",
            account.createdAt ? new Date(account.createdAt).toLocaleDateString() : "N/A",
            account.loginTimestamp ? new Date(account.loginTimestamp).toLocaleDateString() : "N/A"
          ])
        ];
        const accountSheet = XLSX.utils.aoa_to_sheet(accountData);
        accountSheet["!cols"] = [
          { width: 20 },
          // Username
          { width: 15 },
          // Status
          { width: 15 },
          // Account Type
          { width: 12 },
          // Model
          { width: 12 },
          // Visibility
          { width: 15 },
          // Device ID
          { width: 12 },
          // Clone Number
          { width: 15 },
          // Created Date
          { width: 15 }
          // Last Login
        ];
        XLSX.utils.book_append_sheet(workbook, accountSheet, "Account Details");
      }
      const performanceDistribution = calculatePostPerformanceDistribution(analyticsData);
      const insightsData = [
        ["Performance Insights"],
        [""],
        ["Insight", "Description"],
        analyticsData.followerGrowth > 0 ? [
          "Strong Growth Trend",
          `Your follower growth has been ${analyticsData.followerGrowth}% positive over the past month`
        ] : [
          "Growth Opportunity",
          "Consider optimizing your content strategy to improve follower growth"
        ],
        analyticsData.avgEngagementRate > 2 ? [
          "High Engagement Quality",
          `Your average engagement rate of ${analyticsData.avgEngagementRate}% is above industry standards`
        ] : [
          "Engagement Focus Needed",
          `Your engagement rate of ${analyticsData.avgEngagementRate}% has room for improvement`
        ],
        [
          "Content Performance Analysis",
          "Post performance varies by content type and posting schedule"
        ],
        [""],
        ["Post Performance Distribution"],
        ["Performance Level", "Percentage"],
        ["High Performing", `${performanceDistribution[0]}%`],
        ["Medium Performing", `${performanceDistribution[1]}%`],
        ["Low Performing", `${performanceDistribution[2]}%`]
      ];
      const insightsSheet = XLSX.utils.aoa_to_sheet(insightsData);
      insightsSheet["!cols"] = [{ width: 25 }, { width: 60 }];
      XLSX.utils.book_append_sheet(workbook, insightsSheet, "Insights");
      const fileName = `Analytics_Report_${(/* @__PURE__ */ new Date()).toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);
      console.log("✅ Excel export completed:", fileName);
    } catch (error) {
      console.error("❌ Error exporting Excel file:", error);
      alert("Error exporting Excel file. Please try again.");
    }
  }
  analyticsData = data.analytics || {
    totalFollowers: 0,
    totalEngagement: 0,
    avgEngagementRate: 0,
    totalPosts: 0,
    followerGrowth: 0,
    engagementGrowth: 0
  };
  ({
    data: {
      datasets: [
        {
          label: "Followers",
          data: generateGrowthData(analyticsData.totalFollowers),
          borderColor: "rgb(37, 99, 235)",
          backgroundColor: "rgba(37, 99, 235, 0.1)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "rgb(37, 99, 235)",
          pointBorderColor: "rgb(255, 255, 255)",
          pointBorderWidth: 2
        }
      ]
    }});
  ({
    data: {
      datasets: [
        {
          label: "Engagement Rate",
          data: generateEngagementData(analyticsData.avgEngagementRate),
          backgroundColor: [
            "rgba(59, 130, 246, 0.8)",
            // blue-500
            "rgba(16, 185, 129, 0.8)",
            // emerald-500
            "rgba(245, 158, 11, 0.8)",
            // amber-500
            "rgba(239, 68, 68, 0.8)",
            // red-500
            "rgba(139, 92, 246, 0.8)",
            // violet-500
            "rgba(236, 72, 153, 0.8)",
            // pink-500
            "rgba(6, 182, 212, 0.8)"
            // cyan-500
          ],
          borderColor: [
            "rgba(59, 130, 246, 1)",
            "rgba(16, 185, 129, 1)",
            "rgba(245, 158, 11, 1)",
            "rgba(239, 68, 68, 1)",
            "rgba(139, 92, 246, 1)",
            "rgba(236, 72, 153, 1)",
            "rgba(6, 182, 212, 1)"
          ],
          borderWidth: 1,
          borderRadius: 6
        }
      ]
    }});
  ({
    data: {
      datasets: [
        {
          data: calculatePostPerformanceDistribution(analyticsData),
          backgroundColor: [
            "rgba(34, 197, 94, 0.8)",
            // green-500
            "rgba(245, 158, 11, 0.8)",
            // amber-500
            "rgba(239, 68, 68, 0.8)"
            // red-500
          ],
          borderColor: [
            "rgba(34, 197, 94, 1)",
            "rgba(245, 158, 11, 1)",
            "rgba(239, 68, 68, 1)"
          ],
          borderWidth: 2
        }
      ]
    }});
  head($$payload, ($$payload2) => {
    $$payload2.title = `<title>Analytics - Client Portal</title>`;
  });
  $$payload.out.push(`<div class="space-y-6"><div class="flex items-center justify-between"><div><h1 class="text-3xl font-bold text-white">Analytics Dashboard</h1> <p class="text-slate-300 mt-1">Track your Instagram performance and engagement metrics</p></div> <div class="flex items-center gap-2 relative z-10">`);
  Button($$payload, {
    variant: "outline",
    size: "sm",
    class: "border-white/20 text-white hover:bg-white/10 bg-transparent",
    children: ($$payload2) => {
      Refresh_cw($$payload2, { class: "w-4 h-4 mr-2" });
      $$payload2.out.push(`<!----> Refresh`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!----> `);
  Button($$payload, {
    variant: "outline",
    size: "sm",
    onclick: exportAnalytics,
    class: "border-white/20 text-white hover:bg-white/10 bg-transparent relative z-20",
    children: ($$payload2) => {
      Download($$payload2, { class: "w-4 h-4 mr-2" });
      $$payload2.out.push(`<!----> Export Report`);
    },
    $$slots: { default: true }
  });
  $$payload.out.push(`<!----></div></div> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--> `);
  {
    $$payload.out.push("<!--[!-->");
  }
  $$payload.out.push(`<!--]--></div>`);
  bind_props($$props, { data });
  pop();
}

export { _page as default };
//# sourceMappingURL=_page.svelte-De0MG8jL.js.map
