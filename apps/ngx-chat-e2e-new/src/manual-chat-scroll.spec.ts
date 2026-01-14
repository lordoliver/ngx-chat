
import { test, expect } from '@playwright/test';
import { AppPage } from './page-objects/app.po';
import { ChatWindowPage } from './page-objects/chat-window.po';
import { EjabberdAdminPage } from './page-objects/ejabberd-admin.po';

test.describe('Manual Chat (Big Box) Scroll', () => {
    let snowWhite: AppPage;
    let sleepy: AppPage;
    let snowWhitePage: any;
    let sleepyPage: any;

    test.beforeEach(async ({ browser, playwright }) => {
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

    test('should open Big Box only and load older messages on scroll', async ({ playwright }) => {
        test.setTimeout(120000);
        const suffix = Date.now();
        const u1 = 'sw_m_' + suffix; // use different prefix to differentiate in logs
        const u2 = 'sl_m_' + suffix;
        const pass = 'password';

        // Provision users
        const ejabberdAdmin = await EjabberdAdminPage.create(playwright);
        await ejabberdAdmin.register(u1, pass);
        await ejabberdAdmin.register(u2, pass);

        // 1. Establish connection (SnowWhite)
        await snowWhite.logIn(u1, pass);
        await expect(snowWhitePage.locator('[data-zid="chat-connection-state"]')).toHaveText('online');

        // 2. Establish connection (Sleepy)
        await sleepy.logIn(u2, pass);
        await expect(sleepyPage.locator('[data-zid="chat-connection-state"]')).toHaveText('online');

        // 3. SnowWhite creates history (Ensure enough messages for scrolling, e.g. 15)
        await snowWhitePage.waitForTimeout(1000);
        const u2Jid = `${u2}@local-jabber.entenhausen.pazz.de`;
        const u1Jid = `${u1}@local-jabber.entenhausen.pazz.de`;

        await snowWhite.addContact(u2Jid);
        // Use standard widget to send messages for convenience
        await snowWhite.selectChatWithContact(u2Jid);
        const chatWindow = new ChatWindowPage(snowWhitePage, u2Jid);

        console.log('Sending 25 messages...');
        for (let i = 1; i <= 25; i++) {
            await chatWindow.write(`Manual History ${i}`);
        }

        await sleepyPage.waitForTimeout(2000); // Wait for delivery

        // 4. Sleepy reloads to clean state
        console.log('Reloading Sleepy...');
        await sleepyPage.reload();
        await sleepy.logIn(u2, pass);
        await expect(sleepyPage.locator('[data-zid="chat-connection-state"]')).toHaveText('online');

        await sleepy.addContact(u1Jid); // Add to roster to see "Contacts chat" button
        await sleepyPage.waitForTimeout(2000); // Wait for roster sync

        // 5. Sleepy opens MANUAL (Big) chat
        console.log('Opening Big Box...');
        // Find button in "Contacts chat" list by text match, more robust
        const manualButton = sleepyPage.locator('button').filter({ hasText: u1Jid }).first();
        await manualButton.waitFor();
        await manualButton.click();

        // 6. Verify WIDGET (Small Box) is NOT visible
        const widgetWindow = sleepyPage.locator(`.window`).filter({ has: sleepyPage.locator(`[data-zid*="${u1Jid.toLowerCase()}"]`) });
        await expect(widgetWindow).toBeHidden();
        console.log('Verified: Small widget did NOT open.');

        // 7. Verify MANUAL Container IS visible
        // Use prefix match ^ because actual JID might include resource (e.g. /12345)
        const manualContainer = sleepyPage.locator(`[data-zid^="manual-chat-window-${u1Jid}"]`);
        await expect(manualContainer).toBeVisible();
        console.log('Verified: Big Box IS open.');

        // 8. Verify Initial Message Count in Manual View
        // The manual view uses ngx-chat-history, which renders same message components.
        // We target messages *inside* the manual container.
        const manualMessages = manualContainer.locator('ngx-chat-message-in, ngx-chat-message-out');
        await expect(async () => {
            const count = await manualMessages.count();
            expect(count).toBeGreaterThan(0);
        }).toPass();

        const initialCount = await manualMessages.count();
        console.log('Initial manual message count:', initialCount);

        // 9. Scroll Manual View
        console.log('Scrolling manual view...');
        const scrollContainer = manualContainer.locator('.chat-messages-auto-scroll');
        await scrollContainer.evaluate((el: HTMLElement) => {
            el.scrollTop = 0;
            // Trigger scroll event manually if needed by the directive
            el.dispatchEvent(new Event('scroll'));
        });

        await sleepyPage.waitForTimeout(2000); // Wait for load

        // 10. Verify More Messages Loaded
        const finalCount = await manualMessages.count();
        console.log('Final manual message count:', finalCount);
        expect(finalCount).toBeGreaterThan(initialCount);
    });
});
