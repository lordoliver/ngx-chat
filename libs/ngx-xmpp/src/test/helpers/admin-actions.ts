// SPDX-License-Identifier: AGPL-3.0-or-later
import {
  deleteOldMamMessages,
  destroyRoom,
  getMucRooms,
  register,
  registeredUsers,
  unregister,
  unregisterUnsafe,
} from './ejabberd-client';
import type { AuthRequest } from '@pazznetwork/ngx-chat-shared';
// const devXmppDomain = 'localhost';
const devXmppDomain = 'local-jabber.entenhausen.pazz.de';

export async function userIsRegistered(auth: AuthRequest): Promise<boolean> {
  const users = await registeredUsers();
  return users ? users.includes(auth.username) : false;
}

export async function ensureNoRegisteredUser(auth: AuthRequest): Promise<void> {
  if (await userIsRegistered(auth)) {
    await unregister(auth);
  }
}

export async function unregisterAllBesidesAdmin(domain = devXmppDomain): Promise<void> {
  const users = await registeredUsers();
  const testPrefixes = ['hero', 'villain', 'princess', 'father', 'friend', 'test'];
  const usersToUnregister = users?.filter((user) =>
    !user.includes('admin') &&
    testPrefixes.some(prefix => user.startsWith(prefix))
  );

  if (usersToUnregister && usersToUnregister.length > 50) {
    console.warn(`[Cleanup] Warn: Found ${usersToUnregister.length} test users to delete. This might take a while.`);
  }

  for (const user of usersToUnregister) {
    await unregisterUnsafe({ username: user, domain });
  }
}

export async function destroyAllRooms(): Promise<void> {
  const rooms = await getMucRooms();
  for (const room of rooms) {
    const [name, service] = room.split('@');
    await destroyRoom(name as string, service);
  }
}

export async function cleanServerBesidesAdmin(): Promise<void> {
  await unregisterAllBesidesAdmin();
  await destroyAllRooms();
}

export async function ensureRegisteredUser(auth: AuthRequest): Promise<void> {
  if (await userIsRegistered(auth)) {
    return;
  }
  await register(auth);
}

export async function deleteMamChatMessages(): Promise<void> {
  await deleteOldMamMessages();
}
