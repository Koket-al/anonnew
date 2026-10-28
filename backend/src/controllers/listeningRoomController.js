import xss from 'xss';
import { ListeningRoom } from '../models/ListeningRoom.js';

export async function listListeningRooms(req, res, next) {
  try {
    const rooms = await ListeningRoom.find({ isClosed: false })
      .sort({ updatedAt: -1 })
      .limit(30)
      .populate('creator', 'username avatarSeed')
      .populate('activeParticipants', 'username avatarSeed');

    const formatted = rooms.map(r => ({
      id: r._id,
      title: r.title,
      topic: r.topic,
      description: r.description,
      guidelines: r.guidelines,
      creator: r.creator?.username || 'Anonymous',
      creatorId: r.creator?._id,
      isCreator: req.identity && r.creator?._id?.toString() === req.identity._id?.toString(),
      activeParticipantCount: r.activeParticipants?.length || 0,
      maxParticipants: r.maxParticipants,
      createdAt: r.createdAt
    }));

    res.json({
      success: true,
      rooms: formatted
    });
  } catch (error) {
    next(error);
  }
}

export async function createListeningRoom(req, res, next) {
  try {
    const { title, topic, description } = req.body;

    if (!title || title.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Room title must be at least 3 characters.' });
    }

    if (!topic || topic.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Topic category is required.' });
    }

    const room = await ListeningRoom.create({
      title: xss(title.trim()),
      topic: xss(topic.trim()),
      description: description ? xss(description.trim().slice(0, 300)) : '',
      creator: req.identity._id,
      activeParticipants: [req.identity._id]
    });

    res.status(201).json({
      success: true,
      room: {
        id: room._id,
        title: room.title,
        topic: room.topic,
        description: room.description,
        guidelines: room.guidelines,
        activeParticipantCount: 1,
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function getListeningRoom(req, res, next) {
  try {
    const { id } = req.params;
    const room = await ListeningRoom.findById(id)
      .populate('creator', 'username avatarSeed')
      .populate('activeParticipants', 'username avatarSeed');

    if (!room) {
      return res.status(404).json({ success: false, error: 'Listening room not found.' });
    }

    if (room.isClosed) {
      return res.status(410).json({ success: false, error: 'This listening room has ended.' });
    }

    res.json({
      success: true,
      room: {
        id: room._id,
        title: room.title,
        topic: room.topic,
        description: room.description,
        guidelines: room.guidelines,
        creator: room.creator?.username || 'Anonymous',
        creatorId: room.creator?._id,
        isCreator: req.identity && room.creator?._id?.toString() === req.identity._id?.toString(),
        participants: room.activeParticipants.map(p => ({
          id: p._id,
          username: p.username,
          avatarSeed: p.avatarSeed
        })),
        createdAt: room.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

export async function joinListeningRoom(req, res, next) {
  try {
    const { id } = req.params;
    const currentId = req.identity._id;

    const room = await ListeningRoom.findById(id);
    if (!room || room.isClosed) {
      return res.status(404).json({ success: false, error: 'Listening room not found or closed.' });
    }

    if (!room.activeParticipants.some(p => p.toString() === currentId.toString())) {
      if (room.activeParticipants.length >= room.maxParticipants) {
        return res.status(400).json({ success: false, error: 'This room is currently full.' });
      }
      room.activeParticipants.push(currentId);
      await room.save();
    }

    res.json({ success: true, message: 'Joined room.' });
  } catch (error) {
    next(error);
  }
}

export async function leaveListeningRoom(req, res, next) {
  try {
    const { id } = req.params;
    const currentId = req.identity._id;

    const room = await ListeningRoom.findById(id);
    if (room) {
      room.activeParticipants = room.activeParticipants.filter(p => p.toString() !== currentId.toString());
      await room.save();
    }

    res.json({ success: true, message: 'Left room.' });
  } catch (error) {
    next(error);
  }
}

export async function closeListeningRoom(req, res, next) {
  try {
    const { id } = req.params;
    const currentId = req.identity._id;

    const room = await ListeningRoom.findById(id);
    if (!room) {
      return res.status(404).json({ success: false, error: 'Room not found.' });
    }

    if (room.creator.toString() !== currentId.toString()) {
      return res.status(403).json({ success: false, error: 'Only the room creator can close this room.' });
    }

    room.isClosed = true;
    room.activeParticipants = [];
    await room.save();

    res.json({ success: true, message: 'Listening room closed.' });
  } catch (error) {
    next(error);
  }
}
