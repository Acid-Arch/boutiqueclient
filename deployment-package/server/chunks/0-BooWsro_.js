const load = async ({ locals, url }) => {
  const isClientPortal = url.pathname.startsWith("/client-portal");
  if (isClientPortal && locals.user) {
    return {
      user: {
        id: locals.user.id,
        name: locals.user.name,
        email: locals.user.email,
        role: locals.user.role,
        company: locals.user.company,
        avatar: locals.user.avatar,
        subscription: locals.user.subscription,
        isActive: locals.user.isActive
      }
    };
  }
  return {
    user: null
  };
};

var _layout_server_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 0;
let component_cache;
const component = async () => component_cache ??= (await import('./_layout.svelte-D7V0lWVN.js')).default;
const server_id = "src/routes/+layout.server.ts";
const imports = ["_app/immutable/nodes/0.DcU5HdM-.js","_app/immutable/chunks/DsnmJJEf.js","_app/immutable/chunks/DX-Oc8op.js","_app/immutable/chunks/3zx2OM-S.js","_app/immutable/chunks/Dwjkgfq3.js","_app/immutable/chunks/z8oQ6GeD.js","_app/immutable/chunks/BID1lDIu.js","_app/immutable/chunks/lPcixCUF.js","_app/immutable/chunks/ugyboSLg.js","_app/immutable/chunks/CZ88HukD.js","_app/immutable/chunks/9ZzghxzE.js","_app/immutable/chunks/BQu96azb.js","_app/immutable/chunks/CN0Dtqqk.js","_app/immutable/chunks/BAf6IcXK.js","_app/immutable/chunks/dcpnCTTX.js","_app/immutable/chunks/DkmbWJ8q.js"];
const stylesheets = ["_app/immutable/assets/0.x1XYEf_w.css"];
const fonts = [];

export { component, fonts, imports, index, _layout_server_ts as server, server_id, stylesheets };
//# sourceMappingURL=0-BooWsro_.js.map
