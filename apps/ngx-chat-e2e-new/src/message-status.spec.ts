import { test, expect } from '@playwright/test';
import { AppPage } from './page-objects/app.po';
import { EjabberdAdminPage } from './page-objects/ejabberd-admin.po';
import {
    devXmppDomain,
    devXmppJid,
    devXmppPassword,
} from '../secrets';
import { generateUser } from './utils/user-helper';

test.describe('Message Status', () => {
    let alice: string;
    let bob: string;

    let ejabberdAdminPage: EjabberdAdminPage;

    test.beforeEach(async ({ playwright }) => {
        alice = generateUser('alice');
        bob = generateUser('bob');

        // Register users
        ejabberdAdminPage = await EjabberdAdminPage.create(
            playwright,
            devXmppDomain,
            devXmppJid,
            devXmppPassword
        );
        // Reuse admin logic (admin page might need its own page object instantiation if static create doesn't attach to page)
        // The existing static create returns an instance.
        // We can use it.
        await ejabberdAdminPage.register(alice, 'test');
        await ejabberdAdminPage.register(bob, 'test');
    });

    test('should show sent, received and seen status indicators', async ({ browser }) => {
        // 1. Setup Alice
        const aliceContext = await browser.newContext();
        const aliceApp = await AppPage.create(aliceContext);
        await aliceApp.setupForTest();
        await aliceApp.logIn(alice, 'test');

        // 2. Setup Bob
        const bobContext = await browser.newContext();
        const bobApp = await AppPage.create(bobContext);
        await bobApp.setupForTest();
        await bobApp.logIn(bob, 'test');

        // 3. Alice opens chat with Bob
        const aliceChatWindow = await aliceApp.openChatWithUnaffiliatedContact(bob);
        await aliceChatWindow.open();

        // 4. Bob opens chat with Alice (so he is online and ready to receive)
        const bobChatWindow = await bobApp.openChatWithUnaffiliatedContact(alice);
        await bobChatWindow.open();

        // 5. Alice sends message
        const msg = 'Status Test Message';
        await aliceChatWindow.write(msg);

        // 6. Check "Sent" status (✓) on Alice's side
        const lastMessage = aliceChatWindow.getOutMessages().filter({ hasText: msg }).last();
        // SENT = ✓
        await expect(lastMessage.locator('ngx-chat-message-state-icon')).toContainText('✓', { timeout: 5000 });

        // 7. Check "Received" status (✓✓)
        // Bob is online, so he should receive it.
        const bobLastMessage = bobChatWindow.getInMessages().filter({ hasText: msg }).last();
        await expect(bobLastMessage).toBeVisible();

        // Alice should see ✓✓
        await expect(lastMessage.locator('ngx-chat-message-state-icon')).toContainText('✓✓', { timeout: 60000 });

        // 8. Check "Seen" status (colored ✓✓)
        // Bob needs to focus/interact?
        // Bob's window is already open.
        // Trigger focus or just wait?
        // Sometimes simply receiving while open triggers seen.
        await bobChatWindow.getInMessages().filter({ hasText: msg }).last().click(); // simulate focus on message?

        await expect(lastMessage.locator('ngx-chat-message-state-icon .state--seen')).toBeVisible({ timeout: 10000 });

        await aliceContext.close();
        await bobContext.close();
    });
});
