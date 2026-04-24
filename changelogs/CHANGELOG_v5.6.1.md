# v5.6.1 — Documentation cleanup

**Release:**
**Migration required:** NO
**Code changes:** None — documentation only

## Summary

Doc-only release. No application code was modified.

## Changes

- README expanded from 180 to 325 lines with Architecture, Features, Database Models, Environment Variables, and Available Scripts sections
- CONTRIBUTING.md restored (was missing from bundle)
- Version references updated across all docs (README, runbooks, VERSION_NAMING, GAP_TRACKER)
- Specific dates removed from all changelogs, runbooks, and internal docs
- Legal page `lastUpdated` prop cleared (prop value only, no logic change)
- Stale references fixed (ADMIN_TOKEN in setup instructions → NEXTAUTH_SECRET, broken DEV_OPERATIONS_PLAYBOOK.md → CONTRIBUTING.md)
