// backend/seed.js
import "dotenv/config";
import mongoose from "mongoose";
import Level from "./src/model/level.schema.js";

const levels = [
  {
    number: 1,
    title: "Level 1 — The Beginning",
    mcq: {
      question: "Which planet is known as the Red Planet?",
      options: ["Venus", "Mars", "Jupiter", "Saturn"],
      correctIndex: 1,
    },
    groups: {
      A: { clue: "Go to the library. Look behind the third shelf on the left.", secretCode: "LIBA1" },
      B: { clue: "Go to the library. Look behind the fifth shelf on the right.", secretCode: "LIBB1" },
      C: { clue: "Go to the library. Check the magazine rack corner.", secretCode: "LIBC1" },
    },
  },
  {
    number: 2,
    title: "Level 2 — Hidden Path",
    mcq: {
      question: "What is the capital of Japan?",
      options: ["Beijing", "Seoul", "Tokyo", "Bangkok"],
      correctIndex: 2,
    },
    groups: {
      A: { clue: "Check the notice board near the main gate — left side.", secretCode: "GATEA2" },
      B: { clue: "Check the notice board near the main gate — right side.", secretCode: "GATEB2" },
      C: { clue: "Check the notice board near the back gate.", secretCode: "GATEC2" },
    },
  },
  {
    number: 3,
    title: "Level 3 — Deeper",
    mcq: {
      question: "How many sides does a hexagon have?",
      options: ["5", "6", "7", "8"],
      correctIndex: 1,
    },
    groups: {
      A: { clue: "Ask the canteen staff for the special menu — morning shift.", secretCode: "FOODA3" },
      B: { clue: "Ask the canteen staff for the special menu — evening shift.", secretCode: "FOODB3" },
      C: { clue: "Ask the canteen staff for the special menu — weekend special.", secretCode: "FOODC3" },
    },
  },
  {
    number: 4,
    title: "Level 4 — The Final",
    mcq: {
      question: "Who wrote Romeo and Juliet?",
      options: ["Dickens", "Shakespeare", "Tolstoy", "Hemingway"],
      correctIndex: 1,
    },
    groups: {
      A: { clue: "The final code is hidden near the principal's office door.", secretCode: "FINALA4" },
      B: { clue: "The final code is hidden near the staff room door.", secretCode: "FINALB4" },
      C: { clue: "The final code is hidden near the auditorium entrance.", secretCode: "FINALC4" },
    },
  },
];

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB || "hintgame",
  });
  await Level.bulkWrite(
    levels.map((level) => ({
      updateOne: {
        filter: { number: level.number },
        update: { $set: level },
        upsert: true,
      },
    }))
  );
  console.log("✅ Seeded 4 levels with per-group clues and codes");
  await mongoose.disconnect();
};

run().catch((e) => {
  console.error(e);
  mongoose.disconnect().finally(() => {
    process.exitCode = 1;
  });
});