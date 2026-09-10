/** Short random ids with a readable prefix, e.g. res_3f9a1c2b7d4e. */
export const newId = (prefix: string) => prefix + globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 12);
