import express from 'express';
import supertest from 'supertest';
import { ObjectId } from 'mongodb';
import createUserRouter from '../src/routes/user';

describe('user partial updates', () => {
  const userUuid = '507f1f77bcf86cd799439011';
  let databaseError;
  let user;

  // Mirrors the Mongo operators the route uses, applied to the single stored user.
  const findOneAndUpdate = jest.fn(async (filter, update, options) => {
    expect(filter).toEqual({ _id: new ObjectId(userUuid) });
    expect(options).toEqual({ returnDocument: 'after' });
    if (databaseError) throw new Error('database unavailable');
    if (!user) return null;
    Object.entries(update.$addToSet || {}).forEach(
      ([field, { $each }]: [string, { $each: string[] }]) => {
        user[field] = [...new Set([...(user[field] || []), ...$each])];
      },
    );
    Object.entries(update.$max || {}).forEach(([field, value]: [string, number]) => {
      user[field] = Math.max(user[field] ?? value, value);
    });
    return { ...user };
  });

  const app = express();
  app.use(express.json());
  app.use('/user', createUserRouter({ collection: () => ({ findOneAndUpdate }) }));

  const patch = (body, uuid = userUuid) =>
    supertest(app)
      .patch(`/user/${uuid}`)
      .send({ accessKey: 'test-key', ...body });

  beforeEach(() => {
    process.env.ACCESS_KEY = 'test-key';
    databaseError = false;
    findOneAndUpdate.mockClear();
    user = {
      _id: userUuid,
      name: 'Reader',
      seenCards: ['card-a'],
      seenComments: ['comment-a'],
      lastSeenVersion: 5,
    };
  });

  it('adds seen comments without touching state missing from the request', async () => {
    const response = await patch({ seenComments: ['comment-a', 'comment-b'] }).expect(200);

    expect(response.body.user).toEqual({
      uuid: userUuid,
      name: 'Reader',
      seenCards: ['card-a'],
      seenComments: ['comment-a', 'comment-b'],
      lastSeenVersion: 5,
    });
  });

  it('keeps comments read elsewhere when another client saves a seen card', async () => {
    await patch({ seenComments: ['comment-b'] }).expect(200);
    const response = await patch({ seenCards: ['card-b'] }).expect(200);

    expect(response.body.user.seenComments).toEqual(['comment-a', 'comment-b']);
    expect(response.body.user.seenCards).toEqual(['card-a', 'card-b']);
  });

  it('never lowers the last seen version', async () => {
    const response = await patch({ lastSeenVersion: 3 }).expect(200);
    expect(response.body.user.lastSeenVersion).toBe(5);
    const raised = await patch({ lastSeenVersion: 7 }).expect(200);
    expect(raised.body.user.lastSeenVersion).toBe(7);
  });

  it('rejects a wrong access key', async () => {
    await patch({ accessKey: 'wrong', seenCards: ['card-b'] }).expect(401);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    ['no changes', {}],
    ['non-array seen comments', { seenComments: 'comment-b' }],
    ['non-string seen cards', { seenCards: [{ $gt: '' }] }],
    ['a non-integer version', { lastSeenVersion: '7' }],
  ])('rejects %s', async (_name, body) => {
    await patch(body).expect(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects an invalid user id', async () => {
    await patch({ seenCards: ['card-b'] }, 'not-an-id').expect(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('does not create a user that does not exist', async () => {
    user = null;
    await patch({ seenCards: ['card-b'] }).expect(404);
  });

  it('reports database failures', async () => {
    databaseError = true;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await patch({ seenCards: ['card-b'] }).expect(500);
    log.mockRestore();
  });
});
