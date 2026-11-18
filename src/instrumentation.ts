// Runs once per server instance before requests are handled: hand the module
// list (composition root) to the base registry and validate every manifest.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ registerModules }, { modules }] = await Promise.all([
      import("@/base/api"),
      import("@/modules"),
    ]);
    registerModules(modules);
  }
}
