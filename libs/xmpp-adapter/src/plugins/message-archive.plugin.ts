// SPDX-License-Identifier: MIT
import { Recipient, XmlSchemaForm, parseJid } from '@pazznetwork/ngx-chat-shared';
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
    await this.loadMessages(recipient, (builder) => {
      const oldestMessage = recipient.messageStore.oldestMessage;
      const beforeId = oldestMessage?.stanzaId || oldestMessage?.id;
      console.log(`[MAM-DEBUG] loadMessagesBeforeOldestMessage. Recipient=${recipient.jid.toString()}, OldestMsgId=${beforeId}, StanzaID=${oldestMessage?.stanzaId}, ID=${oldestMessage?.id}`);

      if (!beforeId) {
        console.warn('[MAM-DEBUG] WARNING: No oldest message ID found! Requesting catch-up or potentially empty page.');
      }
      return beforeId ? builder.c('before', {}, beforeId) : builder;
    });
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


    const form: XmlSchemaForm = {
      type: 'submit',
      instructions: [],
      fields: [
        { type: 'hidden', variable: 'FORM_TYPE', value: 'urn:xmpp:mam:2' }
      ],
    };

    // ... class definition ...

    if (to) {
      // filtering by 'with' is not supported for MUC rooms
    } else {
      form.fields.push({
        type: 'jid-single',
        variable: 'with',
        value: parseJid(recipient.jid.toString()).bare().toString()
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

    console.log(`[MAM-DEBUG-V2] Sending MAM Request to=${to || 'self'}, with=${form.fields.find(f => f.variable === 'with')?.value}`);
    const response = await request.send();
    const fin = response.querySelector('fin');
    const complete = fin?.getAttribute('complete');
    // Note: Messages are usually pushed via message handler, not IQ result directly in some XEP-0313 versions,
    // but the 'set' element in 'fin' might give clues.
    console.log(`[MAM-DEBUG-V2] MAM Response Received. Complete=${complete}`);

    // In many implementations, the IQ result only contains the 'fin'. usage of 'message' elements alongside IQ depends on protocol version.
    // However, if we receive 0 messages via the stream, the 'oldestMessage' won't update.
  }
}
