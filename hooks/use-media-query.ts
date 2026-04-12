'use client'

import { useLayoutEffect, useState } from 'react'

/** Évite les mismatches d’hydratation : false au premier rendu, puis valeur réelle après layout. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useLayoutEffect(() => {
    const mq = window.matchMedia(query)
    setMatches(mq.matches)
    const onChange = () => setMatches(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [query])

  return matches
}
