import assert from "node:assert/strict";
import test, { after } from "node:test";
import { db } from "../src/lib/db";

const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());

after(async () => {
  if (hasDatabase) await db.$disconnect();
});

test("PostgreSQL schema supports idempotent SEC filing writes", { skip: !hasDatabase }, async () => {
  const suffix = Date.now().toString().slice(-6);
  const ticker = `CI${suffix}`.slice(0, 10);
  const accessionNumber = `0000000000-26-${suffix.padStart(6, "0")}`;

  const symbol = await db.symbol.create({
    data: {
      ticker,
      name: "CI Migration Test",
      exchange: "TEST",
      type: "Common Stock",
      cik: "0000000000",
    },
  });

  try {
    const filing = {
      symbolId: symbol.id,
      cik: "0000000000",
      accessionNumber,
      form: "10-Q",
      filedAt: new Date("2026-08-30T00:00:00.000Z"),
      reportDate: new Date("2026-06-30T00:00:00.000Z"),
      acceptedAt: null,
      primaryDocument: "test.htm",
      sourceUrl: "https://www.sec.gov/example/test.htm",
    };

    const first = await db.secFiling.createMany({ data: [filing], skipDuplicates: true });
    const second = await db.secFiling.createMany({ data: [filing], skipDuplicates: true });

    assert.equal(first.count, 1);
    assert.equal(second.count, 0);
    assert.equal(await db.secFiling.count({ where: { accessionNumber } }), 1);
  } finally {
    await db.symbol.delete({ where: { id: symbol.id } });
  }
});
