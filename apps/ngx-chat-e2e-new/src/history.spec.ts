import { test, expect } from '@playwright/test';
import { EjabberdAdminPage } from './page-objects/ejabberd-admin.po';
import { AppPage } from './page-objects/app.po';
import { devXmppDomain, devXmppJid, devXmppPassword } from '../secrets';

test.describe('MAM History', () => {
    let pageA: AppPage;

    test('should persist messages after page reload via MAM', async ({ browser, playwright }) => {
        // Provision users
        const ejabberdAdminPage = await EjabberdAdminPage.create(playwright, devXmppDomain, devXmppJid, devXmppPassword);
        await ejabberdAdminPage.deleteAllBesidesAdminUser();
        await ejabberdAdminPage.register('historian_a', 'pass');
        await ejabberdAdminPage.register('historian_b', 'pass');

        // Load Historian A
        pageA = await AppPage.create(browser);
        await pageA.setupForTest();
        await pageA.logIn('historian_a', 'pass');

        // Load Historian B
        const pageB = await pageA.newPage();
        await pageB.logIn('historian_b', 'pass');

        // 1. Establish contact (A adds B)
        const jidB = `historian_b@${devXmppDomain}`;
        await pageA.addContact(jidB);

        // B adds A
        const jidA = `historian_a@${devXmppDomain}`;
        await pageB.addContact(jidA);

        // Open chat
        const chatA = await pageA.openChatWith(jidB);
        const chatB = await pageB.openChatWith(jidA);

        const uniqueMsg = 'History Persistence Test ' + Date.now();
        await chatA.write(uniqueMsg);

        // Verify received
        await chatB.assertLastMessage(uniqueMsg);

        // RELOAD A
        await pageA.reload();
        // After reload, need to re-login if session not persistent?
        // "auto-login" depends on token storage. App usually handles it if "Keep me signed in" or session storage.
        // E2E assumes login is required if not persistent.
        // Let's see if we are still online.
        // If not, log in again.
        // If we want to test MAM (history), it works even after re-login.
        try {
            await expect(pageA.page.locator('[data-zid="chat-connection-state"]')).toHaveText('online', { timeout: 5000 });
        } catch (e) {
            // Assume logged out on refresh? 
            // Logic in app.po `logIn` handles it.
            // But let's check if we need to log in explicitly.
            // Usually reload clears session if not persistent.
            await pageA.logIn('historian_a', 'pass');
        }

        // Re-open chat
        const chatAReloaded = await pageA.openChatWith(jidB);

        // VERIFY Message is present from Archives
        await chatAReloaded.assertLastMessage(uniqueMsg, 'outgoing'); // or explicit check for existence
        // `assertLastMessage` waits for visible.

        // Verify for B (didn't reload, but just double check)
        await chatB.assertLastMessage(uniqueMsg);
    });
});
