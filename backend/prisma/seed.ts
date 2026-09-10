import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");
  await prisma.refreshToken.deleteMany().catch(() => {});
  await prisma.message.deleteMany().catch(() => {});
  await prisma.booking.deleteMany().catch(() => {});
  await prisma.skill.deleteMany().catch(() => {});
  await prisma.review.deleteMany().catch(() => {});
  await prisma.user.deleteMany().catch(() => {});

  const password = await bcrypt.hash("password123", 10);

  const alice = await prisma.user.create({
    data: {
      name: "Alice Tutor",
      email: "alice@example.com",
      password,
      bio: "CS student, 3 yrs tutoring",
    },
  });

  const bob = await prisma.user.create({
    data: {
      name: "Bob Learner",
      email: "bob@example.com",
      password,
      bio: "CompSci sophomore",
    },
  });

  await prisma.skill.create({
    data: {
      title: "Intro to React (30m)",
      description: "Fast intro to React with hands-on examples.",
      tags: ["react", "frontend"],
      priceCents: 1000,
      durationMin: 30,
      ownerId: alice.id,
    },
  });

  console.log("Seed finished.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });