'use client'

import type { ReactNode } from 'react'
import { SerwistProvider } from '@serwist/turbopack/react'

export function PwaProvider({ children }: { children: ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/serwist/sw.js"
      disable={process.env.NODE_ENV === 'development'}
    >
      {children}
    </SerwistProvider>
  )
}
