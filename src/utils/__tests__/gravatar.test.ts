import { getGravatarUrl } from '../gravatar';

describe('getGravatarUrl', () => {
  it('returns a Gravatar URL with MD5 hash', () => {
    const url = getGravatarUrl('test@example.com');
    expect(url).toMatch(/^https:\/\/www\.gravatar\.com\/avatar\/[a-f0-9]{32}/);
  });

  it('default size is 32', () => {
    const url = getGravatarUrl('test@example.com');
    expect(url).toContain('s=32');
  });

  it('custom size parameter is included', () => {
    const url = getGravatarUrl('test@example.com', 128);
    expect(url).toContain('s=128');
  });

  it('trims whitespace from email', () => {
    const url1 = getGravatarUrl('  test@example.com  ');
    const url2 = getGravatarUrl('test@example.com');
    expect(url1).toBe(url2);
  });

  it('lowercases email before hashing', () => {
    const url1 = getGravatarUrl('TEST@Example.COM');
    const url2 = getGravatarUrl('test@example.com');
    expect(url1).toBe(url2);
  });

  it('is deterministic', () => {
    const url1 = getGravatarUrl('user@test.com');
    const url2 = getGravatarUrl('user@test.com');
    expect(url1).toBe(url2);
  });
});
