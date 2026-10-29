/** An error the receptionist should read: the message is shown as is, the status goes back to the browser. */
export class DomainError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * MySQL: duplicate key on room_nights.room_is_free, i.e. the room is already taken on one of those nights.
 * (1062 = ER_DUP_ENTRY; the key name is in the message, differently worded in MySQL and MariaDB.)
 */
export const isRoomTaken = (e: unknown) => {
  if (typeof e !== 'object' || e === null) return false;
  const x = e as { errno?: number; code?: string; message?: string };
  return (x.errno === 1062 || x.code === 'ER_DUP_ENTRY') && /room_is_free/.test(x.message ?? '');
};
