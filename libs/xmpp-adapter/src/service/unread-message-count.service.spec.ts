import { UnreadMessageCountService } from './unread-message-count.service';
import { Subject, BehaviorSubject, of, firstValueFrom } from 'rxjs';
import { Recipient, Message, Contact, Direction, DateMessagesGroup } from '@pazznetwork/ngx-chat-shared';
import { skip, take, filter } from 'rxjs/operators';

const mockJid = (user: string) => ({
    bare: () => ({
        toString: () => user
    }),
    toString: () => user,
    equals: (other: any) => other.toString() === user
});

xdescribe('UnreadMessageCountService', () => {
    let service: UnreadMessageCountService;
    let mockChatService: any;
    let mockChatListService: any;
    let mockPubSub: any;
    let mockEntityTimePlugin: any;
    let mockMucPlugin: any;
    let mockBlockPlugin: any;

    let contactsSubject: BehaviorSubject<Contact[]>;
    let onOnlineSubject: Subject<void>;
    let roomsSubject: Subject<any[]>;

    beforeEach(() => {
        contactsSubject = new BehaviorSubject<Contact[]>([]);
        onOnlineSubject = new Subject<void>();
        roomsSubject = new BehaviorSubject<any[]>([]);

        mockChatService = {
            contactListService: {
                contacts$: contactsSubject.asObservable()
            },
            onOnline$: onOnlineSubject.asObservable(),
            onOffline$: of(),
            zone: {
                run: (fn: any) => fn()
            }
        };

        mockChatListService = {
            chatMessagesViewed$: of(),
            chatMessages$: of()
        };

        mockPubSub = {
            publish$: jest.fn().mockReturnValue(of('item')),
            retrieveNodeItems$: jest.fn().mockReturnValue(of([{
                content: {
                    entries: []
                }
            }])),
            publishEvent$: of()
        };

        mockEntityTimePlugin = {};

        mockMucPlugin = {
            rooms$: roomsSubject.asObservable()
        };

        mockBlockPlugin = {
            unblock$: of()
        };

        service = new UnreadMessageCountService(
            mockChatService,
            mockChatListService,
            mockPubSub,
            mockEntityTimePlugin,
            mockMucPlugin,
            mockBlockPlugin
        );
    });

    it('should track unread messages for contacts added in a batch', async () => {
        // Mock contacts
        const contact1 = {
            jid: mockJid('alice@example.com'),
            messageStore: {
                messages$: new BehaviorSubject<Message[]>([])
            }
        } as any;
        const contact2 = {
            jid: mockJid('bob@example.com'),
            messageStore: {
                messages$: new BehaviorSubject<Message[]>([])
            }
        } as any;

        const contacts = [contact1, contact2];

        // 1. Simulate Online
        onOnlineSubject.next();

        // 2. Emit Batch Contacts
        contactsSubject.next(contacts);

        // 3. Emit message for Contact 1 (Alice)
        const msg1: Message = {
            direction: Direction.in,
            datetime: new Date(),
            body: 'Hello Alice',
            id: '1'
        } as any;

        // Push message to store
        contact1.messageStore.messages$.next([msg1]);

        // 4. Verify Unread Count for Alice
        const map = await firstValueFrom(
            service.jidToUnreadCount$.pipe(
                filter(m => (m.get('alice@example.com') || 0) === 1)
            )
        );
        expect(map.get('bob@example.com') || 0).toBe(0);
    });

    it('should verify reading a message and getting a new one (badge flow)', async () => {
        const contact1 = {
            jid: mockJid('alice@example.com'),
            messageStore: {
                messages$: new BehaviorSubject<Message[]>([]),
                messages: []
            }
        } as any;

        onOnlineSubject.next();
        contactsSubject.next([contact1]);

        // 1. Message 1 arrives
        const msg1: Message = {
            direction: Direction.in,
            datetime: new Date(Date.now() - 10000), // 10s ago
            body: 'Msg1',
            id: '1'
        } as any;
        contact1.messageStore.messages = [msg1];
        contact1.messageStore.messages$.next([msg1]);

        // Wait for count 1
        await firstValueFrom(
            service.jidToUnreadCount$.pipe(
                filter(m => (m.get('alice@example.com') || 0) === 1)
            )
        );

        // 2. Simulate Reading (Update Last Read Time)
        (service as any).jidToLastReadTimestamp.set('alice@example.com', Date.now());
        service.updateContactUnreadMessageState(contact1);

        // Should be 0
        const map0 = await firstValueFrom(
            service.jidToUnreadCount$.pipe(
                filter(m => (m.get('alice@example.com') || 0) === 0)
            )
        );
        expect(map0.get('alice@example.com')).toBe(0);

        // 3. New Message
        const msg2: Message = {
            direction: Direction.in,
            datetime: new Date(),
            body: 'Msg2',
            id: '2'
        } as any;
        contact1.messageStore.messages = [msg1, msg2];
        contact1.messageStore.messages$.next([msg1, msg2]);

        // Check final
        const mapFinal = await firstValueFrom(
            service.jidToUnreadCount$.pipe(
                filter(m => (m.get('alice@example.com') || 0) === 1)
            )
        );
        expect(mapFinal.get('alice@example.com')).toBe(1);
    });
});
