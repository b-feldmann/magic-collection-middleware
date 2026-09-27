import { ObjectId } from 'mongodb';

import express from 'express';

const annotationRouter = express.Router();

const COLLECTION_ANNOTATIONS = 'annotations';

const idToUuid = (mechanic) => {
  const { _id, ...rest } = mechanic;
  return { ...rest, uuid: _id };
};

const createAnnotationsRouter = (dbase) => {
  annotationRouter.get('/', async (req, res) => {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const results = await dbase.collection(COLLECTION_ANNOTATIONS).find().toArray();

      res.send({ annotations: results.map((annotation) => idToUuid(annotation)) });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  annotationRouter.post('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const annotation = {
        content: req.body.content,
        author: req.body.author,
        cardReference: req.body.cardReference,
        datetime: Date.now(),
        edited: false,
      };

      const result = await dbase.collection(COLLECTION_ANNOTATIONS).insertOne(annotation);
      res.send({ annotation: { ...annotation, uuid: result.insertedId } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  annotationRouter.put('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const { uuid, ...annotation } = req.body.annotation;

      await dbase
        .collection(COLLECTION_ANNOTATIONS)
        .replaceOne({ _id: new ObjectId(uuid) }, { ...annotation, edited: true }, { upsert: true });

      res.send({ annotation: { ...annotation, uuid, edited: true } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  return annotationRouter;
};

export default createAnnotationsRouter;
