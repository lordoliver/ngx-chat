
import { expect, test } from '@playwright/test';
import { AppPage } from './page-objects/app.po';
import { EjabberdAdminPage } from './page-objects/ejabberd-admin.po';
import { devXmppDomain, devXmppJid, devXmppPassword } from '../secrets';

const testPassword = 'test';

test.describe('MUC Infinite Scroll', () => {
    let mainPage: AppPage;
    let ejabberdAdminPage: EjabberdAdminPage;

    test.beforeAll(async ({ browser, playwright }) => {
        mainPage = await AppPage.create(browser);
        ejabberdAdminPage = await EjabberdAdminPage.create(
            playwright,
            devXmppDomain,
            devXmppJid,
            devXmppPassword
        );
        await ejabberdAdminPage.deleteAllBesidesAdminUser();
        await mainPage.setupForTest();
    });

    test.afterAll(() => ejabberdAdminPage.deleteAllBesidesAdminUser());

    test('should scroll to load older messages in MUC', async () => {
        const owner = 'muc-scroll-owner-' + Date.now();
        const room = 'scrollroom';

        // 1. Register user
        await ejabberdAdminPage.register(owner, testPassword);

        // 2. Login and create room
        await mainPage.logIn(owner, testPassword);

        // Use ContactList to create/join room
        const ownerMuc = mainPage.createMUCPageObject();
        // Since createRoom in ContactList also opens the chat and joins:
        // We can just use the UI actions or helper
        // Let's use the helper to create the room via ContactList logic if possible, 
        // or just use the UI manually if the PO is strict.
        // The MUC PO methods like `createRoom` assume specific UI that might have changed or rely on stubs?
        // Let's rely on the UI we just verified in muc-messages.spec.ts

        // Actually, let's use the PO if it aligns. 
        // In muc-messages.spec.ts: await ownerMuc.createRoom(room);
        // Let's assume that works or use the UI directly if we want to be sure.
        // The previous test passed with ownerMuc.createRoom(room).
        await ownerMuc.createRoom(room);

        const chat = await mainPage.openChatWith(room); // Should already be open but this ensures it

        // 3. Send enough messages to fill a page (e.g. 60)
        // Note: verify if MUC stanzas are persisted. Ejabberd standard config usually persists MUC.
        const msgCount = 60;
        console.log(`Sending ${msgCount} messages...`);
        for (let i = 0; i < msgCount; i++) {
            await chat.write(`MUC Message ${i}`);
        }

        // 4. Reload page to clear local state
        await mainPage.page.reload();
        await mainPage.logIn(owner, testPassword);

        // 5. Re-join room (should fetch history)
        // We must "join" to get presence and history. 
        // Currently ContactList doesn't auto-join on login unless we persist bookmarks.
        // App logic doesn't auto-join yet.
        await ownerMuc.acceptInvite(room);
        const chatRejoined = await mainPage.openChatWith(room);

        // 6. Verify distinct recent messages count (should be ~50)
        const countAfterLoad = await chatRejoined.getMessageCount();
        console.log(`Messages after reload: ${countAfterLoad}`);
        expect(countAfterLoad).toBeLessThan(msgCount);
        expect(countAfterLoad).toBeGreaterThan(0);

        // 7. Scroll to top
        console.log('Scrolling to top...');
        await chatRejoined.scrollToTop();

        // 8. Verify more messages loaded
        // Give it a moment
        await mainPage.page.waitForTimeout(2000);

        const countAfterScroll = await chatRejoined.getMessageCount();
        console.log(`Messages after scroll: ${countAfterScroll}`);
        expect(countAfterScroll).toBeGreaterThan(countAfterLoad);
        expect(countAfterScroll).toBeCloseTo(msgCount, -1); // Should have most/all now

        // 9. Verify no duplicates
        // We assume message bodies are unique 'MUC Message X'
        const messages = await chatRejoined.getAllMessagesText();
        const uniqueMessages = new Set(messages);
        if (messages.length !== uniqueMessages.size) {
            console.error('Duplicate messages found:', messages.filter((e, i, a) => a.indexOf(e) !== i));
        }
        expect(messages.length).toBe(uniqueMessages.size);
    });
});
