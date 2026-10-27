import express from 'express';
import supertest from 'supertest';
import { ObjectId } from 'mongodb';
import createAnnotationsRouter from '../src/routes/annotations';

// Small aggregation evaluator for the database boundary: exercises the actual
// emitted pipeline against documents without requiring an external MongoDB.
const evaluate = (expression, document, variables = {}) => {
  if (typeof expression === 'string' && expression.startsWith('$')) {
    const variable = expression.startsWith('$$');
    const parts = expression.slice(variable ? 2 : 1).split('.');
    return parts.reduce((value, key) => value?.[key], variable ? variables : document);
  }
  if (Array.isArray(expression))
    return expression.map((item) => evaluate(item, document, variables));
  if (!expression || typeof expression !== 'object') return expression;
  const run = (value) => evaluate(value, document, variables);
  const [operator, argument] = Object.entries(expression)[0];
  switch (operator) {
    case '$literal':
      return argument;
    case '$ifNull': {
      const [value, fallback] = run(argument);
      return value ?? fallback;
    }
    case '$eq': {
      const [a, b] = run(argument);
      return a === b;
    }
    case '$ne': {
      const [a, b] = run(argument);
      return a !== b;
    }
    case '$gt': {
      const [a, b] = run(argument);
      return a > b;
    }
    case '$size':
      return run(argument).length;
    case '$in': {
      const [value, values] = run(argument);
      return values.includes(value);
    }
    case '$cond':
      return run(argument[0]) ? run(argument[1]) : run(argument[2]);
    case '$concatArrays':
      return run(argument).flat();
    case '$setUnion':
      return [...new Set(run(argument).flat())];
    case '$setDifference': {
      const [a, b] = run(argument);
      return a.filter((value) => !b.includes(value));
    }
    case '$map':
    case '$filter': {
      const value = argument as { input: unknown; as: string; in?: unknown; cond?: unknown };
      const input = run(value.input);
      const apply = (item) =>
        evaluate(value.in ?? value.cond, document, {
          ...variables,
          [value.as]: item,
        });
      return operator === '$map' ? input.map(apply) : input.filter(apply);
    }
    default:
      return Object.fromEntries(
        Object.entries(expression).map(([key, value]) => [key, run(value)]),
      );
  }
};

describe('comment reactions', () => {
  const uuid = '507f1f77bcf86cd799439011';
  const userUuid = '507f191e810c19729de860ea';
  const otherUser = '507f191e810c19729de860eb';
  let annotation;
  let knownUser;
  let databaseError;
  const findOneAndUpdate = jest.fn(async (filter, pipeline, options) => {
    if (databaseError) throw new Error('database unavailable');
    expect(filter).toEqual({ _id: new ObjectId(uuid) });
    expect(options).toEqual({ returnDocument: 'after' });
    if (!annotation) return null;
    pipeline.forEach((stage) => {
      annotation = { ...annotation, ...evaluate(stage.$set, annotation) };
    });
    return annotation;
  });
  const app = express();
  app.use(express.json());
  app.use(
    '/annotations',
    createAnnotationsRouter({
      collection: (name) =>
        name === 'user'
          ? {
              findOne: async () => (knownUser ? { _id: new ObjectId(userUuid) } : null),
            }
          : { findOneAndUpdate },
    }),
  );
  const request = (body = {}, id = uuid) =>
    supertest(app)
      .put(`/annotations/${id}/reactions`)
      .send({
        accessKey: 'test-key',
        userUuid,
        emoji: '🔥',
        active: true,
        ...body,
      });

  beforeEach(() => {
    process.env.ACCESS_KEY = 'test-key';
    annotation = {
      _id: new ObjectId(uuid),
      content: 'Hello',
      author: otherUser,
      cardReference: 'card',
      datetime: 123,
      edited: false,
    };
    knownUser = true;
    databaseError = false;
    findOneAndUpdate.mockClear();
  });

  it('adds the first reaction to a legacy comment without editing it', async () => {
    const result = await request().expect(200);
    expect(result.body.annotation).toEqual({
      uuid,
      content: 'Hello',
      author: otherUser,
      cardReference: 'card',
      datetime: 123,
      edited: false,
      reactions: [{ emoji: '🔥', users: [userUuid] }],
    });
  });

  it('is idempotent and preserves other users and emojis', async () => {
    annotation.reactions = [
      { emoji: '🔥', users: [otherUser] },
      { emoji: '❤️', users: [otherUser] },
    ];
    await request().expect(200);
    const result = await request().expect(200);
    expect(result.body.annotation.reactions).toEqual([
      { emoji: '🔥', users: [otherUser, userUuid] },
      { emoji: '❤️', users: [otherUser] },
    ]);
  });

  it('removes only the requesting user and drops empty groups', async () => {
    annotation.reactions = [
      { emoji: '🔥', users: [userUuid, otherUser] },
      { emoji: '❤️', users: [userUuid] },
    ];
    await request({ active: false }).expect(200);
    const result = await request({ active: false, emoji: '❤️' }).expect(200);
    expect(result.body.annotation.reactions).toEqual([{ emoji: '🔥', users: [otherUser] }]);
    await request({ active: false, emoji: '❤️' }).expect(200);
    expect(annotation.reactions).toEqual([{ emoji: '🔥', users: [otherUser] }]);
  });

  it('does not create empty reactions when removing from a legacy comment', async () => {
    const result = await request({ active: false }).expect(200);
    expect(result.body.annotation.reactions).toEqual([]);
  });

  it('counts uppercase and lowercase identifiers as the same user', async () => {
    await request().expect(200);
    const result = await request({ userUuid: userUuid.toUpperCase() }).expect(200);
    expect(result.body.annotation.reactions).toEqual([{ emoji: '🔥', users: [userUuid] }]);
    const removed = await request({ userUuid: userUuid.toUpperCase(), active: false }).expect(200);
    expect(removed.body.annotation.reactions).toEqual([]);
  });

  it.each(['👍🏽', '👩‍💻', '🇩🇪', '1️⃣', '❤️'])('accepts picker emoji %s', async (emoji) => {
    const result = await request({ emoji }).expect(200);
    expect(result.body.annotation.reactions).toEqual([{ emoji, users: [userUuid] }]);
  });

  it('rejects an invalid access key before writing', async () => {
    await request({ accessKey: 'wrong' }).expect(401);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it.each([
    { emoji: '' },
    { emoji: 'hello' },
    { emoji: '$reactions' },
    { emoji: '🔥'.repeat(40) },
    { emoji: {} },
    { active: 'true' },
    { active: null },
    { userUuid: '-1' },
    { userUuid: {} },
  ])('rejects malformed input %j', async (body) => {
    await request(body).expect(400);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects an invalid comment identifier', async () => {
    await request({}, 'bad-id').expect(400);
  });
  it('returns 404 for unknown users without writing', async () => {
    knownUser = false;
    await request().expect(404);
    expect(findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('returns 404 for a missing comment without upserting', async () => {
    annotation = null;
    await request().expect(404);
  });
  it('returns 500 on a database failure', async () => {
    databaseError = true;
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    await request().expect(500);
    log.mockRestore();
  });
});
