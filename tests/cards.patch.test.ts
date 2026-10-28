import express from 'express';
import supertest from 'supertest';
import { ObjectId } from 'mongodb';
import createCardRouter from '../src/routes/cards';

const setPath = (target, path, value) => {
  const keys = path.split('.');
  const leaf = keys.pop();
  const parent = keys.reduce((current, key) => current[key], target);
  parent[leaf] = value;
};

const unsetPath = (target, path) => {
  const keys = path.split('.');
  const leaf = keys.pop();
  const parent = keys.reduce((current, key) => current[key], target);
  delete parent[leaf];
};

const evaluatePipelineExpression = (expression, document) => {
  if (typeof expression === 'string' && expression.startsWith('$')) {
    return expression
      .slice(1)
      .split('.')
      .reduce((value, key) => value?.[key], document);
  }
  if (Array.isArray(expression))
    return expression.map((item) => evaluatePipelineExpression(item, document));
  if (!expression || typeof expression !== 'object') return expression;
  if ('$literal' in expression) return expression.$literal;
  if ('$ifNull' in expression) {
    const [value, fallback] = evaluatePipelineExpression(expression.$ifNull, document);
    return value ?? fallback;
  }
  if ('$setUnion' in expression) {
    return [...new Set(evaluatePipelineExpression(expression.$setUnion, document).flat())];
  }
  if ('$setDifference' in expression) {
    const [values, removed] = evaluatePipelineExpression(expression.$setDifference, document);
    return values.filter((value) => !removed.includes(value));
  }
  return Object.fromEntries(
    Object.entries(expression).map(([key, value]) => [
      key,
      evaluatePipelineExpression(value, document),
    ]),
  );
};

describe('card partial updates', () => {
  const cardUuid = '507f1f77bcf86cd799439011';
  const firstVoter = '507f191e810c19729de860ea';
  const secondVoter = '507f191e810c19729de860eb';
  let card;
  let databaseError;
  let knownUser;
  const findOneAndUpdate = jest.fn(async (filter, update, options) => {
    expect(filter).toEqual({ _id: new ObjectId(cardUuid) });
    expect(options).toEqual({ returnDocument: 'after' });
    if (databaseError) throw new Error('database unavailable');
    if (!card) return null;
    if (Array.isArray(update)) {
      update.forEach((stage) => {
        const changes = Object.fromEntries(
          Object.entries(stage.$set).map(([path, value]) => [
            path,
            evaluatePipelineExpression(value, card),
          ]),
        );
        Object.entries(changes).forEach(([path, value]) => setPath(card, path, value));
      });
    } else {
      Object.entries(update.$set || {}).forEach(([path, value]) => setPath(card, path, value));
      Object.keys(update.$unset || {}).forEach((path) => unsetPath(card, path));
    }
    return card;
  });
  const app = express();
  app.use(express.json());
  const dbase = {
    collection: (name) =>
      name === 'user'
        ? { findOne: async () => (knownUser ? { _id: new ObjectId(firstVoter) } : null) }
        : { findOneAndUpdate },
  };
  app.use('/cards', createCardRouter(dbase));
  const request = (body = {}, id = cardUuid) =>
    supertest(app)
      .patch(`/cards/${id}`)
      .send({
        accessKey: 'test-key',
        set: { 'front.name': 'Updated card' },
        ...body,
      });
  const ratingRequest = (body = {}, id = cardUuid) =>
    supertest(app)
      .put(`/cards/${id}/rating`)
      .send({
        accessKey: 'test-key',
        userUuid: firstVoter,
        rating: 'like',
        ...body,
      });

  beforeEach(() => {
    process.env.ACCESS_KEY = 'test-key';
    card = {
      _id: new ObjectId(cardUuid),
      name: 'Card',
      front: { name: 'Card', cardText: ['Keep this text'] },
      back: { name: 'Back' },
      meta: { likes: ['existing-voter'], dislikes: [], lastUpdated: 1 },
    };
    databaseError = false;
    knownUser = true;
    findOneAndUpdate.mockClear();
  });

  it('updates only requested paths and returns the complete merged card', async () => {
    const result = await request({ unset: ['back'] }).expect(200);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new ObjectId(cardUuid) },
      {
        $set: { 'front.name': 'Updated card', 'meta.lastUpdated': expect.any(Number) },
        $unset: { back: '' },
      },
      { returnDocument: 'after' },
    );
    expect(result.body.card).toEqual({
      uuid: cardUuid,
      name: 'Card',
      front: { name: 'Updated card', cardText: ['Keep this text'] },
      meta: { likes: ['existing-voter'], dislikes: [], lastUpdated: expect.any(Number) },
    });
  });

  it('preserves separate edits made by clients with the same stale card snapshot', async () => {
    await request().expect(200);
    const result = await request({ set: { name: 'Updated title' } }).expect(200);

    expect(result.body.card).toMatchObject({
      uuid: cardUuid,
      name: 'Updated title',
      front: { name: 'Updated card', cardText: ['Keep this text'] },
      meta: { likes: ['existing-voter'] },
    });
  });

  it('clears ratings atomically when a card is returned to Draft', async () => {
    card.meta.likes = ['voter'];
    card.meta.dislikes = ['other-voter'];

    const result = await request({ set: { 'meta.state': 'Draft' } }).expect(200);

    expect(result.body.card.meta).toMatchObject({
      state: 'Draft',
      likes: [],
      dislikes: [],
    });
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { _id: new ObjectId(cardUuid) },
      {
        $set: {
          'meta.state': 'Draft',
          'meta.likes': [],
          'meta.dislikes': [],
          'meta.lastUpdated': expect.any(Number),
        },
      },
      { returnDocument: 'after' },
    );
  });

  it('rejects invalid access keys before writing', async () => {
    await request({ accessKey: 'wrong' }).expect(401);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects malformed card IDs', async () => {
    await request({}, 'bad-id').expect(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    { set: null },
    { set: { $set: 'bad' } },
    { set: { uuid: 'other-card' } },
    { set: { _id: 'other-id' } },
    { set: { 'front..name': 'bad' } },
    { set: { 'front.$name': 'bad' } },
    { unset: ['meta.likes'] },
    { unset: ['front.name', 'front.name'] },
  ])('rejects malformed or protected patch paths (%j)', async (body) => {
    await request(body).expect(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('returns 404 without upserting a missing card', async () => {
    card = null;
    await request().expect(404);
    expect(findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when MongoDB fails', async () => {
    databaseError = true;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await request().expect(500);
    log.mockRestore();
  });

  it('preserves both voters when they rate from the same initial card', async () => {
    await ratingRequest({ userUuid: firstVoter }).expect(200);
    const result = await ratingRequest({ userUuid: secondVoter }).expect(200);

    expect(result.body.card.meta.likes).toEqual(['existing-voter', firstVoter, secondVoter]);
    expect(result.body.card.meta.dislikes).toEqual([]);
    expect(findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: new ObjectId(cardUuid) },
      [
        {
          $set: {
            'meta.likes': {
              $setUnion: [{ $ifNull: ['$meta.likes', []] }, { $literal: [secondVoter] }],
            },
            'meta.dislikes': {
              $setDifference: [{ $ifNull: ['$meta.dislikes', []] }, { $literal: [secondVoter] }],
            },
            'meta.lastUpdated': expect.any(Number),
          },
        },
      ],
      { returnDocument: 'after' },
    );
  });

  it('moves or clears only the requesting voter and preserves the other votes', async () => {
    card.meta.likes.push(firstVoter, secondVoter);
    card.meta.dislikes.push('other-dislike');

    const switched = await ratingRequest({ rating: 'dislike' }).expect(200);
    expect(switched.body.card.meta.likes).toEqual(['existing-voter', secondVoter]);
    expect(switched.body.card.meta.dislikes).toEqual(['other-dislike', firstVoter]);

    const cleared = await ratingRequest({ rating: null }).expect(200);
    expect(cleared.body.card.meta.likes).toEqual(['existing-voter', secondVoter]);
    expect(cleared.body.card.meta.dislikes).toEqual(['other-dislike']);
  });

  it('rejects invalid rating requests before changing the card', async () => {
    await ratingRequest({ accessKey: 'wrong' }).expect(401);
    await ratingRequest({ rating: 'neutral' }).expect(400);
    await ratingRequest({ userUuid: 'not-an-id' }).expect(400);
    knownUser = false;
    await ratingRequest().expect(404);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
});
