import { defineConfig } from 'vitest/config'
import {fileURLToPath} from 'node:url'
export default defineConfig({resolve:{alias:{'@deepseek-ai/dsh-client-ui-primitives':fileURLToPath(new URL('./tests/support/ui-primitives.tsx',import.meta.url))}},test:{include:['tests/**/*.spec.{ts,tsx}'],testTimeout:15000}})
