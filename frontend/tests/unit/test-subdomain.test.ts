import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the logic by mocking window.location.hostname
// Import is dynamic to allow mocking

describe('getInstituteSlug', () => {
  const originalWindow = globalThis.window;

  function mockHostname(hostname: string) {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { hostname } },
      writable: true,
      configurable: true,
    });
  }

  afterEach(() => {
    // Reset module cache so each test gets fresh imports
    vi.resetModules();
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', {
        value: originalWindow,
        writable: true,
        configurable: true,
      });
    }
  });

  it('returns null for localhost', async () => {
    mockHostname('localhost');
    const { getInstituteSlug } = await import('@/lib/utils/subdomain');
    expect(getInstituteSlug()).toBeNull();
  });

  it('returns null for 127.0.0.1', async () => {
    mockHostname('127.0.0.1');
    const { getInstituteSlug } = await import('@/lib/utils/subdomain');
    expect(getInstituteSlug()).toBeNull();
  });

  it('returns subdomain for acme.localhost', async () => {
    mockHostname('acme.localhost');
    const { getInstituteSlug } = await import('@/lib/utils/subdomain');
    expect(getInstituteSlug()).toBe('acme');
  });

  it('returns null for bare domain (zensbot.online)', async () => {
    mockHostname('zensbot.online');
    const { getInstituteSlug } = await import('@/lib/utils/subdomain');
    expect(getInstituteSlug()).toBeNull();
  });

  it('returns slug for subdomain (acme.zensbot.online)', async () => {
    mockHostname('acme.zensbot.online');
    const { getInstituteSlug } = await import('@/lib/utils/subdomain');
    expect(getInstituteSlug()).toBe('acme');
  });

  it('skips www prefix (www.zensbot.online → null)', async () => {
    mockHostname('www.zensbot.online');
    const { getInstituteSlug } = await import('@/lib/utils/subdomain');
    expect(getInstituteSlug()).toBeNull();
  });

  it('skips www and gets subdomain (www.acme.zensbot.online → acme)', async () => {
    mockHostname('www.acme.zensbot.online');
    const { getInstituteSlug } = await import('@/lib/utils/subdomain');
    expect(getInstituteSlug()).toBe('acme');
  });
});

describe('isSuperAdminDomain', () => {
  afterEach(() => {
    vi.resetModules();
  });

  it('returns true when slug is null (bare domain)', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { hostname: 'zensbot.online' } },
      writable: true,
      configurable: true,
    });
    const { isSuperAdminDomain } = await import('@/lib/utils/subdomain');
    expect(isSuperAdminDomain()).toBe(true);
  });

  it('returns false when slug exists (subdomain)', async () => {
    Object.defineProperty(globalThis, 'window', {
      value: { location: { hostname: 'acme.zensbot.online' } },
      writable: true,
      configurable: true,
    });
    const { isSuperAdminDomain } = await import('@/lib/utils/subdomain');
    expect(isSuperAdminDomain()).toBe(false);
  });
});
