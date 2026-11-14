import mongoose from "mongoose";

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI غير موجود في .env");
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  console.log("MongoDB متصل:", mongoose.connection.name);
}
