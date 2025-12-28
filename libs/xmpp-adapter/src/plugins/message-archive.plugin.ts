// SPDX-License-Identifier: MIT
import { Recipient, XmlSchemaForm } from '@pazznetwork/ngx-chat-shared';
import { ChatPlugin, serializeToSubmitForm } from '../core';
import type { XmppService } from '../xmpp.service';
import { nsRSM } from './multi-user-chat';
import { StanzaBuilder } from '../stanza-builder';

const nsMAM = 'urn:xmpp:mam:2';

/**
 * https://xmpp.org/extensions/xep-0313.html
 * Message Archive Management
 */
export class MessageArchivePlugin implements ChatPlugin {
  readonly nameSpace = nsMAM;

  constructor(private readonly chatService: XmppService) { }

  async enableArchiving(): Promise<void> {
    await this.chatService.chatConnectionService
      .$iq({ type: 'set' })
      .c('prefs', { xmlns: this.nameSpace, default: 'always' })
      .send();
  }

  async requestNewestMessages(): Promise<void> {
    await this.chatService.chatConnectionService
      .$iq({ type: 'set' })
      .c('query', { xmlns: this.nameSpace })
      .c('set', { xmlns: nsRSM })
      .c('max', {}, '20')
      .c('before')
      .send();
  }

  async loadMessagesBeforeOldestMessage(recipient: Recipient): Promise<void> {
    await this.loadMessages(recipient, (builder) =>
      recipient.messageStore.oldestMessage?.id
        ? builder.c('before', {}, recipient.messageStore.oldestMessage.id)
        : builder
    );
  }

  async loadMostRecentMessages(recipient: Recipient): Promise<void> {
    await this.loadMessages(recipient, (builder) =>
      recipient.messageStore.mostRecentMessage?.id
        ? builder.c('after', {}, recipient.messageStore.mostRecentMessage.id)
        : builder.c('before')
    );
  }

  async loadAllMessages(): Promise<void> {
    let lastMamResponse = await this.chatService.chatConnectionService
      .$iq({ type: 'set' })
      .c('query', { xmlns: this.nameSpace })
      .send();

    while (lastMamResponse?.querySelector('fin')?.getAttribute('complete') !== 'true') {
      const lastReceivedMessageId = lastMamResponse
        ?.querySelector('fin')
        ?.querySelector('set')
        ?.querySelector('last')?.textContent;

      if (!lastReceivedMessageId) {
        continue;
      }

      lastMamResponse = await this.chatService.chatConnectionService
        .$iq({ type: 'set' })
        .c('query', { xmlns: this.nameSpace })
        .c('set', { xmlns: nsRSM })
        .c('max', {}, '250')
        .up()
        .c('after', {}, lastReceivedMessageId)
        .send();
    }
  }

  private async loadMessages(
    recipient: Recipient,
    retrieveMessageFunc: (builder: StanzaBuilder) => StanzaBuilder
  ): Promise<void> {
    let recipientType = recipient.recipientType;
    if (recipientType !== 'room' && 'affiliations' in recipient) {
      recipientType = 'room';
    }

    const to = recipientType === 'room' ? recipient.jid.toString() : undefined;
    // console.error('[MAM-DEBUG] loadMessages for:', recipient.jid.toString(), 'domain conference?', recipient.jid.domain.includes('conference'));

    const form: XmlSchemaForm = {
      type: 'submit',
      instructions: [],
      fields: [
        { type: 'hidden', variable: 'FORM_TYPE', value: 'urn:xmpp:mam:2' }
      ],
    };

    if (to) {
      // filtering by 'with' is not supported for MUC rooms
    } else {
      form.fields.push({
        type: 'jid-single',
        variable: 'with',
        value: recipient.jid.toString()
      });
    }

    const request = this.chatService.chatConnectionService
      .$iq({ type: 'set', ...(to ? { to } : {}) })
      .c('query', { xmlns: this.nameSpace })
      .cCreateMethod((builder) => serializeToSubmitForm(builder, form))
      .up()
      .c('set', { xmlns: nsRSM })
      .c('max', {}, '20')
      .cCreateMethod(retrieveMessageFunc)
      .up();

    if (to && to.includes('conference')) {
      // console.error(`[MAM-DEBUG] Sending to ${to}:`, request.toString());
    }

    await request.send();
    // .then(response => {
    //   const count = response.querySelector('set')?.getAttribute('count');
    //   const fin = response.querySelector('fin')?.getAttribute('complete');
    //   // Only log if it looks like a MUC query to reduce noise
    //   if (to && to.includes('conference')) {
    //     console.error(`[MAM-DEBUG] MUC Query to ${to}: complete=${fin}, count=${count}`);
    //   }
    // });
  }
}
