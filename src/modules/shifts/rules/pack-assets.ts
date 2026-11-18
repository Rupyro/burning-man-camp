// Pure: which of the page's loaded files the Burn pack keeps for no signal. Static files only:
// prefetched pages (`?_rsc=`) would each be re-rendered on the server just to be saved.

const STATIC = /^\/(_next\/static\/|backdrop\/)|\.(woff2?|png|jpg|webp|svg|ico)$/;

export function packAssetUrls(urls: readonly string[], origin: string): string[] {
  return urls.filter((u) => {
    if (!u.startsWith(`${origin}/`)) return false;
    return STATIC.test(new URL(u).pathname);
  });
}
