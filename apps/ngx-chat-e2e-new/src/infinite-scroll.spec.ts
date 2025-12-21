
import { test, expect } from '@playwright/test';
import { AppPage } from './page-objects/app.po';
import { ChatWindowPage } from './page-objects/chat-window.po';

test.describe('Infinite Scroll', () => {
    let snowWhite: AppPage;
    let sleepy: AppPage;
    let snowWhitePage: any;
    let sleepyPage: any;

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

    test('should load recent messages initially and older messages on scroll', async () => {
        const suffix = Date.now();
        const u1 = 'sw_' + suffix;
        const u2 = 'sl_' + suffix;
        const pass = 'password';

        // 1. Establish connection
        console.log(`Registering ${u1}...`);
        await snowWhite.register(u1, pass);
        // Register does not auto-login
        await snowWhite.logIn(u1, pass);
        await expect(snowWhitePage.locator('[data-zid="chat-connection-state"]')).toHaveText('connected');

        console.log(`Registering ${u2}...`);
        await sleepy.register(u2, pass);
        await sleepy.logIn(u2, pass);
        await expect(sleepyPage.locator('[data-zid="chat-connection-state"]')).toHaveText('connected');

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
        await sleepy.logIn(u2, pass);
        await expect(sleepyPage.locator('[data-zid="chat-connection-state"]')).toHaveText('connected');

        // 4. Sleepy opens chat
        await sleepy.openChatWithUnaffiliatedContact(u1Jid);
        const sleepyChat = new ChatWindowPage(sleepyPage, u1Jid);

        // 5. Verify only 50 messages loaded initially (approx)
        // We select message elements. 
        // Note: The UI might have rendered them. We verify count.
        await sleepyPage.waitForTimeout(2000); // Wait for initial load
        let messageCount = await sleepyPage.locator('.chat-window .messages ngx-chat-message-in, .chat-window .messages ngx-chat-message-out').count();
        console.log('Initial message count:', messageCount);

        expect(messageCount).toBeLessThanOrEqual(50);
        expect(messageCount).toBeGreaterThan(0);

        // 6. Scroll to top to trigger load
        console.log('Scrolling to top...');
        const messagesContainer = sleepyPage.locator('.chat-window .messages');
        await expect(messagesContainer).toBeVisible();

        // Scroll to top to trigger load
        await messagesContainer.evaluate((el) => {
            el.scrollTop = 0;
            // Dispatch event manually to ensure Angular catches it
            el.dispatchEvent(new Event('scroll'));
        });

        // 7. Wait and verify count increases
        await sleepyPage.waitForTimeout(3000);
        let newMessageCount = await sleepyPage.locator('.chat-window .messages ngx-chat-message-in, .chat-window .messages ngx-chat-message-out').count();
        console.log('New message count:', newMessageCount);

        expect(newMessageCount).toBeGreaterThan(messageCount);
        // Should be around 60 now
        expect(newMessageCount).toBeGreaterThanOrEqual(60);
    });
});
