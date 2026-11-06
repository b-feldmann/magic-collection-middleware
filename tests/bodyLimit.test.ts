import request from 'supertest';
import app from '../src/index';

// Routes are only registered once Mongo connects, so an accepted body falls
// through to a 404 here; a rejected one stops at the JSON parser with a 413.
const postBase64OfSize = (bytes: number) =>
  request(app)
    .post('/body-limit-probe')
    .send({ base64: 'A'.repeat(bytes) });

describe('JSON body limit', () => {
  it('accepts resized card images larger than the Express default of 100 KB', async () => {
    const res = await postBase64OfSize(500 * 1024);
    expect(res.status).not.toBe(413);
  });

  it('still rejects bodies above the configured limit', async () => {
    const res = await postBase64OfSize(3 * 1024 * 1024);
    expect(res.status).toBe(413);
  });
});
