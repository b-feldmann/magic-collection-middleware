import express from 'express';
import supertest from 'supertest';
import { ObjectId } from 'mongodb';
import createCardRouter from '../src/routes/cards';

describe('get one card', () => {
  const cardUuid = '507f1f77bcf86cd799439011';
  let card;
  let databaseError;
  const findOne = jest.fn(async (filter) => {
    expect(filter).toEqual({ _id: new ObjectId(cardUuid) });
    if (databaseError) throw new Error('database unavailable');
    return card;
  });
  const app = express();
  const dbase = { collection: () => ({ findOne }) };
  app.use('/cards', createCardRouter(dbase));
  const request = (id = cardUuid, accessKey = 'test-key') =>
    supertest(app).get(`/cards/${id}`).query({ accessKey });

  beforeEach(() => {
    process.env.ACCESS_KEY = 'test-key';
    card = {
      _id: new ObjectId(cardUuid),
      name: 'Test card',
      front: { name: 'Test card', cardText: ['Rules text'] },
    };
    databaseError = false;
    findOne.mockClear();
  });

  it('returns a single card with its Mongo ID mapped to uuid', async () => {
    const result = await request().expect(200);

    expect(findOne).toHaveBeenCalledWith({ _id: new ObjectId(cardUuid) });
    expect(result.body).toEqual({
      card: {
        uuid: cardUuid,
        name: 'Test card',
        front: { name: 'Test card', cardText: ['Rules text'] },
      },
    });
  });

  it('rejects invalid access keys before reading the database', async () => {
    await request(cardUuid, 'wrong-key').expect(401);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('rejects malformed card IDs', async () => {
    await request('not-an-object-id').expect(400);
    expect(findOne).not.toHaveBeenCalled();
  });

  it('returns 404 when the card does not exist', async () => {
    card = null;
    await request().expect(404);
    expect(findOne).toHaveBeenCalledWith({ _id: new ObjectId(cardUuid) });
  });

  it('returns 500 when MongoDB fails', async () => {
    databaseError = true;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await request().expect(500);
    } finally {
      log.mockRestore();
    }
  });
});
