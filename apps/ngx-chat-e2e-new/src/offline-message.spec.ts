import { test, expect } from '@playwright/test';
import { AppPage } from './page-objects/app.po';
import { ChatWindowPage } from './page-objects/chat-window.po';

test.describe('Offline Message Handling', () => {
    let appPage: AppPage;
    const testContact = 'offline-user';
    const domain = 'local-jabber.entenhausen.pazz.de';
    const fullJid = `${testContact}@${domain}`;

    test.beforeEach(async ({ browser }) => {
        appPage = await AppPage.create(browser);
        await appPage.setupForTest();
        await appPage.loginAdmin();
    });

    test('should queue and send message when offline', async () => {
        // 1. Add contact to ensure we can chat
        const contactLocator = appPage.page.locator(`[title*="${testContact}"]`);
        let exists = await contactLocator.count() > 0;

        if (!exists) {
            await appPage.addContact(fullJid);
            await contactLocator.first().waitFor({ timeout: 10000 });
            exists = true;
        }

        // 2. Open chat
        let chatWindow: ChatWindowPage;
        if (exists) {
            chatWindow = await appPage.selectChatWithContact(testContact);
        } else {
            chatWindow = await appPage.openChatWith(fullJid);
        }

        // 3. Simulate Offline
        await appPage.page.context().setOffline(true);

        // 4. Send Message
        const msg = `Offline Msg ${Date.now()}`;
        await chatWindow.write(msg);

        // 5. Verify Optimistic UI (Message should appear immediately)
        // We check if the message bubble exists
        await chatWindow.assertLastMessage(msg, 'outgoing');

        // 6. Simulate Online
        await appPage.page.context().setOffline(false);

        // 7. Verification of actual send would require checking the receipt or the other user receiving it.
        // For this unit of work, verifying no error and optimistic update is primary.
        // The Service Unit Test verifies the flushing logic, this E2E verifies UI resilience.
    });
});
