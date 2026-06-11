/**
 * Dev-only persistence of the loaded file across full page reloads (e.g. Vite
 * HMR full-reloads), so a developer doesn't re-drop the file on every reload.
 *
 * Scope is one tab session: the raw bytes live in IndexedDB (large files exceed
 * the ~5 MB string quota of sessionStorage once base64-inflated), but a marker
 * in sessionStorage gates restoration. sessionStorage survives reloads and dies
 * on tab close, so a reload re-hydrates while a fresh tab starts empty. Disabled
 * entirely in production builds.
 */

const ENABLED = import.meta.env.DEV;
const MARKER = "xerial:has-file";
const DB_NAME = "xerial";
const STORE = "files";
const KEY = "current";

export interface PersistedFile {
	name: string;
	bytes: Uint8Array;
}

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

function run<T>(
	mode: IDBTransactionMode,
	fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
	return openDb().then(
		(db) =>
			new Promise<T>((resolve, reject) => {
				const tx = db.transaction(STORE, mode);
				const req = fn(tx.objectStore(STORE));
				req.onsuccess = () => resolve(req.result);
				req.onerror = () => reject(req.error);
				tx.oncomplete = () => db.close();
			}),
	);
}

/** Persist the current file's bytes for this tab session. Best-effort. */
export async function savePersisted(name: string, bytes: Uint8Array): Promise<void> {
	if (!ENABLED) return;
	try {
		await run("readwrite", (s) => s.put({ name, bytes }, KEY));
		sessionStorage.setItem(MARKER, "1");
	} catch (e) {
		console.debug("xerial: failed to persist file", e);
	}
}

/** Restore the file saved earlier this tab session, or null. */
export async function loadPersisted(): Promise<PersistedFile | null> {
	if (!ENABLED || sessionStorage.getItem(MARKER) !== "1") return null;
	try {
		const rec = await run<PersistedFile | undefined>("readonly", (s) => s.get(KEY));
		if (rec?.bytes) return { name: rec.name, bytes: new Uint8Array(rec.bytes) };
	} catch (e) {
		console.debug("xerial: failed to restore file", e);
	}
	return null;
}

/** Forget the persisted file (e.g. on "New file"). */
export async function clearPersisted(): Promise<void> {
	if (!ENABLED) return;
	sessionStorage.removeItem(MARKER);
	try {
		await run("readwrite", (s) => s.delete(KEY));
	} catch (e) {
		console.debug("xerial: failed to clear persisted file", e);
	}
}
