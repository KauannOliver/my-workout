import { expect, test, type Page } from "@playwright/test";

async function onboarding(page: Page) {
  await page.goto("/"); await expect(page).toHaveURL(/onboarding/);
  if (process.env.PLAYWRIGHT_BASE_URL) { await page.evaluate(() => navigator.serviceWorker.ready); if (!await page.evaluate(() => Boolean(navigator.serviceWorker.controller))) { await page.reload(); await expect(page).toHaveURL(/onboarding/); } await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller)); }
  await page.getByLabel("Nome").fill("Pessoa Teste"); await page.getByLabel("Data de nascimento").fill("1990-05-10"); await page.getByLabel("Altura (cm)").fill("175"); await page.getByLabel("Peso atual").fill("82"); await page.getByLabel("Peso desejado").fill("76"); await page.getByRole("button", {name:/Continuar/}).evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.getByText("Sua rotina")).toBeVisible(); await page.getByRole("button", {name:/Continuar/}).evaluate((button) => (button as HTMLButtonElement).click());
  await expect(page.getByText("Conforto e preferências")).toBeVisible();
  await page.locator("form").evaluate((form) => (form as HTMLFormElement).requestSubmit());
  await expect(page).toHaveURL(/inicio/); await expect(page.getByText(/Olá, Pessoa/)).toBeVisible();
}

test("onboarding cria programa e inicia treino A", async ({ page }) => {
  await onboarding(page); await page.getByRole("link", {name:/Preparar treino/}).click(); await expect(page.getByRole("heading", {name:"Treino A"})).toBeVisible(); await page.getByRole("button", {name:/Iniciar treino A/}).click();
  if (!/treinar\/sessao/.test(page.url())) { const resume = page.getByRole("button", { name: /Continuar treino/ }); if (await resume.isVisible()) await resume.click(); }
  await expect(page).toHaveURL(/treinar\/sessao/); await expect(page.getByRole("button", { name: /Supino reto com barra/ })).toBeVisible(); await expect(page.getByText(/salvo localmente/)).toBeVisible();
});

test("dados do onboarding sobrevivem à recarga", async ({ page }) => {
  await onboarding(page); await page.reload(); await expect(page).toHaveURL(/inicio/); await expect(page.getByText(/Olá, Pessoa/)).toBeVisible();
});

test("Perfil abre com Web Push opcional desativado", async ({ page }) => {
  await onboarding(page);
  const pushConfiguration = await page.request.get("/api/push/public-key");
  expect(pushConfiguration.status()).toBe(200);
  await page.goto("/perfil");
  await expect(page.getByRole("heading", { name: "Pessoa Teste" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dados salvos neste dispositivo" })).toBeVisible();
  await expect(page.getByText(/Web Push opcional está desativado/)).toBeVisible();
});

test("série concluída permanece após recarregar", async ({ page }) => {
  await onboarding(page); await page.getByRole("link", {name:/Preparar treino/}).click(); await page.getByRole("button", {name:/Iniciar treino A/}).click(); await page.getByLabel(/Carga/).fill("20"); await page.getByLabel(/Reps/).fill("8"); await page.getByRole("button", {name:/Concluir e salvar/}).click(); await expect(page.getByRole("heading", {name:"Remada em máquina com peito apoiado"})).toBeVisible(); await page.reload(); await expect(page.getByText(/20 kg × 8/)).toBeVisible();
});

test("biset alterna o par e descansa antes da rodada seguinte", async ({ page }) => {
  await onboarding(page); await page.getByRole("link", {name:/Preparar treino/}).click(); await page.getByRole("button", {name:/Iniciar treino A/}).click();
  await expect(page.getByRole("heading", {name:"Supino reto com barra"})).toBeVisible();
  await page.getByLabel(/Carga/).fill("20"); await page.getByLabel(/Reps/).fill("8"); await page.getByRole("button", {name:/Concluir e salvar/}).click();
  await expect(page.getByRole("heading", {name:"Remada em máquina com peito apoiado"})).toBeVisible();
  await expect(page.getByText(/Descanso · Bloco A/)).toHaveCount(0);
  await page.getByLabel(/Carga/).fill("30"); await page.getByLabel(/Reps/).fill("10"); await page.getByRole("button", {name:/Concluir e salvar/}).click();
  await expect(page.getByText(/Descanso · Bloco A · rodada 1/)).toBeVisible();
  await expect(page.getByRole("heading", {name:"Supino reto com barra"})).toBeVisible();
  await expect(page.getByText(/rodada 2 de/i).first()).toBeVisible();
});

test("cria plano A–G e monta um triset personalizado", async ({ page }) => {
  await onboarding(page);
  await page.getByRole("link", { name: /Meus planos/ }).first().click();
  await page.getByRole("button", { name: /Criar meu plano/ }).click();
  await page.getByLabel(/Como quer chamar/).fill("Hipertrofia livre");
  await page.getByLabel(/Fichas na rotação/).selectOption("7");
  await page.getByRole("button", { name: /Continuar para o construtor/ }).click();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await expect(page.getByRole("button", { name: /Treino G/ }).first()).toBeVisible();
  await page.getByRole("button", { name: /Continuar/ }).click();
  await page.getByRole("button", { name: /Bloco/ }).last().click();
  await page.getByRole("button", { name: /Adicionar exercício/ }).click();
  for (const name of ["Supino reto com barra", "Supino reto com halteres", "Supino inclinado com barra"]) {
    await page.getByLabel("Buscar exercício").fill(name);
    await page.getByRole("button", { name: `Adicionar ${name} ao bloco` }).click();
  }
  await page.getByRole("button", { name: "Concluir", exact: true }).click();
  await expect(page.getByText("Triset", { exact: true })).toBeVisible();
});

test("encerramento antecipado salva sessão parcial e deixa isso claro", async ({ page }) => {
  await onboarding(page); await page.getByRole("link", {name:/Preparar treino/}).click(); await page.getByRole("button", {name:/Iniciar treino A/}).click();
  await page.getByLabel(/Carga/).fill("20"); await page.getByLabel(/Reps/).fill("8"); await page.getByRole("button", {name:/Concluir e salvar/}).click();
  await page.getByRole("button", {name:"Finalizar"}).click();
  await expect(page.getByText(/1 de 12 séries realizadas/)).toBeVisible();
  await expect(page.getByRole("button", {name:/Salvar sessão parcial/})).toBeVisible();
  await page.getByRole("button", {name:/Finalizar sem cardio/}).click();
  await page.getByRole("button", {name:/Salvar sessão parcial/}).click();
  await expect(page).toHaveURL(/historico\?concluido=/);
  await expect(page.getByText(/Sessão parcial salva/)).toBeVisible();
});

test("shell e treino carregado continuam disponíveis offline", async ({ page, context }) => {
  test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Executado contra o container de produção com Service Worker.");
  await onboarding(page); await page.getByRole("link", {name:/Preparar treino/}).click(); await page.getByRole("button", {name:/Iniciar treino A/}).click();
  await expect(page).toHaveURL(/treinar\/sessao/); await expect(page.getByRole("button", {name:/Supino reto com barra/})).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(() => Boolean(navigator.serviceWorker?.controller), undefined, { timeout: 20_000 });
  await page.evaluate(async () => { const current = window as unknown as { serwist: { messageSW: (message: unknown) => Promise<unknown> } }; await current.serwist.messageSW({ type: "CACHE_URLS", payload: { urlsToCache: [location.pathname] } }); });
  await context.setOffline(true); await page.waitForFunction(() => !navigator.onLine); await expect(page.getByText(/Offline/).first()).toBeVisible(); await page.reload({waitUntil:"domcontentloaded"});
  await expect(page.getByRole("button", {name:/Supino reto com barra/})).toBeVisible();
});
