// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test';
import { AppPage } from './page-objects/app.po';
import { generateUser } from './utils/user-helper';

import { EjabberdAdminPage } from './page-objects/ejabberd-admin.po';
import {
  devXmppDomain,
  devXmppJid,
  devXmppPassword,
} from '../secrets';

test.describe('ngx-chat', () => {
  let ass = '';
  let duty = '';

  let appPage: AppPage;
  let ejabberdAdminPage: EjabberdAdminPage;

  test.beforeAll(async ({ browser, playwright }) => {
    appPage = await AppPage.create(browser);
    ejabberdAdminPage = await EjabberdAdminPage.create(
      playwright,
      devXmppDomain,
      devXmppJid,
      devXmppPassword
    );

    // Dynamic users per suite (tests share state)
    ass = generateUser('arsch');
    duty = generateUser('dienst');

    await appPage.setupForTest();
    await ejabberdAdminPage.register(ass, ass);
    await ejabberdAdminPage.register(duty, duty);
  });

  test.afterAll(async () => {
    await appPage.page.goto('about:blank').catch(() => { });
  });

  test('should be able to block the ass as duty', async () => {
    await appPage.logIn(ass, ass);
    const chat = await appPage.openChatWithUnaffiliatedContact(duty);
    await chat.write('I fart in your general direction');
    await appPage.logOut();

    await appPage.logIn(duty, duty);
    expect(await appPage.isContactInRoster(ass)).toBeTruthy();
    await appPage.openChatWith(ass);
    // await dutysChatWithAss.block();
    await appPage.blockContact(ass);
    await expect(async () => {
      expect(await appPage.isContactInBlockedList(ass)).toBeTruthy();
    }).toPass({ timeout: 10000 });
    expect(await appPage.isContactInUnaffiliatedList(ass)).toBeFalsy();
    await appPage.logOut();
  });

  test('should no longer be able to write as ass to duty', async () => {
    const message = 'FART!';
    await appPage.logIn(ass, ass);
    const chat = await appPage.openChatWith(duty);
    await chat.write(message);
    await appPage.logOut();

    await appPage.logIn(duty, duty);
    await expect(async () => {
      expect(await appPage.isContactInBlockedList(ass)).toBeTruthy();
    }).toPass({ timeout: 10000 });
    expect(await appPage.isContactInUnaffiliatedList(ass)).toBeFalsy();

    const window = await appPage.openChatWith(ass);
    await window.assertLastMessageIsNot(message);
    await appPage.logOut();
  });

  test('should be able to unblock the ass as duty', async () => {
    await appPage.logIn(duty, duty);
    await appPage.unblockContact(ass);

    // Verify removed from blocked list
    await expect(async () => {
      expect(await appPage.isContactInBlockedList(ass)).toBeFalsy();
    }).toPass({ timeout: 10000 });

    await appPage.logOut();

    // As proof of unblocking, Ass sends a message and Duty should receive it
    const msg = 'I am back!';
    await appPage.logIn(ass, ass);
    const chat = await appPage.openChatWith(duty);
    await chat.write(msg);
    await appPage.logOut();

    await appPage.logIn(duty, duty);
    const dutyChat = await appPage.openChatWith(ass);
    await dutyChat.assertLastMessage(msg, 'incoming');
    await appPage.logOut();
  });

  test('should keep unblocked contacts as such', async () => {
    // This test is somewhat redundant with the logic above, but verifies persistence
    await appPage.logIn(duty, duty);
    expect(await appPage.isContactInBlockedList(ass)).toBeFalsy();
    await appPage.logOut();
  });
});
