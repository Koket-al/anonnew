import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import { AnonymousIdentity } from '../models/AnonymousIdentity.js';
import { AnonymousSession } from '../models/AnonymousSession.js';
import { Community } from '../models/Community.js';
import { CommunityMembership } from '../models/CommunityMembership.js';
import { Post } from '../models/Post.js';
import { Reply } from '../models/Reply.js';
import { ListeningRoom } from '../models/ListeningRoom.js';
import { ProfessionalAccount } from '../models/ProfessionalAccount.js';
import { Message } from '../models/Message.js';
import { Conversation } from '../models/Conversation.js';
import { Report } from '../models/Report.js';

async function seed() {
  console.log('[Seed] Connecting to database...');
  await connectDB();

  console.log('[Seed] Clearing all hardcoded messages, posts, communities, doctors, and rooms...');
  await Promise.all([
    AnonymousIdentity.deleteMany({}),
    AnonymousSession.deleteMany({}),
    Community.deleteMany({}),
    CommunityMembership.deleteMany({}),
    Post.deleteMany({}),
    Reply.deleteMany({}),
    ListeningRoom.deleteMany({}),
    ProfessionalAccount.deleteMany({}),
    Message.deleteMany({}),
    Conversation.deleteMany({}),
    Report.deleteMany({})
  ]);

  console.log('[Seed] All hardcoded messages, questions, communities, and clinician accounts successfully removed.');
  console.log('[Seed] Database is clean and ready for real community activity.');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('[Seed Error]:', err);
  process.exit(1);
});
