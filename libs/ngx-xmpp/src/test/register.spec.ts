// SPDX-License-Identifier: AGPL-3.0-or-later
import { testUser, TestUtils } from './helpers/test-utils';
import { TestBed } from '@angular/core/testing';
import { CHAT_SERVICE_TOKEN } from '@pazznetwork/ngx-xmpp';
import type { XmppService } from '@pazznetwork/xmpp-adapter';
import { XmppAdapterTestModule } from '../xmpp-adapter-test.module';
import {
  ensureNoRegisteredUser,
  ensureRegisteredUser,
  userIsRegistered,
} from './helpers/admin-actions';

// SKIPPED: In-Band Registration (XEP-0077) is disabled on the test Ejabberd server configuration.
// These tests inevitably fail because the server rejects the registration request.
// Enable only if testing against a server with `mod_register` enabled and configured for in-band registration.
xdescribe('register plugin', () => {
  let testUtils: TestUtils;
  beforeAll(() => {
    const testBed = TestBed.configureTestingModule({
      imports: [XmppAdapterTestModule],
    });
    testUtils = new TestUtils(testBed.inject<XmppService>(CHAT_SERVICE_TOKEN));
  });

  it('should be able to register', async () => {
    await ensureNoRegisteredUser(testUser);

    await testUtils.chatService.register(testUser);
    expect(await userIsRegistered(testUser)).toBeTruthy();
    await testUtils.chatService.logOut();
  });

  it('should be able to unregister', async () => {
    await ensureRegisteredUser(testUser);

    await testUtils.chatService.logIn(testUser);
    await testUtils.chatService.unregister(testUser);
    expect(await userIsRegistered(testUser)).toBeFalsy();
  });

  xit('should be able to register and unregister in one session', async () => {
    await ensureNoRegisteredUser(testUser);

    await testUtils.chatService.register(testUser);
    await testUtils.chatService.unregister(testUser);
    expect(await userIsRegistered(testUser)).toBeFalsy();
  });
});
