
import { test, expect } from '@playwright/test';
import { AppPage } from './page-objects/app.po';
import { ChatWindowPage } from './page-objects/chat-window.po';
import { EjabberdAdminPage } from './page-objects/ejabberd-admin.po';

test.describe('Infinite Scroll', () => {
    let snowWhite: AppPage;
    let sleepy: AppPage;
    let snowWhitePage: any;
    let sleepyPage: any;
    let ejabberdAdminPage: EjabberdAdminPage;

    test.beforeAll(async ({ playwright }) => {
        ejabberdAdminPage = await EjabberdAdminPage.create(playwright);
        await ejabberdAdminPage.deleteAllBesidesAdminUser();
    });

    test.beforeEach(async ({ browser }) => {
        snowWhite = await AppPage.create(browser);
        sleepy = await AppPage.create(browser);
        snowWhitePage = snowWhite.page;
        sleepyPage = sleepy.page;

        await snowWhite.setupForTest();
        await sleepy.setupForTest();
    });

    test.afterEach(async () => {
        await snowWhitePage.close();
        await sleepyPage.close();
    });

    test.afterAll(() => ejabberdAdminPage.deleteAllBesidesAdminUser());

    test('should load recent messages initially and older messages on scroll', async () => {
        const suffix = Date.now();
        const u1 = 'sw_' + suffix;
        const u2 = 'sl_' + suffix;
        const pass = 'password';

        // 1. Establish connection
        console.log(`Registering ${u1}...`);
        await ejabberdAdminPage.register(u1, pass);
        // Login directly
        await snowWhite.logIn(u1, pass);
        await expect(snowWhitePage.locator('[data-zid="chat-connection-state"]')).toHaveText('online');

        console.log(`Registering ${u2}...`);
        await ejabberdAdminPage.register(u2, pass);
        await sleepy.logIn(u2, pass);
        await expect(sleepyPage.locator('[data-zid="chat-connection-state"]')).toHaveText('online');

        // 2. SnowWhite creates history (60 messages)
        await snowWhitePage.waitForTimeout(1000); // Wait for roster sync
        // Use selectChatWithContact or openChatWith
        // Note: sleepyJid will depend on u2
        const u2Jid = `${u2}@local-jabber.entenhausen.pazz.de`;
        const u1Jid = `${u1}@local-jabber.entenhausen.pazz.de`; // Snow white JID

        console.log(`SnowWhite adding ${u2Jid}...`);
        await snowWhite.addContact(u2Jid);
        await snowWhite.selectChatWithContact(u2Jid);

        const chatWindow = new ChatWindowPage(snowWhitePage, u2Jid);

        console.log('Sending 60 messages...');
        for (let i = 1; i <= 60; i++) {
            await chatWindow.write(`History Message ${i}`);
        }

        // Allow time for Sleepy (currently connected) to receive them, 
        // ensuring they are archived on server.
        await sleepyPage.waitForTimeout(2000);

        // 3. Sleepy reloads to test fresh history loading
        console.log('Reloading Sleepy...');
        await sleepyPage.reload();
        await sleepy.setupForTest(); // Ensure domain/service are set
        await sleepy.logIn(u2, pass);
        await expect(sleepyPage.locator('[data-zid="chat-connection-state"]')).toHaveText('online');

        // 4. Sleepy opens chat
        await sleepy.openChatWithUnaffiliatedContact(u1Jid);
        const sleepyChat = new ChatWindowPage(sleepyPage, u1Jid);

        // 5. Verify only 50 messages loaded initially (approx)
        // Using poll to wait for messages to load
        await expect.poll(async () => await sleepyChat.getMessageCount(), { timeout: 10000 }).toBeGreaterThan(0);
        let messageCount = await sleepyChat.getMessageCount();
        console.log('Initial message count:', messageCount);

        expect(messageCount).toBeLessThanOrEqual(50);

        // 6. Scroll to top to trigger load
        console.log('Scrolling to top...');
        await sleepyChat.scrollToTop();

        // 7. Wait and verify count increases
        await expect.poll(async () => await sleepyChat.getMessageCount(), { timeout: 10000 }).toBeGreaterThan(messageCount);
        let newMessageCount = await sleepyChat.getMessageCount();
        console.log('New message count:', newMessageCount);

        expect(newMessageCount).toBeGreaterThan(messageCount);
        // Should be around 60 now
        expect(newMessageCount).toBeGreaterThanOrEqual(60);
    });
});
