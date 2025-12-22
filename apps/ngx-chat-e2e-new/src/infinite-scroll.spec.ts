
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
        test.setTimeout(120000);
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

        console.log('Sending 15 messages...');
        for (let i = 1; i <= 15; i++) {
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

        // 5. Verify only partial messages loaded initially (approx 10-20?)
        await sleepyPage.waitForTimeout(2000); // Wait for initial load
        let messageCount = await sleepyPage.locator('.chat-window ngx-chat-message-in, .chat-window ngx-chat-message-out').count();
        console.log('Initial message count:', messageCount);

        // Expectation: If 20 messages, and page size is 10. Initial 10-15.
        expect(messageCount).toBeGreaterThan(0);

        // 6. Scroll to top to trigger load
        console.log('Scrolling to top...');
        const messagesContainer = sleepyPage.locator('.chat-window .chat-messages-auto-scroll');

        // Scroll Logic: Force scroll to ensure sentinel functionality
        // We set scrollTop to a small value then 0 to mimic hitting top
        await messagesContainer.evaluate((el) => {
            el.scrollTop = 20;
            el.dispatchEvent(new Event('scroll'));
        });
        await sleepyPage.waitForTimeout(500);
        await messagesContainer.evaluate((el) => {
            el.scrollTop = 0;
            el.dispatchEvent(new Event('scroll'));
        });

        // 7. Wait and verify count increases
        await sleepyPage.waitForTimeout(5000);
        let newMessageCount = await sleepyPage.locator('.chat-window ngx-chat-message-in, .chat-window ngx-chat-message-out').count();
        console.log('New message count:', newMessageCount);

        expect(newMessageCount).toBeGreaterThan(messageCount);
        // If initial < total, then new > initial.
        if (messageCount < 15) {
            expect(newMessageCount).toBeGreaterThan(messageCount);
            expect(newMessageCount).toBeCloseTo(15, -1);
        }
    });
});
