/**
 * The links in a module's nav bar. A lone link back to the module home only repeats the module
 * name above the page heading, so there is no bar then (Sage, 21 Oct 2026).
 */
export function moduleNavLinks(
  route: string,
  nav: readonly { label: string; path: string }[],
): { href: string; label: string }[] {
  if (nav.length === 1 && nav[0]?.path === "") return [];
  return nav.map((n) => ({ href: n.path ? `${route}/${n.path}` : route, label: n.label }));
}
