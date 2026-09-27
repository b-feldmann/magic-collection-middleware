import express from 'express';
import { ObjectId } from 'mongodb';

const deckRouter = express.Router();

const COLLECTION_NAME = 'decks';

const idToUuid = (user) => {
  const { _id, ...rest } = user;
  return { ...rest, uuid: _id };
};

const createDeckRouter = (dbase) => {
  deckRouter.get('/all', async (req, res) => {
    try {
      const results = await dbase
        .collection(COLLECTION_NAME)
        .find({ hash: req.query.hash })
        .toArray();

      res.send({
        decks: results.map((singleDeck) => ({
          name: singleDeck.name,
          uuid: singleDeck._id,
          cover: singleDeck.cover,
          commander: singleDeck.commander,
        })),
      });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  deckRouter.get('/', async (req, res) => {
    try {
      const result = await dbase
        .collection(COLLECTION_NAME)
        .findOne({ _id: new ObjectId(String(req.query.uuid)) });

      if (!result) {
        res.send();
        return;
      }

      res.send({ deck: idToUuid(result) });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  deckRouter.post('/', async (req, res) => {
    const { name, hash, cover, commander } = req.body;

    try {
      const result = await dbase
        .collection(COLLECTION_NAME)
        .insertOne({ name, hash, cover, commander, cards: [] });

      res.send({ deck: { name, uuid: result.insertedId } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  deckRouter.put('/', async (req, res) => {
    try {
      const { uuid, ...deck } = req.body.deck;

      await dbase
        .collection(COLLECTION_NAME)
        .replaceOne({ _id: new ObjectId(uuid) }, { ...deck }, { upsert: true });

      res.send({ deck: { ...deck, uuid } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  return deckRouter;
};

export default createDeckRouter;
