import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

/** Explicit data directories have exactly one Host writer. Existing leases fail closed, including after crashes. */
export function acquireDataWriter(directory: string): () => void {
  mkdirSync(directory, { recursive: true })
  const file = join(directory, '.research-writer.lock')
  const token = randomUUID()
  let fd: number
  try { fd = openSync(file, 'wx') } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    throw new Error('Research data directory already has a writer lease: ' + file + '. After a crash, verify that the recorded Host has exited before manually removing this stale lease.')
  }
  try { writeFileSync(fd, JSON.stringify({ token, pid: process.pid, createdAt: new Date().toISOString() })) }
  catch (error) { closeSync(fd); unlinkSync(file); throw error }
  let released = false
  return () => {
    if (released) return
    closeSync(fd)
    const row = JSON.parse(readFileSync(file, 'utf8')) as { token?: string }
    if (row.token !== token) throw new Error('Research writer lease ownership changed')
    unlinkSync(file)
    released = true
  }
}
