/**
 * Régénère `inventory-extracted.json` et `inventory-items.csv` depuis l’API Clover.
 * Utilise :
 *   GET /v3/merchants/{mId}/categories?expand=items
 *   GET /v3/merchants/{mId}/items?expand=categories
 *
 *   CLOVER_MERCHANT_ID=... CLOVER_API_TOKEN=... CLOVER_ENV=sandbox npm run inventory:export
 *
 * CLOVER_ENV: sandbox (défaut) | production
 * CLOVER_REGION (si production): na | eu | la
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  buildInventoryExtractedFromMenu,
  buildInventoryItemsCsvFromMenu,
  loadMenuFromCloverConfig,
} from '../lib/services/clover-service'

const root = process.cwd()

const merchantId = process.env.CLOVER_MERCHANT_ID ?? ''
const apiToken = process.env.CLOVER_API_TOKEN ?? ''
const environment =
  process.env.CLOVER_ENV === 'production' ? 'production' : 'sandbox'
const apiRegion =
  process.env.CLOVER_REGION === 'eu' || process.env.CLOVER_REGION === 'la'
    ? process.env.CLOVER_REGION
    : 'na'

async function main(): Promise<void> {
  if (!merchantId || !apiToken) {
    console.error(
      'Variables requises: CLOVER_MERCHANT_ID, CLOVER_API_TOKEN (optionnel: CLOVER_ENV=sandbox|production)'
    )
    process.exit(1)
  }

  const result = await loadMenuFromCloverConfig({
    merchantId,
    apiToken,
    environment,
    apiRegion,
  })

  if (!result.success || !result.menu) {
    console.error(result.message ?? 'Echec API Clover')
    process.exit(1)
  }

  const extracted = buildInventoryExtractedFromMenu(result.menu)
  const csv = `\ufeff${buildInventoryItemsCsvFromMenu(result.menu)}`

  writeFileSync(
    join(root, 'inventory-extracted.json'),
    JSON.stringify(extracted, null, 2),
    'utf-8'
  )
  writeFileSync(join(root, 'inventory-items.csv'), csv, 'utf-8')

  console.log(
    `OK: inventory-extracted.json + inventory-items.csv (${extracted.counts.items} articles, ${extracted.counts.categories} categories)`
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
