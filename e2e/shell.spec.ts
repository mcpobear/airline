import { test, expect } from '@playwright/test'

test('create an airline, choose HQ, then unlock an airport', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(page.locator('canvas')).toBeVisible()

  // Step 1: name
  await page.getByPlaceholder('e.g. Merlion Air').fill('Merlion Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()

  // Step 2: HQ (multi-airport city shows each airport)
  await page.getByLabel('Search airports').fill('london')
  await expect(page.getByRole('button', { name: /LGW/ })).toBeVisible()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()

  // HUD reflects the new airline
  await expect(page.getByText('Merlion Air').first()).toBeVisible()
  await expect(page.getByText('HQ · SIN')).toBeVisible()
  await expect(page.getByText('$500.0k').first()).toBeVisible()
  await expect(page.getByText('Headquarters')).toBeVisible()

  // Unlock Kuala Lumpur from the Airports list
  await page.getByRole('navigation').getByRole('button', { name: 'Airports' }).click()
  await page.getByLabel('Search airports').fill('kuala')
  await page.getByRole('button', { name: /KUL/ }).click()
  const unlock = page.getByRole('button', { name: /^Unlock ·/ })
  await expect(unlock).toBeVisible()
  await unlock.click()
  await expect(page.getByText('Unlocked', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /^Unlock ·/ })).toHaveCount(0)
  await expect(page.getByText('2 of ')).toBeVisible()

  expect(errors).toEqual([])
})

test('airports too expensive to afford cannot be unlocked', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Tiny Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('HKT')
  await page.getByRole('button', { name: /HKT/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()
  // Unlock repeatedly until cash runs out; the button must then be disabled with a reason.
  await page.getByRole('navigation').getByRole('button', { name: 'Airports' }).click()
  for (const city of ['hong kong', 'tokyo', 'new york', 'london', 'paris', 'dubai', 'frankfurt', 'sydney']) {
    await page.getByLabel('Search airports').fill(city)
    await page.getByRole('button', { name: /^[A-Z]{3}\b/ }).first().click()
    const unlock = page.getByRole('button', { name: /^Unlock ·/ })
    if (await unlock.isDisabled()) {
      await expect(page.getByText(/more to unlock this airport/)).toBeVisible()
      return
    }
    await unlock.click()
  }
  throw new Error('cash never ran out; balance too generous for this test')
})

test('starter fleet, aircraft selection and buying an aircraft', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Merlion Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()

  // Two starter A220-100s with Singapore registrations
  await expect(page.getByText('2 aircraft')).toBeVisible()
  const cards = page.locator('aside').first().getByRole('button', { name: /A220-100 #\d/ })
  await expect(cards).toHaveCount(2)
  await expect(page.getByText(/9V-[A-Z]{3}/).first()).toBeVisible()

  // Selecting an aircraft opens its details
  await cards.first().click()
  await expect(page.getByText('Operating cost')).toBeVisible()
  await expect(page.getByText('Parked', { exact: true }).first()).toBeVisible()

  // Market: unaffordable aircraft are blocked with a reason; affordable ones can be bought
  await page.getByRole('navigation').getByRole('button', { name: 'Market' }).click()
  await expect(page.getByText('Need ', { exact: false }).first()).toBeVisible()
  await page.getByRole('button', { name: /^Buy · \$400\.0k/ }).click()
  await expect(page.getByText(/Delivered C909 #3/)).toBeVisible()
  await expect(page.getByText('$100.0k').first()).toBeVisible() // 500k - 400k

  await page.getByRole('navigation').getByRole('button', { name: 'Fleet' }).click()
  await expect(page.getByText('3 aircraft')).toBeVisible()
  expect(errors).toEqual([])
})

test('upcoming aircraft are hidden until enabled in settings', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Merlion Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()
  const nav = page.getByRole('navigation')
  await nav.getByRole('button', { name: 'Market' }).click()
  await expect(page.getByText('Boeing 777-9')).toHaveCount(0)
  await nav.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('switch', { name: /Upcoming aircraft/ }).click()
  await nav.getByRole('button', { name: 'Market' }).click()
  await expect(page.getByText('Boeing 777-9')).toBeVisible()
  await expect(page.getByText(/Not yet in service/).first()).toBeVisible()
})

test('jobs appear after unlocking, and can be loaded onto and unloaded from an aircraft', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Merlion Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()
  const nav = page.getByRole('navigation')

  // No jobs until a second airport exists
  await nav.getByRole('button', { name: 'Jobs' }).click()
  await expect(page.getByText('Unlock a second airport to start generating jobs.')).toBeVisible()

  await nav.getByRole('button', { name: 'Airports' }).click()
  await page.getByLabel('Search airports').fill('kuala')
  await page.getByRole('button', { name: /KUL/ }).click()
  await page.getByRole('button', { name: /^Unlock ·/ }).click()

  // Jobs board at HQ has jobs towards KUL. Individual jobs carry no deadline;
  // the board itself turns over on a clock, and the panel says when.
  await nav.getByRole('button', { name: 'Jobs' }).click()
  await expect(page.getByText(/\d+ waiting/)).toBeVisible()
  await expect(page.getByText('PAX').first()).toBeVisible()
  await expect(page.getByText(/→ KUL/).first()).toBeVisible()
  await expect(page.getByText(/These offers are replaced in/)).toBeVisible()
  await expect(page.getByText(/already loaded stays with your aircraft/)).toBeVisible()
  await expect(page.getByText(/deadline|hours left|expires in/i)).toHaveCount(0)

  // Load one job onto a starter aircraft, then unload it again
  await nav.getByRole('button', { name: 'Fleet' }).click()
  await page.locator('aside').first().getByRole('button', { name: /A220-100 #1/ }).click()
  await expect(page.getByText('Loaded jobs (0)')).toBeVisible()
  await page.locator('button:not([disabled])', { hasText: /^Load$/ }).first().click()
  await expect(page.getByText('Loaded jobs (1)')).toBeVisible()
  await expect(page.getByText('Revenue potential')).toBeVisible()
  await expect(page.getByText('Loading', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Unload' }).first().click()
  await expect(page.getByText('Loaded jobs (0)')).toBeVisible()
  expect(errors).toEqual([])
})

test('core loop: load, dispatch, fly on the globe, land and get paid', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.clock.install()
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Merlion Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()
  const nav = page.getByRole('navigation')
  await nav.getByRole('button', { name: 'Airports' }).click()
  await page.getByLabel('Search airports').fill('kuala')
  await page.getByRole('button', { name: /KUL/ }).click()
  await page.getByRole('button', { name: /^Unlock ·/ }).click()

  await nav.getByRole('button', { name: 'Fleet' }).click()
  await page.locator('aside').first().getByRole('button', { name: /A220-100 #1/ }).click()
  await page.locator('button:not([disabled])', { hasText: /^Load$/ }).first().click()
  await expect(page.getByText('Loaded jobs (1)')).toBeVisible()

  // Dispatch needs a destination, then shows the numbers before committing
  const dispatch = page.getByRole('button', { name: 'Dispatch flight' })
  await expect(dispatch).toBeDisabled()
  await page.getByLabel('Destination').selectOption('KUL')
  await expect(page.getByText('Flight time')).toBeVisible()
  await expect(page.getByText('Revenue on arrival')).toBeVisible()
  await expect(dispatch).toBeEnabled()
  await dispatch.click()

  // The aircraft is airborne and the planning UI is gone
  await expect(page.getByRole('button', { name: /Follow on map/ })).toBeVisible()
  await expect(page.getByText('SIN → KUL').first()).toBeVisible()
  await expect(dispatch).toHaveCount(0)
  await page.clock.fastForward(8_000)

  // Jump past the arrival time: it lands, delivers and pays
  await page.clock.fastForward('05:00')
  await expect(page.getByText(/landed at KUL: 1 job delivered/)).toBeVisible()
  await expect(page.getByText('Dispatch flight')).toBeVisible()
  await expect(page.getByText('Loaded jobs (0)')).toBeVisible()
  await expect(page.getByRole('button', { name: /Follow on map/ })).toHaveCount(0)
  expect(errors).toEqual([])
})

test('finances screen, selling an aircraft with confirmation, and no dev tools in production', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Money Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()
  const nav = page.getByRole('navigation')

  await nav.getByRole('button', { name: 'Finances' }).click()
  await expect(page.getByText('Lifetime revenue')).toBeVisible()
  await expect(page.getByText('By aircraft')).toBeVisible()
  await expect(page.getByText('Arrives in Phase')).toHaveCount(0)

  await nav.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByText('Developer tools')).toHaveCount(0)

  // Sell one of the two starter aircraft: needs a confirming second click
  await nav.getByRole('button', { name: 'Fleet' }).click()
  await page.locator('aside').first().getByRole('button', { name: /A220-100 #2/ }).click()
  await page.getByRole('button', { name: 'Sell…' }).click()
  await expect(page.getByText('2 aircraft')).toBeVisible() // nothing sold yet
  await page.getByRole('button', { name: /Confirm sale/ }).click()
  await expect(page.getByText(/Sold A220-100 #2/)).toBeVisible()
  await expect(page.getByText('1 aircraft')).toBeVisible()
  // The last aircraft can't be sold
  await page.locator('aside').first().getByRole('button', { name: /A220-100 #1/ }).click()
  await expect(page.getByRole('button', { name: 'Sell…' })).toBeDisabled()
  expect(errors).toEqual([])
})

test('a brand-new airline explains why there are no jobs and points to the nearest airport', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Hint Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()
  await expect(page.getByText('No jobs yet — you need somewhere to fly to.')).toBeVisible()
  await page.getByRole('button', { name: /^Show / }).click()
  await page.getByRole('button', { name: /^Unlock ·/ }).click()
  await expect(page.getByText('No jobs yet — you need somewhere to fly to.')).toHaveCount(0)
})

test('load-all fills an aircraft with one destination in a single click', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Bulk Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()
  const nav = page.getByRole('navigation')
  await nav.getByRole('button', { name: 'Airports' }).click()
  await page.getByLabel('Search airports').fill('kuala')
  await page.getByRole('button', { name: /KUL/ }).click()
  await page.getByRole('button', { name: /^Unlock ·/ }).click()

  await nav.getByRole('button', { name: 'Fleet' }).click()
  await page.locator('aside').first().getByRole('button', { name: /A220-100 #1/ }).click()
  await expect(page.getByText('Loaded jobs (0)')).toBeVisible()

  // Every waiting job at SIN is bound for KUL at this point, so one chip is offered.
  await expect(page.getByText('Load all bound for')).toBeVisible()
  await page.getByRole('button', { name: /^KUL/ }).first().click()
  await expect(page.getByText(/Loaded \d+ (job|of)/)).toBeVisible()
  await expect(page.getByText(/^Loaded jobs \((?!0\))\d+\)/)).toBeVisible()
})

test('the world style can be changed, and the music muted', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Switch Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()

  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click()
  await expect(page.locator('canvas')).toBeVisible()
  const relief = page.getByRole('button', { name: 'Relief globe' })
  await expect(relief).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Night routes' }).click()
  await expect(page.getByRole('button', { name: 'Night routes' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('canvas')).toBeVisible()
  await page.reload() // the choice is remembered in this browser
  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('button', { name: 'Night routes' })).toHaveAttribute('aria-pressed', 'true')

  const mute = page.getByRole('button', { name: 'Mute lounge music' })
  await expect(mute).toBeVisible()
  await mute.click()
  await expect(page.getByRole('button', { name: 'Play lounge music' })).toBeVisible()
  expect(errors).toEqual([])
})

test('the panels always clear the heads-up display, however it wraps', async ({ page }) => {
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Merlion Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()
  await expect(page.getByText('HQ · SIN')).toBeVisible()

  // Narrow enough that the stat cards wrap onto a second row, which is what
  // used to leave the HUD sitting over the top of the panel.
  for (const width of [1600, 900, 820]) {
    await page.setViewportSize({ width, height: 760 })
    const hud = await page.getByRole('banner').boundingBox()
    const panel = await page.getByRole('heading', { name: 'Fleet' }).locator('..').boundingBox()
    expect(hud, `banner at ${width}px`).not.toBeNull()
    expect(panel, `panel at ${width}px`).not.toBeNull()
    expect(panel!.y, `panel must start below the HUD at ${width}px`).toBeGreaterThanOrEqual(
      hud!.y + hud!.height,
    )
  }
})

test('on a phone the navigation sits at the bottom and the panel can be put away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill('Pocket Air')
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()

  const nav = page.getByRole('navigation')
  const navBox = await nav.boundingBox()
  expect(navBox!.y, 'navigation should be along the bottom').toBeGreaterThan(844 / 2)
  expect(navBox!.width, 'navigation should span the width').toBeGreaterThan(300)

  // The panel covers the map, so tapping the open tab puts it away again.
  const fleetTab = nav.getByRole('button', { name: 'Fleet' })
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible()

  // The opening hint floats over the whole screen, so it has to stand aside
  // while a panel is open rather than sitting on top of the controls.
  const hint = page.getByText('No jobs yet', { exact: false })
  await expect(hint).toBeHidden()
  await fleetTab.click()
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeHidden()
  // Escape clears the airport left selected by choosing a headquarters, which
  // also keeps the hint out of the way while it is showing.
  await page.keyboard.press('Escape')
  await expect(hint).toBeVisible()
  await page.getByRole('status').getByRole('button', { name: 'Dismiss hint' }).click()
  await expect(hint).toBeHidden()
  await fleetTab.click()
  await expect(page.getByRole('heading', { name: 'Fleet' })).toBeVisible()

  // Nothing may push the layout wider than the screen: a sideways scroll on a
  // phone leaves controls off the edge with no way to reach them.
  for (const [section, heading] of [
    ['Jobs', 'Jobs'],
    ['Market', 'Aircraft Market'],
    ['Finances', 'Finances'],
    ['Settings', 'Settings'],
  ]) {
    await nav.getByRole('button', { name: section }).click()
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }))
    expect(overflow.scroll, `${section} must not scroll sideways`).toBeLessThanOrEqual(overflow.client)
  }
})
