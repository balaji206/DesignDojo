import 'dotenv/config';
import mongoose from 'mongoose';
import { ProblemModel } from '../src/infrastructure/models.js';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  const problem = await ProblemModel.findOne({ slug: 'parking-lot' }).lean();
  console.log('Problem slug:', problem?.slug);
  console.log('Problem rubric:', JSON.stringify(problem?.rubric, null, 2));
  await mongoose.disconnect();
}

main().catch(console.error);
