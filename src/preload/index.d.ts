import type { PrismaApi } from '@shared/types'

declare global {
  interface Window {
    nexus: PrismaApi
  }
}

export {}
