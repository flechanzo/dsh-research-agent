/** Explicit-directory repository for isolated/offline evaluations; never falls back to a workspace. */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { rubricCheckpointSchema, type RubricCheckpoint, type RubricCheckpointStore } from './checkpoints.ts'
export class FileRubricCheckpointStore implements RubricCheckpointStore {
  constructor(readonly directory: string) {
    if (!path.isAbsolute(directory))
      throw new Error('Rubric repository must be absolute')
  }
  private file(id: string, suffix: string): string {
    if (!/^[\w-]{1,128}$/u.test(id))
      throw new Error('Invalid assessment ID')
    return path.join(this.directory, id + suffix)
  }
  async acquire(id: string): Promise<() => Promise<void>> {
    await fs.mkdir(this.directory, { recursive: true })
    const lock = this.file(id, '.lock'), token = randomUUID()
    const handle = await fs.open(lock, 'wx') // Residual crash locks require explicit PID/ownership review.
    try {
      await handle.writeFile(JSON.stringify({ pid: process.pid, token, at: new Date().toISOString() }))
      await handle.sync()
    }
    finally {
      await handle.close()
    }
    return async () => {
      const owner = JSON.parse(await fs.readFile(lock, 'utf8')) as {
        token?: string
      }
      if (owner.token !== token)
        throw new Error('Rubric lease ownership changed')
      await fs.unlink(lock)
    }
  }
  async get(id: string): Promise<RubricCheckpoint | undefined> {
    try {
      return rubricCheckpointSchema.parse(JSON.parse(await fs.readFile(this.file(id, '.json'), 'utf8')))
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        return undefined
      throw error
    }
  }
  async put(row: RubricCheckpoint): Promise<void> {
    const target = this.file(row.id, '.json'), temp = target + '.' + randomUUID() + '.tmp'
    const handle = await fs.open(temp, 'wx')
    try {
      await handle.writeFile(JSON.stringify(rubricCheckpointSchema.parse(row)))
      await handle.sync()
    }
    finally {
      await handle.close()
    }
    try {
      await fs.rename(temp, target)
    }
    catch (error) {
      await fs.unlink(temp)
      throw error
    }
  }
}
