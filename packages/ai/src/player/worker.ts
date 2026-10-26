// The player's own modder's worker (localModder.ts, docs/byok.md): made by the page when the player has chosen a
// model, handed the game as data and the key once. What it keeps it keeps in this browser's storage, apart from
// the saves (a database of its own).

// the engine's official modules, which a game's ontology may name (their primitives judge a patch)
import '@openworld/modules'
import { LocalModder, type ModderStore, type StoreKey } from './localModder.ts'
import type { FromModder, ToModder } from '@openworld/runtime/src/modderProtocol.ts'

const DB = 'lsw-modder'
const STORE = 'kv'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function run<T>(mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        const tx = db.transaction(STORE, mode)
        const r = act(tx.objectStore(STORE))
        tx.oncomplete = () => resolve(r ? r.result : undefined)
        tx.onerror = () => resolve(undefined)
      }),
    // (storage blocked: the modder keeps nothing past this page)
    () => undefined,
  )
}

const store: ModderStore = {
  get: <T>(key: StoreKey) => run<T>('readonly', (s) => s.get(key) as IDBRequest<T>),
  set: async (key, value) => void (await run('readwrite', (s) => void s.put(value, key))),
  del: async (key) => void (await run('readwrite', (s) => void s.delete(key))),
}

const scope = self as unknown as { postMessage(m: FromModder): void; onmessage: ((e: MessageEvent<ToModder>) => void) | null }
const host = new LocalModder({ store, post: (m) => scope.postMessage(m), log: (line) => console.info(`[modder] ${line}`) })
scope.onmessage = (e) => void host.handle(e.data)
