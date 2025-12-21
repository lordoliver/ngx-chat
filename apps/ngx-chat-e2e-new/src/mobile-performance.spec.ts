// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { AppPage } from './page-objects/app.po';
import {
    devXmppDomain,
    devXmppJid,
    devXmppPassword,
} from '../secrets';
import { EjabberdAdminPage } from './page-objects/ejabberd-admin.po';

const seedUser = 'mobile_perf_user';
const password = 'password';
const contactCount = 50;

test.describe('Mobile Roster Performance Test', () => {
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
        await ejabberdAdminPage.deleteAllBesidesAdminUser();

        // Setup: Seed user and 50 contacts
        await appPage.setupForTest();
        await ejabberdAdminPage.register(seedUser, password);

        console.log(`Seeding ${contactCount} contacts for ${seedUser}...`);
        for (let i = 0; i < contactCount; i++) {
            const contactName = `contact_${i}`;
            await ejabberdAdminPage.register(contactName, password);
        }
    });

    test('should render separate roster list efficiently', async () => {
        // 1. Log in and batch add contacts (same as roster-performance)
        await appPage.logIn(seedUser, password);

        console.log('Sending contact requests...');
        const addStart = Date.now();
        await appPage.page.evaluate(async ({ count, domain }) => {
            const app = (window as any).ng.getComponent(document.querySelector('app-root'));
            const chatService = app.chatService;
            for (let i = 0; i < count; i++) {
                const jid = `contact_${i}@${domain}`;
                await chatService.contactListService.addContact(jid);
            }
        }, { count: contactCount, domain: devXmppDomain });
        console.log(`Added ${contactCount} contacts in ${Date.now() - addStart}ms`);

        // 2. Reload to force fresh render of the separate list
        await appPage.reload();
        await appPage.setupForTest();

        console.log('Measuring Mobile List Render...');
        const start = Date.now();
        await appPage.logIn(seedUser, password);

        // Helper to ensure view is synced
        const ensureOnlineView = async () => {
            const header = appPage.page.locator('h1', { hasText: 'Contacts chat' });
            try {
                await header.waitFor({ state: 'visible', timeout: 3000 });
            } catch (e) {
                console.log('Header not visible yet. Checking state...');
                const stateText = await appPage.page.locator('[data-zid="chat-connection-state"]').textContent();
                console.log('Current State:', stateText);
                if (stateText?.includes('online')) {
                    console.log('State is online but view is hidden. Forcing update...');
                    await appPage.page.locator('[data-zid="force-update"]').click();
                }
                await header.waitFor({ state: 'visible', timeout: 10000 });
            }
        };

        await ensureOnlineView();


        // Now wait for the 50th button to be visible to confirm full list render
        // The buttons are simple <button>{{name}}</button>.
        const lastContactName = `contact_${contactCount - 1}`;
        // Locator: find button with text.
        // We use a relaxed locator to avoid "role" strictness if it's not strictly a button role (it is <button> though).
        const lastButton = appPage.page.locator('button', { hasText: lastContactName }).first();
        await expect(lastButton).toBeVisible({ timeout: 10000 });

        const time = Date.now() - start;
        console.log(`Mobile List (50 items) render took ${time}ms`);
        expect(time).toBeLessThan(5000);

        // 3. Measure Interaction (Open Embedded Chat)
        console.log('Measuring Embedded Chat Open...');
        const chatStart = Date.now();
        await lastButton.click();

        // Expect embedded chat to appear
        const embeddedChat = appPage.page.locator('ngx-chat-file-drop');
        await expect(embeddedChat).toBeVisible();

        const chatTime = Date.now() - chatStart;
        console.log(`Embedded chat open took ${chatTime}ms`);
        expect(chatTime).toBeLessThan(1000); // Should be instant

        await appPage.logOut();
    });

    test.afterAll(() => ejabberdAdminPage.deleteAllBesidesAdminUser());

});
