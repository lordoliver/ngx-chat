// SPDX-License-Identifier: AGPL-3.0-or-later
export abstract class JID {
  protected constructor(
    readonly local: string | undefined,
    readonly domain: string,
    readonly resource: string | undefined
  ) { }

  abstract toString(): string;

  [Symbol.toPrimitive](hint: 'number' | 'string' | 'boolean'): number | string | boolean {
    if (hint === 'number') {
      return NaN;
    }

    if (hint === 'string') {
      return this.toString();
    }

    return true;
  }

  /**
   * Comparison function
   * */
  equals(
    other: { local: string | undefined; domain: string; resource: string | undefined } | undefined
  ): boolean {
    if (!other) {
      return false;
    }
    return (
      this.local === other.local && this.domain === other.domain && this.resource === other.resource
    );
  }

  abstract bare(): JID;

  equalsBare(other: JID | undefined): boolean {
    if (!other) {
      return false;
    }
    return this.bare().equals(other.bare());
  }

  equalsBareString(other: string | undefined): boolean {
    if (!other) {
      return false;
    }
    return this.bare().equals(parseJid(other).bare());
  }
}

export class XmppJid extends JID {
  constructor(local: string | undefined, domain: string, resource: string | undefined) {
    super(local, domain, resource);
  }

  toString(): string {
    let s = this.domain;
    if (this.local) {
      s = this.local + '@' + s;
    }

    if (this.resource) {
      s = s + '/' + this.resource;
    }

    return s;
  }

  bare(): JID {
    return new XmppJid(this.local, this.domain, '');
  }
}

export class MatrixJid extends JID {
  constructor(local: string, domain: string) {
    super(local, domain, undefined);
  }

  toString(): string {
    return `@${this.local}:${this.domain}`;
  }

  bare(): JID {
    return this; // Matrix IDs are already bare (no resource)
  }
}

export function parseJid(jid: string): JID {
  if (jid == null) {
    // helpful in other application context
    throw new Error(`Can not parseJid with null, jid=${String(jid)}`);
  }

  if (jid.startsWith('@') && jid.includes(':')) {
    // Matrix ID format: @user:domain
    const colonIndex = jid.indexOf(':');
    const local = jid.substring(1, colonIndex);
    const domain = jid.substring(colonIndex + 1);
    return new MatrixJid(local, domain);
  }

  let local: string | undefined;
  let resource: string | undefined;
  let domain: string | undefined;

  // Extract resource part, if available
  const resourceStart = jid.indexOf('/');
  if (resourceStart !== -1) {
    resource = jid.substring(resourceStart + 1);
    jid = jid.substring(0, resourceStart);
  }

  // Extract local and domain parts
  const atStart = jid.indexOf('@');
  if (atStart !== -1) {
    local = jid.substring(0, atStart).toLowerCase();
    domain = jid.substring(atStart + 1).toLowerCase();
  } else if (jid.includes('.')) {
    domain = jid.toLowerCase();
  } else {
    local = jid.toLowerCase();
  }

  // Return parsed JID parts
  return new XmppJid(local, domain ?? '', resource);
}

export function bareJidStringsEqual(a: string, b: string): boolean {
  return parseJid(a).bare().equals(parseJid(b).bare());
}

export function makeSafeJidString(username: string, domain: string): string {
  const separator = '@';
  const safeUsername = username.includes(separator) ? username.split(separator)[0] : username;
  if (!safeUsername) {
    throw new Error(`safeUsername is undefined`);
  }
  return safeUsername + separator + domain;
}
