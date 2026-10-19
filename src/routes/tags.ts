import express from 'express';

const tagRouter = express.Router();
const COLLECTION_TAGS = 'tags';

const createTagsRouter = (dbase) => {
  tagRouter.get('/', async (req, res) => {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const results = await dbase.collection(COLLECTION_TAGS).find().toArray();
      const tags = results
        .map((tag) => tag.name)
        .filter((name) => typeof name === 'string')
        .sort((a, b) => a.localeCompare(b));

      res.send({ tags });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  tagRouter.post('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const name = typeof req.body.tag === 'string' ? req.body.tag.trim() : '';
    if (!name) {
      res.sendStatus(400);
      return;
    }

    try {
      await dbase
        .collection(COLLECTION_TAGS)
        .updateOne({ name }, { $set: { name } }, { upsert: true });
      res.send({ tag: name });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  return tagRouter;
};

export default createTagsRouter;
