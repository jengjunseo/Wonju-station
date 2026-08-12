import assert from "node:assert/strict";
import test from "node:test";

async function render(pathname) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${pathname}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${pathname}`, { headers: { accept: "text/html", host: "localhost" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

for (const [pathname, expected] of [["/", "WONJU NOW"], ["/weather", "HYPERLOCAL WEATHER"], ["/map", "WONJU LIVE MAP"], ["/place/%EB%AC%B4%EC%8B%A4%EB%8F%99", "NEIGHBORHOOD DESK"]]) {
  test(`server-renders ${pathname}`, async () => {
    const response = await render(pathname);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
    const html = await response.text();
    assert.match(html, new RegExp(expected));
    assert.match(html, /WONJU STATION/);
    assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/);
  });
}

