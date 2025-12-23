// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from '@playwright/test';
import { AppPage } from './page-objects/app.po';
import {
    devXmppDomain,
    devXmppJid,
    devXmppPassword,
} from '../secrets';
import { EjabberdAdminPage } from './page-objects/ejabberd-admin.po';

const mobileUser = 'mobileuser';
const password = 'password';

test.describe('Mobile/Separate Roster Logic', () => {
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
        // Register user and contact
        await ejabberdAdminPage.register(mobileUser, password);
        await ejabberdAdminPage.register('contact1', password);
    });

    /**
     * The user asked to find "that logic" - meaning the separate roster list 
     * which opens a chatbox full screen (flexible usage).
     * This test verifies that we can open a chat using the separate buttons 
     * found in index.component.html (mimicking a custom roster), 
     * receiving the message in the embedded ngx-chat-history component.
     */
    test.fixme('should open chat via separate roster list (mobile mode)', async () => {
        console.log('Navigating to app...');
        await appPage.setupForTest(); // goto /
        console.log('Logging in as', mobileUser);
        console.log('Logging in as', mobileUser);
        await appPage.page.setViewportSize({ width: 375, height: 812 });
        await appPage.logIn(mobileUser, password);

        // Add contact to ensure they appear in the separate list
        await appPage.addContact('contact1@' + devXmppDomain);
        // Verify it appears in the standard roster first (Sync check)
        await expect(appPage.getContactRosterLocator('contact1@' + devXmppDomain)).toBeVisible();

        // Wait for connection state to be online
        await expect(appPage.page.locator('[data-zid="chat-connection-state"]')).toContainText('online');

        // Assert "Contacts chat" header is visible (meaning *ngIf passed)
        await expect(appPage.page.locator('h1', { hasText: 'Contacts chat' })).toBeVisible();

        // Find the "separate roster list" button.
        // It should contain the contact name/JID.
        // Note: index.component.html uses {{ contact.name }} which might be JID if name is missing.
        console.log('Waiting for contact button...');
        const separateRosterButton = appPage.page.locator('button', { hasText: 'contact1' }).first();
        await expect(separateRosterButton).toBeVisible();

        // Click to open "full screen" (embedded) chat
        await separateRosterButton.click();


        // Verify the embedded chat history appears
        // <ngx-chat-history [recipient]="selectedContact"> ...
        // We need a locator for something specific to ngx-chat-history or the wrapper.
        // ngx-chat-file-drop is the wrapper in index.component.html
        const embeddedChat = appPage.page.locator('ngx-chat-file-drop');
        await expect(embeddedChat).toBeVisible();

        // Verify we can send a message via this embedded view
        // The input is ngx-chat-window-input
        const input = embeddedChat.locator('textarea');
        await expect(input).toBeVisible();

        await input.fill('Hello from mobile mode');
        await input.press('Enter');

        // Assert message appears in history
        await expect(embeddedChat.locator('.message-body', { hasText: 'Hello from mobile mode' })).toBeVisible();
    });

    test.afterAll(() => ejabberdAdminPage.deleteAllBesidesAdminUser());
});
