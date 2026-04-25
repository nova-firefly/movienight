const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: () => ({ sendMail: mockSendMail }),
}));

import { sendPasswordResetEmail } from '../email';

describe('sendPasswordResetEmail', () => {
  beforeEach(() => {
    mockSendMail.mockResolvedValue({ messageId: 'test-id' });
  });

  it('sends email with correct to and subject', async () => {
    await sendPasswordResetEmail('user@test.com', 'reset-token-123');
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'user@test.com',
        subject: 'MovieNight - Password Reset',
      }),
    );
  });

  it('includes reset link with token in text body', async () => {
    await sendPasswordResetEmail('user@test.com', 'my-token');
    const call = mockSendMail.mock.calls[0][0];
    expect(call.text).toContain('my-token');
  });

  it('includes reset link in HTML body', async () => {
    await sendPasswordResetEmail('user@test.com', 'my-token');
    const call = mockSendMail.mock.calls[0][0];
    expect(call.html).toContain('my-token');
  });

  it('uses APP_URL env var in reset link', async () => {
    const origAppUrl = process.env.APP_URL;
    process.env.APP_URL = 'https://movies.example.com';
    await sendPasswordResetEmail('u@t.com', 'tok');
    const call = mockSendMail.mock.calls[0][0];
    expect(call.text).toContain('https://movies.example.com?resetToken=tok');
    process.env.APP_URL = origAppUrl;
  });
});
