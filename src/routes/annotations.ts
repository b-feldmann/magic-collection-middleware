import { ObjectId } from 'mongodb';

import express from 'express';

const annotationRouter = express.Router();

const COLLECTION_ANNOTATIONS = 'annotations';

// Accept native picker emoji, including joined sequences, flags and keycaps,
// but not arbitrary text or aggregation expressions.
const EMOJI_PATTERN =
  /^(?:[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}]|\uFE0F|\u200D|\u20E3|[\u{E0020}-\u{E007F}]|[0-9#*](?=\uFE0F?\u20E3))+$/u;
const EMOJI_BASE_PATTERN = /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20E3]/u;

const idToUuid = (mechanic) => {
  const { _id, ...rest } = mechanic;
  return { ...rest, uuid: _id };
};

const createAnnotationsRouter = (dbase) => {
  annotationRouter.put('/:uuid/reactions', async (req, res) => {
    if (req.body.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    const { userUuid: requestedUserUuid, emoji, active } = req.body;
    const { uuid } = req.params;
    if (
      !ObjectId.isValid(uuid) ||
      typeof requestedUserUuid !== 'string' ||
      !ObjectId.isValid(requestedUserUuid) ||
      typeof emoji !== 'string' ||
      emoji.length > 64 ||
      !EMOJI_PATTERN.test(emoji) ||
      !EMOJI_BASE_PATTERN.test(emoji) ||
      typeof active !== 'boolean'
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

      const reactions = { $ifNull: ['$reactions', []] };
      const annotation = await dbase.collection(COLLECTION_ANNOTATIONS).findOneAndUpdate(
        { _id: new ObjectId(uuid) },
        [
          {
            $set: {
              reactions: {
                $concatArrays: [
                  {
                    $map: {
                      input: reactions,
                      as: 'reaction',
                      in: {
                        $cond: [
                          { $eq: ['$$reaction.emoji', { $literal: emoji }] },
                          {
                            emoji: { $literal: emoji },
                            users: {
                              [active ? '$setUnion' : '$setDifference']: [
                                '$$reaction.users',
                                { $literal: [userUuid] },
                              ],
                            },
                          },
                          '$$reaction',
                        ],
                      },
                    },
                  },
                  {
                    $cond: [
                      {
                        $in: [
                          { $literal: emoji },
                          {
                            $map: {
                              input: reactions,
                              as: 'reaction',
                              in: '$$reaction.emoji',
                            },
                          },
                        ],
                      },
                      [],
                      {
                        $literal: active ? [{ emoji, users: [userUuid] }] : [],
                      },
                    ],
                  },
                ],
              },
            },
          },
          {
            $set: {
              reactions: {
                $filter: {
                  input: '$reactions',
                  as: 'reaction',
                  cond: { $gt: [{ $size: '$$reaction.users' }, 0] },
                },
              },
            },
          },
        ],
        { returnDocument: 'after' },
      );

      if (!annotation) {
        res.sendStatus(404);
        return;
      }
      res.send({ annotation: idToUuid(annotation) });
    } catch (err) {
      console.log(err);
      res.sendStatus(500);
    }
  });

  annotationRouter.get('/', async (req, res) => {
    if (req.query.accessKey !== process.env.ACCESS_KEY) {
      res.sendStatus(401);
      return;
    }

    try {
      const results = await dbase.collection(COLLECTION_ANNOTATIONS).find().toArray();

      res.send({
        annotations: results.map((annotation) => idToUuid(annotation)),
      });
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
