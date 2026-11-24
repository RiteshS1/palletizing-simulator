import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { DOCS } from "../src/lib/docs";

const snapshot = (page: Page) => page.evaluate(() => window.__palletlab!.snapshot());
async function openSimulator(page: Page, mode: string) {
  await page.goto(`/en/simulator/${mode}`);
  await page.waitForFunction(() => window.__palletlab && window.__palletlab.snapshot().total > 0);
}

// ---------------------------------------------------------------- languages
test.describe("languages", () => {
  test("an English browser lands on the English site", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/en$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Robots that think in boxes.");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test.describe("Japanese browser", () => {
    test.use({ locale: "ja-JP" });
    test("is sent to the Japanese site automatically", async ({ page }) => {
      await page.goto("/");
      await expect(page).toHaveURL(/\/ja$/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText("箱で考えるロボット。");
      await expect(page.locator("html")).toHaveAttribute("lang", "ja");
    });
  });

  test("the language switcher keeps you on the same page", async ({ page, isMobile }) => {
    test.skip(isMobile, "same flow on desktop is enough");
    await page.goto("/en/docs/geometry");
    await page.getByRole("button", { name: "日本語" }).click();
    await expect(page).toHaveURL(/\/ja\/docs\/geometry$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("幾何と AABB");
  });
});

// ---------------------------------------------------------------- docs
test("every docs chapter renders in both languages", async ({ request, isMobile }) => {
  test.skip(isMobile, "server-rendered HTML is the same on every device");
  for (const locale of ["en", "ja"]) {
    for (const d of DOCS) {
      const res = await request.get(`/${locale}/docs${d.slug === "overview" ? "" : `/${d.slug}`}`);
      expect(res.status(), `${locale}/${d.slug}`).toBe(200);
      const html = await res.text();
      expect(html, `${locale}/${d.slug} has a heading`).toMatch(/<h1[^>]*>[^<]+<\/h1>/);
      expect(html).toContain(`lang="${locale}"`);
    }
  }
});

test("docs: sidebar navigation and the live 3D island", async ({ page, isMobile }) => {
  await page.goto("/en/docs/stacking-rules");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Stacking rules");
  await expect(page.locator("figure canvas")).toBeVisible();
  await page.getByRole("link", { name: /Next.*Greedy layer/ }).click();
  await expect(page).toHaveURL(/\/en\/docs\/greedy-layer$/);
  if (!isMobile) {
    await expect(page.getByRole("link", { name: "Greedy layer", exact: true })).toHaveAttribute("aria-current", "page");
  }
});

// ---------------------------------------------------------------- simulator
test("simulator: playback controls and the conveyor", async ({ page }) => {
  await openSimulator(page, "extreme-points");
  expect((await snapshot(page)).total).toBe(38);
  await page.getByTestId("end").click();
  expect((await snapshot(page)).step).toBe(38);
  await page.getByRole("button", { name: "Back to the start" }).click();
  await page.getByTestId("forward").click();
  await page.getByTestId("forward").click();
  expect((await snapshot(page)).step).toBe(2);
  await expect(page.getByTestId("step-now")).toHaveText("02");
  await page.getByRole("group", { name: /Boxes in placement order/ }).getByRole("button", { name: "10", exact: true }).click();
  expect((await snapshot(page)).step).toBe(10);
});

test("simulator: the 3D view actually renders", async ({ page }) => {
  await openSimulator(page, "extreme-points");
  await page.getByTestId("end").click();
  const colours = await page.evaluate(async () => {
    await new Promise((r) => setTimeout(r, 800));
    const src = document.querySelector("canvas")!;
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(src, 0, 0, 64, 64);
    const px = ctx.getImageData(0, 0, 64, 64).data;
    const seen = new Set<string>();
    for (let i = 0; i < px.length; i += 4) seen.add(`${px[i] >> 4},${px[i + 1] >> 4},${px[i + 2] >> 4}`);
    return seen.size;
  });
  expect(colours).toBeGreaterThan(12);
});

test("simulator: side by side shows extreme points winning", async ({ page }) => {
  await openSimulator(page, "compare");
  const finished = page.locator("section", { has: page.getByRole("heading", { name: "Finished plans" }) });
  const row = finished.locator("tbody tr").first();
  await expect(row.locator("td").nth(1)).toHaveText("18/40");
  await expect(row.locator("td").nth(2)).toHaveText("38/40");
  await expect(row.locator("td").nth(2)).toHaveClass(/font-semibold/);
});

test("simulator: orders all finish by the end of the shift", async ({ page }) => {
  await openSimulator(page, "orders");
  const wes = await page.evaluate(() => window.__palletlab!.plans().wes);
  await page.getByTestId("end").click();
  await expect(page.getByTestId("order-queue").locator('[data-status="done"]')).toHaveCount(wes.orders.length);
});

test("WebAssembly engine in the browser matches the native CLI byte for byte", async ({ page }) => {
  await openSimulator(page, "compare");
  const same = await page.evaluate(async () => {
    const engine = window.__palletlab!.engine();
    if (!(await engine.ready)) return "no engine";
    const strip = (p: { metrics: object }) => JSON.stringify({ ...p, metrics: { ...p.metrics, runtimeMs: 0 } });
    const out: boolean[] = [];
    for (const algo of ["greedy", "ep"] as const) {
      const wasm = await engine.pack(algo, 40, 42, 0.75);
      const cli = await fetch(`/data/plan_${algo}.json`).then((r) => r.json());
      out.push(strip(wasm) === strip(cli));
    }
    return out;
  });
  expect(same).toEqual([true, true]);
});

test("simulator: pack a new box set in the browser", async ({ page }) => {
  await openSimulator(page, "compare");
  await expect(page.getByTestId("engine-status")).toContainText("WebAssembly");
  const form = page.getByTestId("try-other");
  await form.locator('input[name="n"]').fill("25");
  await form.locator('input[name="seed"]').fill("99");
  await form.getByRole("button").click();
  await expect(page.getByTestId("engine-status")).toContainText("Planned in");
  await expect(page.locator("section", { has: page.getByRole("heading", { name: "Finished plans" }) })).toContainText("/25");
});

// ---------------------------------------------------------------- assistant (mocked endpoint)
test("assistant: asks a question and shows the streamed answer with sources", async ({ page }) => {
  await page.route("**/api/chat", async (route) => {
    const events = [
      { type: "start" },
      { type: "data-sources", data: [{ title: "Extreme points", url: "/en/docs/extreme-points" }] },
      { type: "text-start", id: "t1" },
      { type: "text-delta", id: "t1", delta: "Extreme points tries every **corner** the stack creates." },
      { type: "text-end", id: "t1" },
      { type: "finish" },
    ];
    await route.fulfill({
      status: 200,
      headers: { "content-type": "text/event-stream", "x-vercel-ai-ui-message-stream": "v1" },
      body: events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n",
    });
  });
  await page.goto("/en/docs");
  await page.getByRole("button", { name: "Ask the assistant" }).click();
  await page.getByRole("dialog", { name: "PalletLab assistant" }).getByRole("button", { name: /Explain extreme points/ }).click();
  const answer = page.getByTestId("assistant-message").last();
  await expect(answer).toContainText("tries every corner the stack creates");
  await expect(answer.getByRole("link", { name: "Extreme points" })).toHaveAttribute("href", "/en/docs/extreme-points");
});

// ---------------------------------------------------------------- quality
for (const path of ["/en", "/ja/docs/extreme-points", "/en/simulator/compare"]) {
  test(`no serious accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForTimeout(1200);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).exclude("canvas").analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious.map((v) => `${v.id}: ${v.nodes.length} × ${v.nodes[0]?.target}`)).toEqual([]);
  });
}

test("no sideways scrolling on any screen", async ({ page }) => {
  for (const path of ["/en", "/en/docs/orders", "/en/simulator/orders"]) {
    await page.goto(path);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
});
