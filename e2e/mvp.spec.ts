import { expect, test, type Page } from '@playwright/test'

/*
 * Fluxo do MVP de ponta a ponta, no build de produção e com WebGL real:
 * abrir a rede, selecionar um troço, adicionar/mover/remover uma portagem, alterar o preço,
 * iniciar e pausar o tráfego, ver cobranças, guardar dois cenários e comparar os resultados.
 */

/** Recolhe erros da consola e da página, para garantir que o fluxo corre sem erros. */
function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`)
  })
  return errors
}

const panel = (page: Page) => page.getByRole('complementary', { name: 'Painel lateral' })
const dock = (page: Page) => page.getByRole('toolbar', { name: 'Controlos da simulação' })

async function openPenafielToll(page: Page) {
  await page.getByRole('button', { name: 'Porto', exact: true }).click()
  await panel(page).getByRole('button', { name: /A4.*Penafiel/ }).click()
  await expect(panel(page).getByRole('heading', { name: 'Porto – Penafiel' })).toBeVisible()
  await panel(page).getByRole('button', { name: /Pórtico A4 Porto – Penafiel/ }).click()
  await expect(panel(page).getByRole('heading', { name: 'Pórtico A4 Porto – Penafiel' })).toBeVisible()
}

async function setTariff(page: Page, euros: string) {
  const field = panel(page).getByRole('textbox', { name: /Valor exato \(Classe 1\)/ })
  await field.fill(euros)
  await field.blur()
}

async function saveScenario(page: Page, name: string) {
  await page.getByRole('button', { name: /Cenário atual/ }).click()
  await panel(page).getByLabel('Nome do novo cenário').fill(name)
  await panel(page).getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(page.getByRole('button', { name: /Cenário atual/ })).toContainText(name)
}

test('fluxo completo do MVP', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('/')

  // 1. A rede abre: mapa WebGL desenhado, aviso de natureza do mapa e visão geral com resultados.
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByText(/Cidades em posições reais/)).toBeVisible()
  await expect(page.getByText('Portagens ativas').locator('..')).toContainText('5')
  await expect(page.getByText('Receita bruta do período').locator('..')).toContainText('€')
  // O R3F dimensiona o canvas depois de medir o contentor (começa com 300×150).
  await expect.poll(async () => (await page.locator('canvas').boundingBox())?.width ?? 0).toBeGreaterThan(800)

  // 2. Selecionar um troço e o seu pórtico; alterar o preço (com validação).
  await openPenafielToll(page)
  await setTariff(page, '-2')
  await expect(panel(page).getByText(/C1: 2,10\s€/)).toBeVisible()
  await setTariff(page, '6,50')
  await expect(panel(page).getByText(/C1: 6,50\s€/)).toBeVisible()

  // 3. Mover a portagem ao longo do troço (teclado no slider de posição).
  const position = panel(page).getByRole('slider', { name: /Posição no troço/ })
  await position.focus()
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight')
  await expect(position).toHaveAttribute('aria-valuetext', '60 %')

  // 4. Adicionar e remover uma portagem noutro troço (e anular a remoção).
  await panel(page).getByRole('button', { name: /No troço/ }).click()
  await page.getByRole('button', { name: 'Voltar à visão geral' }).click()
  await page.getByRole('button', { name: 'Braga', exact: true }).click()
  await panel(page).getByRole('button', { name: /N101.*Guimarães/ }).click()
  await panel(page).getByRole('button', { name: 'Adicionar portagem neste troço' }).click()
  await expect(panel(page).getByRole('heading', { name: 'Pórtico N101 Braga – Guimarães' })).toBeVisible()
  await panel(page).getByRole('button', { name: 'Remover pórtico' }).click()
  await expect(page.getByText('Pórtico removido.')).toBeVisible()
  await expect(page.getByText('Portagens ativas').locator('..')).toContainText('de 6 pórticos')

  // 5. Guardar o primeiro cenário (A4 a 6,50 €).
  await saveScenario(page, 'A4 cara')

  // 6. Iniciar o tráfego a 4x, ver cobranças a acontecer e pausar.
  await dock(page).getByRole('button', { name: 'Velocidade 4x' }).click()
  await dock(page).getByRole('button', { name: 'Iniciar simulação', exact: true }).click()
  await expect(dock(page)).toContainText('Em curso')
  await expect(dock(page)).toContainText(/[1-9]\d* em circulação/, { timeout: 20_000 })
  await expect(dock(page)).toContainText(/[1-9][\d\s]*,\d\d\s€ cobrados/, { timeout: 20_000 })
  await dock(page).getByRole('button', { name: 'Pausar simulação' }).click()
  await expect(dock(page)).toContainText('Em pausa')
  const clock = await dock(page).getByLabel('Hora simulada').textContent()
  expect(clock).not.toBe('08:00')

  // 7. Segundo cenário: repor as tarifas iniciais e guardar.
  await page.getByRole('button', { name: 'Voltar ao mapa' }).click()
  await page.getByRole('button', { name: 'Repor configuração' }).click()
  await saveScenario(page, 'Inicial')

  // 8. Comparar os dois cenários.
  const checkboxes = panel(page).getByRole('checkbox', { name: /Comparar/ })
  await checkboxes.nth(0).check()
  await checkboxes.nth(1).check()
  const table = panel(page).getByRole('table')
  await expect(panel(page).getByText(/Comparação: A “A4 cara” → B “Inicial”/)).toBeVisible()
  await expect(panel(page).getByText('1 pórtico difere entre os cenários.')).toBeVisible()
  await expect(table.getByRole('row', { name: /Receita bruta/ })).toContainText('€')
  await expect(panel(page).getByText('Estes cenários não são comparáveis.')).toHaveCount(0)

  // 9. Os cenários sobrevivem a um recarregamento (persistência local).
  await page.reload()
  await page.getByRole('button', { name: /Cenário atual/ }).click()
  await expect(panel(page).getByText('Guardados (2)')).toBeVisible()

  await page.screenshot({ path: 'test-results/mvp-final.png' })
  expect(errors).toEqual([])
})

test('dados guardados corrompidos não bloqueiam o arranque', async ({ page }) => {
  const errors = watchErrors(page)
  await page.addInitScript(() => window.localStorage.setItem('tolllab:scenarios', '{isto não é JSON'))
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  await page.getByRole('button', { name: /Cenário atual/ }).click()
  await expect(panel(page).getByRole('alert')).toContainText(/corrompidos/)
  expect(errors).toEqual([])
})

test('controlos essenciais acessíveis só com o teclado', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: /Cenário atual/ })).toBeFocused()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  await expect(page.getByRole('application', { name: 'Mapa interativo da rede' })).toBeFocused()
  // Zoom e recentrar pelo teclado, sem erros.
  await page.keyboard.press('+')
  await page.keyboard.press('0')
  await page.keyboard.press('Escape')
})

test.describe('movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' })
  test('a aplicação funciona com prefers-reduced-motion', async ({ page }) => {
    const errors = watchErrors(page)
    await page.goto('/')
    await expect(page.locator('canvas')).toBeVisible()
    await page.getByRole('button', { name: 'Recentrar mapa' }).click()
    await dock(page).getByRole('button', { name: 'Iniciar simulação', exact: true }).click()
    await expect(dock(page)).toContainText('Em curso')
    expect(await page.evaluate(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    expect(errors).toEqual([])
  })
})
