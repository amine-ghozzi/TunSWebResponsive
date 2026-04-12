import type { MetadataRoute } from 'next'
import manifestJson from '../public/manifest.json'

export default function manifest(): MetadataRoute.Manifest {
  return manifestJson as MetadataRoute.Manifest
}
