import {
    MatrixJid,
    parseJid,
    XmppJid
} from '@pazznetwork/ngx-chat-shared';

describe('JID Polymorphism', () => {

    it('should parse XMPP JIDs as XmppJid', () => {
        const jid = parseJid('user@domain.com/resource');
        expect(jid instanceof XmppJid).toBeTrue();
        expect(jid instanceof MatrixJid).toBeFalse();
        expect(jid.toString()).toBe('user@domain.com/resource');
        expect(jid.local).toBe('user');
        expect(jid.domain).toBe('domain.com');
        expect(jid.resource).toBe('resource');
    });

    it('should parse bare XMPP JIDs correctly', () => {
        const jid = parseJid('user@domain.com');
        expect(jid instanceof XmppJid).toBeTrue();
        expect(jid.toString()).toBe('user@domain.com');
        expect(jid.resource).toBeUndefined();
    });

    it('should parse Matrix IDs as MatrixJid', () => {
        const jid = parseJid('@user:matrix.org');
        expect(jid instanceof MatrixJid).toBeTrue();
        expect(jid instanceof XmppJid).toBeFalse();
        expect(jid.toString()).toBe('@user:matrix.org');
        expect(jid.local).toBe('user');
        expect(jid.domain).toBe('matrix.org');
        expect(jid.resource).toBeUndefined();
    });

    it('should handle Matrix IDs equality', () => {
        const jid1 = parseJid('@user:matrix.org');
        const jid2 = new MatrixJid('user', 'matrix.org');
        expect(jid1.equals(jid2)).toBeTrue();
        expect(jid1.equalsBare(jid2)).toBeTrue();
    });

    it('should treat Matrix IDs as bare by default', () => {
        const jid = parseJid('@user:matrix.org');
        expect(jid.bare().toString()).toBe('@user:matrix.org');
    });

    it('should allow mixed type comparisons', () => {
        const xmpp = parseJid('user@domain.com');
        const matrix = parseJid('@user:domain.com');
        // They are equal because JID.equals() compares local, domain, and resource fields only
        expect(xmpp.equals(matrix)).toBeTrue();
    });
});
