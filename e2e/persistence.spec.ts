import { test, expect, type Page } from '@playwright/test'

async function createAirline(page: Page, name = 'Merlion Air') {
  await page.goto('/')
  await page.getByPlaceholder('e.g. Merlion Air').fill(name)
  await page.getByRole('button', { name: 'Choose headquarters' }).click()
  await page.getByLabel('Search airports').fill('singapore')
  await page.getByRole('button', { name: /SIN/ }).click()
  await page.getByRole('button', { name: 'Launch airline' }).click()
  await expect(page.getByText('HQ · SIN')).toBeVisible()
}

/** Reads the raw saved record from IndexedDB, waiting until autosave has written one. */
async function readSave(page: Page): Promise<any> {
  await expect
    .poll(() => page.evaluate(() => new Promise<boolean>((res) => {
      const open = indexedDB.open('global-airline')
      open.onerror = () => res(false)
      open.onsuccess = () => {
        const db = open.result
        if (!db.objectStoreNames.contains('saves')) return res(false)
        const get = db.transaction('saves').objectStore('saves').get('main')
        get.onsuccess = () => res(!!get.result)
        get.onerror = () => res(false)
      }
    })), { timeout: 10_000 })
    .toBe(true)
  return page.evaluate(() => new Promise((res) => {
    const open = indexedDB.open('global-airline')
    open.onsuccess = () => {
      const get = open.result.transaction('saves').objectStore('saves').get('main')
      get.onsuccess = () => res(get.result.data)
    }
  }))
}

async function writeSave(page: Page, data: unknown) {
  await page.evaluate((d) => new Promise<void>((res) => {
    const open = indexedDB.open('global-airline')
    open.onsuccess = () => {
      const tx = open.result.transaction('saves', 'readwrite')
      tx.objectStore('saves').put({ id: 'main', data: d })
      tx.oncomplete = () => res()
    }
  }), data)
}

test('progress survives a refresh', async ({ page }) => {
  await createAirline(page, 'Persist Air')
  await page.getByRole('navigation').getByRole('button', { name: 'Market' }).click()
  await readSave(page)
  await page.reload()
  await expect(page.getByText('Persist Air').first()).toBeVisible()
  await expect(page.getByText('HQ · SIN')).toBeVisible()
  await expect(page.getByPlaceholder('e.g. Merlion Air')).toHaveCount(0)
})

test('a flight that ended while the browser was closed is reconciled on load, paid once', async ({ page }) => {
  await createAirline(page)
  const nav = page.getByRole('navigation')
  await nav.getByRole('button', { name: 'Airports' }).click()
  await page.getByLabel('Search airports').fill('kuala')
  await page.getByRole('button', { name: /KUL/ }).click()
  await page.getByRole('button', { name: /^Unlock ·/ }).click()
  await nav.getByRole('button', { name: 'Fleet' }).click()
  await page.locator('aside').first().getByRole('button', { name: /A220-100 #1/ }).click()
  await page.locator('button:not([disabled])', { hasText: /^Load$/ }).first().click()
  await page.getByLabel('Destination').selectOption('KUL')
  await page.getByRole('button', { name: 'Dispatch flight' }).click()
  await expect(page.getByRole('button', { name: /Follow on globe/ })).toBeVisible()

  // Wait for a save that contains the flight, then pretend the tab was closed for an hour.
  await expect.poll(async () => (await readSave(page)).game.aircraft[0].flight !== null).toBe(true)
  const save = await readSave(page)
  const hour = 3_600_000
  save.game.aircraft[0].flight.departedAt -= hour
  save.game.aircraft[0].flight.arrivesAt -= hour
  save.writerId = 'other-session'
  save.savedAt = 1
  await writeSave(page, save)
  await page.reload()

  await expect(page.getByText(/Welcome back: 1 flight landed/)).toBeVisible()
  await nav.getByRole('button', { name: 'Finances' }).click()
  await expect(page.getByText('Jobs delivered')).toBeVisible()
  await expect(page.getByText('Jobs delivered').locator('xpath=..').getByText('1', { exact: true })).toBeVisible()
})

test('a corrupt save is kept and offered for download, not overwritten', async ({ page }) => {
  await createAirline(page)
  const save = await readSave(page)
  save.game.airline = 'garbage'
  save.writerId = 'other'
  await writeSave(page, save)
  await page.reload()
  await expect(page.getByText("Your saved game can't be loaded")).toBeVisible()
  await expect(page.getByPlaceholder('e.g. Merlion Air')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Download unreadable save' })).toBeVisible()
  await page.waitForTimeout(1500)
  expect((await readSave(page)).game.airline).toBe('garbage')
  await page.getByRole('button', { name: 'Start a new airline…' }).click()
  await page.getByRole('button', { name: 'Yes, delete it and start fresh' }).click()
  await expect(page.getByPlaceholder('e.g. Merlion Air')).toBeVisible()
})

test('export, reset, then import restores the airline', async ({ page }) => {
  await createAirline(page, 'Export Air')
  await readSave(page)
  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export save' }).click()])
  const path = await download.path()

  await page.getByRole('button', { name: 'Reset airline…' }).click()
  await page.getByRole('button', { name: 'Yes, delete everything' }).click()
  await expect(page.getByPlaceholder('e.g. Merlion Air')).toBeVisible()

  await page.setInputFiles('input[type=file]', path)
  await expect(page.getByText('Save imported.')).toBeVisible()
  await expect(page.getByText('Export Air').first()).toBeVisible()
})

test('importing over an existing airline asks for confirmation first', async ({ page }) => {
  await createAirline(page, 'First Air')
  await readSave(page)
  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export save' }).click()])
  const path = await download.path()
  await page.setInputFiles('input[type=file]', path)
  await expect(page.getByText(/Replace your current airline with/)).toBeVisible()
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText(/Replace your current airline with/)).toHaveCount(0)
  await expect(page.getByText('First Air').first()).toBeVisible()
})

test('invalid import is rejected with a message and the game is untouched', async ({ page }) => {
  await createAirline(page, 'Safe Air')
  await page.getByRole('navigation').getByRole('button', { name: 'Settings' }).click()
  await page.setInputFiles('input[type=file]', { name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":true}') })
  await expect(page.getByText(/not a Global Airline save/)).toBeVisible()
  await expect(page.getByText('Safe Air').first()).toBeVisible()
})
