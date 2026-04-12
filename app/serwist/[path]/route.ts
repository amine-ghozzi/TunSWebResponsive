import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createSerwistRoute } from '@serwist/turbopack'

function getRevision(): string {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' })
  if (r.status === 0 && r.stdout?.trim()) {
    return r.stdout.trim()
  }
  return randomUUID()
}

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [{ url: '/~offline', revision: getRevision() }],
    swSrc: 'app/sw.ts',
    useNativeEsbuild: true,
  })
