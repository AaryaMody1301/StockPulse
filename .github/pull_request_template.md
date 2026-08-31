## Summary

Describe the user-visible or operational change and why it is needed.

## Integrity checklist

- [ ] Provider/SEC/imported/browser/AI inputs remain runtime-validated at trust boundaries.
- [ ] Missing or partial data is not converted into fabricated numeric values or silently dropped state.
- [ ] Financial comparisons use compatible units, reporting contexts, and time ranges.
- [ ] Source provenance remains visible for SEC evidence and deterministic calculations.
- [ ] Optional AI output remains grounded to known evidence IDs and does not introduce recommendation/price-target behavior.
- [ ] No credentials, private research exports, or production secrets are committed.

## Verification

- [ ] `npm run check`
- [ ] `npm run build`
- [ ] Database migration behavior verified when Prisma/migrations change
- [ ] Deployment/operator follow-up documented when CI cannot exercise it

## Provider/licensing impact

State whether the change affects market-data providers, quotas, display/redistribution rights, attribution, or external API behavior. Write `None` when it does not.
