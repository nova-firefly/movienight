import { iosVersion, isStandalonePWA, pushSupported, urlBase64ToUint8Array } from '../pushClient';

const ORIGINAL_UA = navigator.userAgent;

function setUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true });
}

afterEach(() => {
  setUA(ORIGINAL_UA);
});

describe('urlBase64ToUint8Array', () => {
  it('decodes a url-safe base64 string', () => {
    const result = urlBase64ToUint8Array('AAEC');
    expect(Array.from(result)).toEqual([0, 1, 2]);
  });

  it('handles missing padding', () => {
    // 'aGk' (3 chars) decodes to "hi" (2 bytes); browser atob normally needs '='
    const result = urlBase64ToUint8Array('aGk');
    expect(Array.from(result)).toEqual([104, 105]);
  });

  it('replaces url-safe chars (- → +, _ → /)', () => {
    // '-_' is the url-safe version of '+/', which decode to 0xFB, 0xFF
    const result = urlBase64ToUint8Array('-_8');
    expect(result[0]).toBe(0xfb);
    expect(result[1]).toBe(0xff);
  });
});

describe('iosVersion', () => {
  it('returns null for non-iOS UAs', () => {
    setUA('Mozilla/5.0 (Windows NT 10.0)');
    expect(iosVersion()).toBeNull();
  });

  it('parses major.minor for iPhone', () => {
    setUA('Mozilla/5.0 (iPhone; CPU iPhone OS 16_4 like Mac OS X)');
    expect(iosVersion()).toBe(16.4);
  });

  it('parses iPad UA', () => {
    setUA('Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X)');
    expect(iosVersion()).toBe(17.2);
  });

  it('returns null when version pattern is absent', () => {
    setUA('Mozilla/5.0 (iPhone)');
    expect(iosVersion()).toBeNull();
  });
});

describe('isStandalonePWA', () => {
  const originalMatchMedia = window.matchMedia;
  const originalStandalone = (navigator as any).standalone;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    (navigator as any).standalone = originalStandalone;
  });

  it('returns true when display-mode is standalone', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: true }) as any;
    expect(isStandalonePWA()).toBe(true);
  });

  it('returns true when iOS navigator.standalone is true', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as any;
    (navigator as any).standalone = true;
    expect(isStandalonePWA()).toBe(true);
  });

  it('returns false otherwise', () => {
    window.matchMedia = jest.fn().mockReturnValue({ matches: false }) as any;
    (navigator as any).standalone = false;
    expect(isStandalonePWA()).toBe(false);
  });
});

describe('pushSupported', () => {
  it('reflects presence of serviceWorker / PushManager / Notification', () => {
    // jsdom doesn't have PushManager — expect false in this env
    expect(pushSupported()).toBe(false);
  });
});
