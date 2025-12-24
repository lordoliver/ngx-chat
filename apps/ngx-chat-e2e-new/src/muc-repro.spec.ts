import { test, expect } from '@playwright/test';
import { EjabberdAdminPage } from './page-objects/ejabberd-admin.po';
import { AppPage } from './page-objects/app.po';
import { devXmppDomain, devXmppJid, devXmppPassword } from '../secrets';

test('MUC messages should be delivered to all participants', async ({ browser, playwright }) => {
    // 1. Provision Users
    const ejabberdAdminPage = await EjabberdAdminPage.create(playwright, devXmppDomain, devXmppJid, devXmppPassword);
    await ejabberdAdminPage.register('snowwhite', 'snowwhite');
    await ejabberdAdminPage.register('sleepy', 'sleepy');

    // 2. Load SnowWhite (Owner)
    const snowWhitePage = await AppPage.create(browser);
    await snowWhitePage.setupForTest();
    await snowWhitePage.logIn('snowwhite', 'snowwhite');

    // 3. Load Sleepy (Participant)
    const sleepyPage = await snowWhitePage.newPage();
    await sleepyPage.logIn('sleepy', 'sleepy');

    const connectionStateSelector = '[data-zid="chat-connection-state"]';
    await expect(snowWhitePage.page.locator(connectionStateSelector)).toHaveText('online', { timeout: 15000 });
    await expect(sleepyPage.page.locator(connectionStateSelector)).toHaveText('online', { timeout: 15000 });

    const roomName = `e2e-muc-${Date.now()}`;
    const roomJid = `${roomName}@conference.${devXmppDomain}`;

    // 4. Create Room (SnowWhite) -> Default is Members-Only
    const snowMuc = snowWhitePage.createMUCPageObject();
    await snowMuc.createRoom(roomName, 'snowwhite');

    // 5. Grant Membership & Invite (Required for secure Closed Rooms)
    const sleepyJid = `sleepy@${devXmppDomain}`;
    await snowMuc.selectRoom(roomName);
    await snowMuc.grantMembership(sleepyJid, roomName);
    await snowMuc.inviteUser(sleepyJid, roomName);

    // 6. Sleepy joins
    const sleepyMuc = sleepyPage.createMUCPageObject();
    await sleepyMuc.acceptInvite(roomName);

    // 7. Open Sleepy's chat and wait for join to complete
    // Since MUC history is not reliable in this env, we must be joined and listening usually.
    // Although XMPP should queue if joined, we want to be sure.
    const sleepyChat = await sleepyPage.openChatWith(roomName);
    await sleepyPage.page.waitForTimeout(5000); // Give generous time for MUC presence to propagate

    // 8. Messaging (Live)
    const snowChat = await snowWhitePage.openChatWith(roomName);
    const uiMsg = 'UI_SEND_MSG';
    await snowChat.write(uiMsg);

    // Sleepy should see it live
    await sleepyChat.waitForMessageCount(1);
    await sleepyChat.assertLastMessage(uiMsg);

});
