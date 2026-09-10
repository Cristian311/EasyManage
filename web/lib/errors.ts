/** An error the receptionist should read: the message is shown as is, the status goes back to the browser. */
export class DomainError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** PostgreSQL: exclusion constraint violated, i.e. the room is taken on those nights. */
export const isRoomTaken = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === '23P01';
