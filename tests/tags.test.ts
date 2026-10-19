import express from 'express';
import supertest from 'supertest';

import createTagsRouter from '../src/routes/tags';

describe('tags route', () => {
  const tags = new Set<string>();
  const app = express();
  app.use(express.json());
  app.use(
    '/tags',
    createTagsRouter({
      collection: () => ({
        find: () => ({ toArray: async () => [...tags].map((name) => ({ name })) }),
        updateOne: async (_filter, update) => {
          tags.add(update.$set.name);
        },
      }),
    }),
  );

  beforeEach(() => {
    process.env.ACCESS_KEY = 'test-key';
    tags.clear();
  });

  it('returns stored tag names', async () => {
    tags.add('Existing');

    await supertest(app)
      .get('/tags')
      .query({ accessKey: 'test-key' })
      .expect(200, { tags: ['Existing'] });
  });

  it('creates a tag idempotently', async () => {
    await supertest(app)
      .post('/tags')
      .send({ accessKey: 'test-key', tag: 'New Tag' })
      .expect(200, { tag: 'New Tag' });

    await supertest(app)
      .post('/tags')
      .send({ accessKey: 'test-key', tag: 'New Tag' })
      .expect(200, { tag: 'New Tag' });

    expect([...tags]).toEqual(['New Tag']);
  });
});
