#!/usr/bin/env node
// Keeps src/pages/404.astro in lockstep with src/pages/room/[...id].astro.
// Astro SSG emits /room (no id) from [...id].astro, and Cloudflare serves
// 404.astro as fallback for all other /room/:id URLs — so both files need
// the same script/template/styles.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, '../src/pages/room/[...id].astro')
const target = resolve(here, '../src/pages/404.astro')

const src = readFileSync(source, 'utf8')

// Strip the getStaticPaths line — it only applies to the dynamic route.
const synced = src.replace(
  /^export const getStaticPaths.*$\n?/m,
  ''
)

writeFileSync(target, synced)
console.log(`synced ${target}`)
