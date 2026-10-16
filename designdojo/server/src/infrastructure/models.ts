import mongoose, { Schema } from 'mongoose';

const ProblemSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    slug: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    topics: [{ type: String }],
    description: { type: String, required: true },
    functionalRequirements: [{ type: String }],
    constraints: [{ type: String }],
    acceptanceCriteria: [{ type: String }],
    hints: [{ type: String }],
    rubric: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

const PracticeAttemptSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    learnerId: { type: String, required: true, index: true },
    problemId: { type: String, required: true, index: true },
    attemptNumber: { type: Number, required: true },
    basedOnAttemptId: { type: String },
    submission: { type: Schema.Types.Mixed, required: true },
    status: {
      type: String,
      enum: ['SUBMITTED', 'EVALUATING', 'COMPLETED', 'FAILED'],
      required: true,
    },
    report: { type: Schema.Types.Mixed },
    failureReason: { type: String },
  },
  { timestamps: true }
);

PracticeAttemptSchema.index({ learnerId: 1, problemId: 1, createdAt: -1 });

export const ProblemModel = mongoose.model('Problem', ProblemSchema);
export const AttemptModel = mongoose.model('PracticeAttempt', PracticeAttemptSchema);


const UserSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true },
  },
  { timestamps: true }
);

export const UserModel = mongoose.models.User || mongoose.model('User', UserSchema);
