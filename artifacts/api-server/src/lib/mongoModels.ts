import mongoose, { Schema, Document, Model } from "mongoose";

/* ── Visit ───────────────────────────────────────────────────────────────── */
export interface IVisit extends Document {
  url: string;
  ip: string;
  country: string;
  ref: string | null;
  userAgent: string;
  time: Date;
}

const visitSchema = new Schema<IVisit>({
  url:       { type: String, required: true },
  ip:        { type: String, default: "unknown" },
  country:   { type: String, default: "unknown" },
  ref:       { type: String, default: null },
  userAgent: { type: String, default: "" },
  time:      { type: Date,   default: Date.now },
});

visitSchema.index({ time: -1 });
visitSchema.index({ country: 1 });
visitSchema.index({ ref: 1 });

export const Visit: Model<IVisit> =
  mongoose.models["Visit"] ?? mongoose.model<IVisit>("Visit", visitSchema);

/* ── Lead ────────────────────────────────────────────────────────────────── */
export interface ILead extends Document {
  email: string;
  ref: string | null;
  ip: string;
  country: string;
  time: Date;
}

const leadSchema = new Schema<ILead>({
  email:   { type: String, required: true, lowercase: true, trim: true },
  ref:     { type: String, default: null },
  ip:      { type: String, default: "unknown" },
  country: { type: String, default: "unknown" },
  time:    { type: Date,   default: Date.now },
});

leadSchema.index({ email: 1 }, { unique: true });
leadSchema.index({ time: -1 });
leadSchema.index({ ref: 1 });

export const Lead: Model<ILead> =
  mongoose.models["Lead"] ?? mongoose.model<ILead>("Lead", leadSchema);

/* ── Referral ────────────────────────────────────────────────────────────── */
export interface IReferral extends Document {
  refId: string;
  clicks: number;
  conversions: number;
  createdAt: Date;
}

const referralSchema = new Schema<IReferral>({
  refId:       { type: String, required: true, unique: true },
  clicks:      { type: Number, default: 0 },
  conversions: { type: Number, default: 0 },
  createdAt:   { type: Date,   default: Date.now },
});

referralSchema.index({ refId: 1 }, { unique: true });

export const Referral: Model<IReferral> =
  mongoose.models["Referral"] ?? mongoose.model<IReferral>("Referral", referralSchema);
