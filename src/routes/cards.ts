import { ObjectId } from 'mongodb';
import express from 'express';

import CardInterface from '../interfaces/CardInterface';
import { CardMainType, CardState, RarityType } from '../interfaces/enums';

const cardRouter = express.Router();

const COLLECTION_CARDS = 'cards';
const PATCH_PATH_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)*$/;
const isAllowedPatchPath = (path) => {
  if (typeof path !== 'string' || !PATCH_PATH_PATTERN.test(path)) return false;
  const segments = path.split('.');
  if (segments.some((segment) => ['__proto__', 'prototype', 'constructor'].includes(segment)))
    return false;
  if (['_id', '__v', 'uuid', 'loading'].includes(segments[0])) return false;
  if (segments[0] === 'meta' && segments.length === 1) return false;
  if (path === 'meta.likes' || path.startsWith('meta.likes.')) return false;
  if (path === 'meta.dislikes' || path.startsWith('meta.dislikes.')) return false;
  if (path === 'meta.lastUpdated') return false;
  return true;
};

const hasOverlappingPaths = (paths) =>
  paths.some((path, index) =>
    paths.some(
      (other, otherIndex) =>
        index !== otherIndex && (other.startsWith(`${path}.`) || path.startsWith(`${other}.`)),
    ),
  );

const EMPTY_CARD = (): CardInterface => ({
  name: '',
  front: {
    name: '',
    cardMainType: CardMainType.Creature,
    cardText: [],
  },
  manaCost: '',
  rarity: RarityType.Common,
  meta: {
    comment: '',
    likes: [],
    dislikes: [],
    lastUpdated: Date.now(),
    createdAt: Date.now(),
    state: CardState.Draft,
  },
});

const createCardRouter = (dbase) => {
  cardRouter.get('/', async (req, res) => {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const results = await dbase.collection(COLLECTION_CARDS).find().toArray();

      const returnedCards = results.map((single) => {
        const { _id, ...card }: { card: CardInterface; _id: string } = single;
        return { ...card, uuid: _id };
      });

      res.send({ cards: returnedCards });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  cardRouter.get('/:uuid', async (req, res) => {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const { uuid } = req.params;
    if (!ObjectId.isValid(uuid)) {
      res.sendStatus(400);
      return;
    }

    try {
      const card = await dbase.collection(COLLECTION_CARDS).findOne({
        _id: new ObjectId(uuid),
      });

      if (!card) {
        res.sendStatus(404);
        return;
      }

      const { _id, ...cardFields } = card;
      res.send({ card: { ...cardFields, uuid: _id.toString() } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  cardRouter.post('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const newCard = EMPTY_CARD();
      newCard.creator = req.body.creator;
      const result = await dbase.collection(COLLECTION_CARDS).insertOne(newCard);
      const createdCard = { ...newCard, uuid: result.insertedId };
      res.send({ card: createdCard });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  cardRouter.put('/', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const { uuid, ...card } = req.body.card;
      card.meta.lastUpdated = Date.now();

      await dbase
        .collection(COLLECTION_CARDS)
        .replaceOne({ _id: new ObjectId(uuid) }, { ...card }, { upsert: true });

      res.send({ card: { ...card, uuid } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  cardRouter.patch('/:uuid', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const { uuid } = req.params;
    const { set, unset = [] } = req.body;
    if (
      !ObjectId.isValid(uuid) ||
      !set ||
      typeof set !== 'object' ||
      Array.isArray(set) ||
      !Array.isArray(unset)
    ) {
      res.sendStatus(400);
      return;
    }

    const setPaths = Object.keys(set);
    const paths = [...setPaths, ...unset];
    if (
      paths.some((path) => !isAllowedPatchPath(path)) ||
      new Set(paths).size !== paths.length ||
      hasOverlappingPaths(paths)
    ) {
      res.sendStatus(400);
      return;
    }

    try {
      const setValues = { ...set, 'meta.lastUpdated': Date.now() };
      if (set['meta.state'] === CardState.Draft) {
        setValues['meta.likes'] = [];
        setValues['meta.dislikes'] = [];
      }
      const update: Record<string, unknown> = { $set: setValues };
      if (unset.length > 0) {
        update.$unset = Object.fromEntries(unset.map((path) => [path, '']));
      }
      const card = await dbase
        .collection(COLLECTION_CARDS)
        .findOneAndUpdate({ _id: new ObjectId(uuid) }, update, { returnDocument: 'after' });

      if (!card) {
        res.sendStatus(404);
        return;
      }

      const { _id, ...cardFields } = card;
      res.send({ card: { ...cardFields, uuid: _id.toString() } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  cardRouter.put('/:uuid/rating', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const { uuid } = req.params;
    const { userUuid: requestedUserUuid, rating } = req.body;
    if (
      !ObjectId.isValid(uuid) ||
      typeof requestedUserUuid !== 'string' ||
      !ObjectId.isValid(requestedUserUuid) ||
      ![null, 'like', 'dislike'].includes(rating)
    ) {
      res.sendStatus(400);
      return;
    }

    try {
      const userUuid = new ObjectId(requestedUserUuid).toHexString();
      const user = await dbase.collection('user').findOne({ _id: new ObjectId(userUuid) });
      if (!user) {
        res.sendStatus(404);
        return;
      }

      const voter = { $literal: [userUuid] };
      const likes = { $ifNull: ['$meta.likes', []] };
      const dislikes = { $ifNull: ['$meta.dislikes', []] };
      const update = [
        {
          $set: {
            'meta.likes':
              rating === 'like'
                ? { $setUnion: [likes, voter] }
                : { $setDifference: [likes, voter] },
            'meta.dislikes':
              rating === 'dislike'
                ? { $setUnion: [dislikes, voter] }
                : { $setDifference: [dislikes, voter] },
            'meta.lastUpdated': Date.now(),
          },
        },
      ];

      const card = await dbase
        .collection(COLLECTION_CARDS)
        .findOneAndUpdate({ _id: new ObjectId(uuid) }, update, { returnDocument: 'after' });

      if (!card) {
        res.sendStatus(404);
        return;
      }

      const { _id, ...cardFields } = card;
      res.send({ card: { ...cardFields, uuid: _id.toString() } });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  cardRouter.delete('/:uuid', async (req, res) => {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const { uuid } = req.params;
      const result = await dbase
        .collection(COLLECTION_CARDS)
        .deleteOne({ _id: new ObjectId(uuid) });

      if (result.deletedCount === 0) {
        res.sendStatus(404);
        return;
      }

      res.send({ uuid });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  return cardRouter;
};

export default createCardRouter;
