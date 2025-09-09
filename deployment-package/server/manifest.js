const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.svg"]),
	mimeTypes: {".svg":"image/svg+xml"},
	_: {
		client: {start:"_app/immutable/entry/start.DW9eKR86.js",app:"_app/immutable/entry/app.BF5ZTRjE.js",imports:["_app/immutable/entry/start.DW9eKR86.js","_app/immutable/chunks/9ZzghxzE.js","_app/immutable/chunks/3zx2OM-S.js","_app/immutable/entry/app.BF5ZTRjE.js","_app/immutable/chunks/3zx2OM-S.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/Dwjkgfq3.js","_app/immutable/chunks/ugyboSLg.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-BooWsro_.js')),
			__memo(() => import('./chunks/1-wjYXk12A.js')),
			__memo(() => import('./chunks/2-CkPDhMNk.js')),
			__memo(() => import('./chunks/3-KR0k3kvL.js')),
			__memo(() => import('./chunks/4-Dfp8fdIy.js')),
			__memo(() => import('./chunks/5-DGnL-u6k.js')),
			__memo(() => import('./chunks/6-Fd-mC2zI.js')),
			__memo(() => import('./chunks/7-DR4R-tW-.js')),
			__memo(() => import('./chunks/8-ZSpIYhUR.js')),
			__memo(() => import('./chunks/9-BUdaJoKg.js')),
			__memo(() => import('./chunks/10-3ZPhDeFG.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/api/accounts",
				pattern: /^\/api\/accounts\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-C2xSW45e.js'))
			},
			{
				id: "/api/accounts/available",
				pattern: /^\/api\/accounts\/available\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-DSdGpbvp.js'))
			},
			{
				id: "/api/accounts/bulk-field",
				pattern: /^\/api\/accounts\/bulk-field\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-Chr26Xlv.js'))
			},
			{
				id: "/api/accounts/bulk-info",
				pattern: /^\/api\/accounts\/bulk-info\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CCUz_WAE.js'))
			},
			{
				id: "/api/accounts/bulk",
				pattern: /^\/api\/accounts\/bulk\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-B72wxalV.js'))
			},
			{
				id: "/api/accounts/ownership",
				pattern: /^\/api\/accounts\/ownership\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-B5rUJJst.js'))
			},
			{
				id: "/api/accounts/[id]",
				pattern: /^\/api\/accounts\/([^/]+?)\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CbWmsOQe.js'))
			},
			{
				id: "/api/accounts/[id]/field",
				pattern: /^\/api\/accounts\/([^/]+?)\/field\/?$/,
				params: [{"name":"id","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-OoAPUwvs.js'))
			},
			{
				id: "/api/admin/health",
				pattern: /^\/api\/admin\/health\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BPCpBQWA.js'))
			},
			{
				id: "/api/admin/ip-whitelist",
				pattern: /^\/api\/admin\/ip-whitelist\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-Dnc-Ld_O.js'))
			},
			{
				id: "/api/admin/security/logs",
				pattern: /^\/api\/admin\/security\/logs\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CSdzJjmV.js'))
			},
			{
				id: "/api/alerts",
				pattern: /^\/api\/alerts\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-GRklaHMV.js'))
			},
			{
				id: "/api/auth/check-ip",
				pattern: /^\/api\/auth\/check-ip\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-DSIhPayR.js'))
			},
			{
				id: "/api/auth/create-test-user",
				pattern: /^\/api\/auth\/create-test-user\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BmFm2FUW.js'))
			},
			{
				id: "/api/auth/login",
				pattern: /^\/api\/auth\/login\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-D-kUISCI.js'))
			},
			{
				id: "/api/auth/logout",
				pattern: /^\/api\/auth\/logout\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-W-eNoFrr.js'))
			},
			{
				id: "/api/auth/me",
				pattern: /^\/api\/auth\/me\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BqfLU3En.js'))
			},
			{
				id: "/api/auth/oauth/callback",
				pattern: /^\/api\/auth\/oauth\/callback\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-B7TXThkD.js'))
			},
			{
				id: "/api/auth/oauth/google",
				pattern: /^\/api\/auth\/oauth\/google\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-Bp5ag_qK.js'))
			},
			{
				id: "/api/auth/oauth/initiate",
				pattern: /^\/api\/auth\/oauth\/initiate\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CHTazxBf.js'))
			},
			{
				id: "/api/auth/request-ip-access",
				pattern: /^\/api\/auth\/request-ip-access\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-B6ipsa2X.js'))
			},
			{
				id: "/api/avatar/[username]",
				pattern: /^\/api\/avatar\/([^/]+?)\/?$/,
				params: [{"name":"username","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BUIJA23M.js'))
			},
			{
				id: "/api/dashboard",
				pattern: /^\/api\/dashboard\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BcaUK5PB.js'))
			},
			{
				id: "/api/debug-env",
				pattern: /^\/api\/debug-env\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-eXaNkbW-.js'))
			},
			{
				id: "/api/devices",
				pattern: /^\/api\/devices\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-B8PBmnXj.js'))
			},
			{
				id: "/api/devices/assign",
				pattern: /^\/api\/devices\/assign\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-DlWobnGY.js'))
			},
			{
				id: "/api/devices/auto-assign",
				pattern: /^\/api\/devices\/auto-assign\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CmLviui6.js'))
			},
			{
				id: "/api/devices/capacity-check",
				pattern: /^\/api\/devices\/capacity-check\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CpOn4OId.js'))
			},
			{
				id: "/api/devices/unassign",
				pattern: /^\/api\/devices\/unassign\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CENoidbe.js'))
			},
			{
				id: "/api/devices/[deviceId]",
				pattern: /^\/api\/devices\/([^/]+?)\/?$/,
				params: [{"name":"deviceId","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-P_Mr0Bwp.js'))
			},
			{
				id: "/api/devices/[deviceId]/clones",
				pattern: /^\/api\/devices\/([^/]+?)\/clones\/?$/,
				params: [{"name":"deviceId","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CMsZnogc.js'))
			},
			{
				id: "/api/errors/report",
				pattern: /^\/api\/errors\/report\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CcWD6cLV.js'))
			},
			{
				id: "/api/export",
				pattern: /^\/api\/export\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CRAg_222.js'))
			},
			{
				id: "/api/health",
				pattern: /^\/api\/health\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-WK9IyEmX.js'))
			},
			{
				id: "/api/health/ready",
				pattern: /^\/api\/health\/ready\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CdPDqlcl.js'))
			},
			{
				id: "/api/health/simple",
				pattern: /^\/api\/health\/simple\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BP1abjrC.js'))
			},
			{
				id: "/api/import",
				pattern: /^\/api\/import\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-DmuFhU9h.js'))
			},
			{
				id: "/api/logout",
				pattern: /^\/api\/logout\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-DOlcH4n_.js'))
			},
			{
				id: "/api/metrics",
				pattern: /^\/api\/metrics\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CAhKdEWf.js'))
			},
			{
				id: "/api/scraping/accounts",
				pattern: /^\/api\/scraping\/accounts\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-BwE2tzuP.js'))
			},
			{
				id: "/api/scraping/analytics/costs",
				pattern: /^\/api\/scraping\/analytics\/costs\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-zDAYMj4j.js'))
			},
			{
				id: "/api/scraping/bulk",
				pattern: /^\/api\/scraping\/bulk\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-C6DhOExq.js'))
			},
			{
				id: "/api/scraping/bulk/start",
				pattern: /^\/api\/scraping\/bulk\/start\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-C_48r3Yb.js'))
			},
			{
				id: "/api/scraping/cost-optimizer",
				pattern: /^\/api\/scraping\/cost-optimizer\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-zJVV5oMz.js'))
			},
			{
				id: "/api/scraping/daily-scheduler",
				pattern: /^\/api\/scraping\/daily-scheduler\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-cybq5PcF.js'))
			},
			{
				id: "/api/scraping/dashboard/stats",
				pattern: /^\/api\/scraping\/dashboard\/stats\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-fU2olyRt.js'))
			},
			{
				id: "/api/scraping/enhanced-error-recovery/analytics",
				pattern: /^\/api\/scraping\/enhanced-error-recovery\/analytics\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-Dpj3Dgh5.js'))
			},
			{
				id: "/api/scraping/enhanced-error-recovery/health-check",
				pattern: /^\/api\/scraping\/enhanced-error-recovery\/health-check\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-DJZJkrH7.js'))
			},
			{
				id: "/api/scraping/enhanced-error-recovery/health",
				pattern: /^\/api\/scraping\/enhanced-error-recovery\/health\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-rPzq2eVn.js'))
			},
			{
				id: "/api/scraping/enhanced-error-recovery/metrics",
				pattern: /^\/api\/scraping\/enhanced-error-recovery\/metrics\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-ra18_8Ia.js'))
			},
			{
				id: "/api/scraping/enhanced-error-recovery/realtime",
				pattern: /^\/api\/scraping\/enhanced-error-recovery\/realtime\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-Pkn70OyZ.js'))
			},
			{
				id: "/api/scraping/growth/[accountId]",
				pattern: /^\/api\/scraping\/growth\/([^/]+?)\/?$/,
				params: [{"name":"accountId","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-XS9SDx6A.js'))
			},
			{
				id: "/api/scraping/metrics/[accountId]",
				pattern: /^\/api\/scraping\/metrics\/([^/]+?)\/?$/,
				params: [{"name":"accountId","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-Dtm18_Dx.js'))
			},
			{
				id: "/api/scraping/profile/[accountId]",
				pattern: /^\/api\/scraping\/profile\/([^/]+?)\/?$/,
				params: [{"name":"accountId","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-B1A0WiW8.js'))
			},
			{
				id: "/api/scraping/sessions",
				pattern: /^\/api\/scraping\/sessions\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-ByzUh-4g.js'))
			},
			{
				id: "/api/scraping/sessions/[sessionId]",
				pattern: /^\/api\/scraping\/sessions\/([^/]+?)\/?$/,
				params: [{"name":"sessionId","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-DgVEolJQ.js'))
			},
			{
				id: "/api/scraping/sessions/[sessionId]/control",
				pattern: /^\/api\/scraping\/sessions\/([^/]+?)\/control\/?$/,
				params: [{"name":"sessionId","optional":false,"rest":false,"chained":false}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-eFDDjH6P.js'))
			},
			{
				id: "/api/scraping/start",
				pattern: /^\/api\/scraping\/start\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-C9cUGsG8.js'))
			},
			{
				id: "/api/scraping/websocket",
				pattern: /^\/api\/scraping\/websocket\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => Promise.resolve().then(function () { return _server_ts; }))
			},
			{
				id: "/api/settings",
				pattern: /^\/api\/settings\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-Cai0MOr3.js'))
			},
			{
				id: "/api/test-db",
				pattern: /^\/api\/test-db\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CxyKFgC6.js'))
			},
			{
				id: "/api/test-login",
				pattern: /^\/api\/test-login\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-ArKR_far.js'))
			},
			{
				id: "/auth/[...auth]",
				pattern: /^\/auth(?:\/([^]*))?\/?$/,
				params: [{"name":"auth","optional":false,"rest":true,"chained":true}],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CzViSPTG.js'))
			},
			{
				id: "/client-portal",
				pattern: /^\/client-portal\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/client-portal/accounts",
				pattern: /^\/client-portal\/accounts\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/client-portal/analytics",
				pattern: /^\/client-portal\/analytics\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/client-portal/components-showcase",
				pattern: /^\/client-portal\/components-showcase\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			},
			{
				id: "/client-portal/design-system",
				pattern: /^\/client-portal\/design-system\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 7 },
				endpoint: null
			},
			{
				id: "/client-portal/settings",
				pattern: /^\/client-portal\/settings\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 8 },
				endpoint: null
			},
			{
				id: "/login",
				pattern: /^\/login\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 9 },
				endpoint: null
			},
			{
				id: "/status",
				pattern: /^\/status\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 10 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

const prerendered = new Set([]);

const base = "";

var _server_ts = /*#__PURE__*/Object.freeze({
	__proto__: null
});

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map
