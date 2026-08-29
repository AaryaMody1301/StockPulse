-- AlterTable
ALTER TABLE "symbols" ADD COLUMN "cik" VARCHAR(10);

-- CreateTable
CREATE TABLE "sec_filings" (
    "id" SERIAL NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "cik" VARCHAR(10) NOT NULL,
    "accessionNumber" VARCHAR(30) NOT NULL,
    "form" VARCHAR(20) NOT NULL,
    "filedAt" DATE NOT NULL,
    "reportDate" DATE,
    "acceptedAt" TIMESTAMP(3),
    "primaryDocument" VARCHAR(500),
    "sourceUrl" VARCHAR(1000) NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sec_filings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sec_facts" (
    "factKey" VARCHAR(64) NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "cik" VARCHAR(10) NOT NULL,
    "taxonomy" VARCHAR(30) NOT NULL,
    "concept" VARCHAR(200) NOT NULL,
    "label" VARCHAR(500),
    "description" TEXT,
    "unit" VARCHAR(50) NOT NULL,
    "value" DECIMAL(38,10) NOT NULL,
    "startDate" DATE,
    "endDate" DATE NOT NULL,
    "filedAt" DATE,
    "accessionNumber" VARCHAR(30) NOT NULL,
    "form" VARCHAR(20) NOT NULL,
    "frame" VARCHAR(30),
    "fiscalYear" INTEGER,
    "fiscalPeriod" VARCHAR(10),
    "ingestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sec_facts_pkey" PRIMARY KEY ("factKey")
);

-- CreateTable
CREATE TABLE "sec_metrics" (
    "metricKey" VARCHAR(64) NOT NULL,
    "symbolId" INTEGER NOT NULL,
    "metric" VARCHAR(50) NOT NULL,
    "value" DECIMAL(38,10) NOT NULL,
    "unit" VARCHAR(50) NOT NULL,
    "startDate" DATE,
    "endDate" DATE NOT NULL,
    "filedAt" DATE,
    "accessionNumber" VARCHAR(30) NOT NULL,
    "form" VARCHAR(20) NOT NULL,
    "taxonomy" VARCHAR(30) NOT NULL,
    "concept" VARCHAR(200) NOT NULL,
    "frame" VARCHAR(30),
    "fiscalYear" INTEGER,
    "fiscalPeriod" VARCHAR(10),
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sec_metrics_pkey" PRIMARY KEY ("metricKey")
);

-- CreateIndex
CREATE INDEX "symbols_cik_idx" ON "symbols"("cik");

-- CreateIndex
CREATE UNIQUE INDEX "sec_filings_accessionNumber_key" ON "sec_filings"("accessionNumber");

-- CreateIndex
CREATE INDEX "sec_filings_symbolId_filedAt_idx" ON "sec_filings"("symbolId", "filedAt");

-- CreateIndex
CREATE INDEX "sec_filings_cik_filedAt_idx" ON "sec_filings"("cik", "filedAt");

-- CreateIndex
CREATE INDEX "sec_filings_form_filedAt_idx" ON "sec_filings"("form", "filedAt");

-- CreateIndex
CREATE INDEX "sec_facts_symbolId_concept_endDate_idx" ON "sec_facts"("symbolId", "concept", "endDate");

-- CreateIndex
CREATE INDEX "sec_facts_symbolId_accessionNumber_idx" ON "sec_facts"("symbolId", "accessionNumber");

-- CreateIndex
CREATE INDEX "sec_facts_cik_endDate_idx" ON "sec_facts"("cik", "endDate");

-- CreateIndex
CREATE INDEX "sec_metrics_symbolId_metric_endDate_idx" ON "sec_metrics"("symbolId", "metric", "endDate");

-- CreateIndex
CREATE INDEX "sec_metrics_symbolId_accessionNumber_idx" ON "sec_metrics"("symbolId", "accessionNumber");

-- AddForeignKey
ALTER TABLE "sec_filings" ADD CONSTRAINT "sec_filings_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_facts" ADD CONSTRAINT "sec_facts_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sec_metrics" ADD CONSTRAINT "sec_metrics_symbolId_fkey" FOREIGN KEY ("symbolId") REFERENCES "symbols"("id") ON DELETE CASCADE ON UPDATE CASCADE;
