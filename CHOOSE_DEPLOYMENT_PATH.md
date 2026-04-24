# ANTIVAXXER — Choose Your Deployment Path

**Version:** v5.5.1
**Read time:** 2 minutes

You have two ways to deploy ANTIVAXXER to production. Both work. Both follow the same operator phases (SES setup, first admin user, Stripe webhooks, etc.) — they just differ in WHERE the code runs.

This doc helps you pick. Then read the corresponding runbook.

---

## 30-second decision

### Pick PATH 2 (Vercel + Railway) if you want any of these:

- ✅ **Launch within a few hours, not a few days**
- ✅ Spend $10-40/mo at launch instead of $50-90
- ✅ Skip AWS Console / IAM / VPC / Secrets Manager
- ✅ Deploy via `git push` (auto-deploy on commit)
- ✅ Free tier covers low-volume launch
- ✅ Smaller team (1-3 people)

This is the **recommended path for most launches**.

### Pick PATH 1 (AWS Amplify + App Runner) if you have any of these:

- ✅ Existing AWS billing / audit / IAM setup the company already uses
- ✅ Compliance requirements (SOC2, HIPAA, etc.) requiring VPC isolation
- ✅ Expecting >50k orders/month at launch (uncommon for a new brand)
- ✅ Team operates AWS daily — consolidating vendor footprint
- ✅ Need fine-grained IAM / audit beyond what Railway/Vercel offer

If none of these apply: pick Path 2.

---

## Side-by-side comparison

| Concern | Path 1 (AWS) | Path 2 (Vercel + Railway) |
|---|---|---|
| Setup time | 8-12 hours | 2-4 hours |
| Number of services to configure | ~10 (VPC, RDS, S3, CloudFront, IAM, Secrets Manager, App Runner, Amplify, EventBridge, Lambda) | 3 hosting + AWS sliver for SES+S3 |
| Env var management | Secrets Manager + ARN references | Plain console fields |
| Deploy mechanism | App Runner GitHub integration + Amplify GitHub integration | git push triggers deploy on both |
| Monthly cost (low volume) | $50-90 | $10-40 |
| Maintenance burden | IAM rotation, VPC changes, SG management | None — managed |
| Database backups | RDS automated (7-day retention) | Railway/Render automated daily |
| SSL certificates | Auto via ACM | Auto via Let's Encrypt |
| Rollback mechanism | App Runner deployment history + Amplify history | Railway deployment history + Vercel deployment history |
| Cron jobs | EventBridge + Lambda (~10 lines of code + Console clicks) | Railway built-in cron (one form) OR Vercel Cron (one JSON file) |
| Custom domain setup | DNS + ACM cert | DNS only, SSL automatic |
| Auto-scaling | App Runner scales 1-3 instances | Railway scales by replica count, Vercel scales serverless |
| Observability | CloudWatch (separate console) | Railway logs + Vercel logs (in their dashboards) |

---

## What's the SAME on both paths

The code is identical. The codebase doesn't care which platform it runs on.

These operator phases apply to both paths exactly the same way:

- AWS SES production access request (24-48 hours wait)
- SES sending domain verification (DKIM)
- Cloudflare Turnstile site setup
- Stripe live keys + webhook endpoint + Stripe Tax activation
- Shippo API key + sender address + tracking webhook
- First admin user creation via SQL `UPDATE users SET role='admin'`
- Final 13-item smoke test

These are documented in `docs/PRE_LAUNCH_CHECKLIST.md` and folded into both runbooks.

---

## Migration between paths

You can switch later if your needs change.

### Path 2 → Path 1 (Vercel/Railway → AWS)
**When:** past ~50k orders/month, or compliance requires VPC. **Effort:** ~1-2 days. The code doesn't change; you're moving DB (Railway → RDS via `pg_dump`/`pg_restore`), API (Railway → App Runner), and frontend (Vercel → Amplify). DNS swap last.

### Path 1 → Path 2 (AWS → Vercel/Railway)
**When:** simplifying for a small team. **Effort:** ~1 day. Same migration in reverse.

The codebase is intentionally platform-agnostic — env vars do all the routing. There's no platform-specific code to rewrite.

---

## Honest recommendation for ANTIVAXXER specifically

Pick **Path 2 (Vercel + Railway)**. Reasons:

1. Single-product streetwear store at launch scale almost certainly stays under 50k orders/month for the first year
2. The lower setup time means you can launch faster, test the market, iterate
3. Lower monthly cost matters when revenue is unproven
4. If revenue justifies it later, migration to AWS is straightforward
5. Avoiding AWS-specific complexity (IAM, VPC, Secrets Manager rotation) means whoever inherits this project doesn't need AWS expertise

Path 1 is here because it's professionally complete and some companies require AWS. But for most launches, Path 2 is the right call.

---

## Next steps

- **Going with Path 2 (recommended):** Open `PATH_2_VERCEL_RAILWAY_RUNBOOK.md`
- **Going with Path 1:** Open `PATH_1_AWS_RUNBOOK.md`
- **Still undecided:** Re-read the "Pick PATH X if..." section above. If still 50/50, default to Path 2 — it's easier to migrate forward than to migrate backward.
