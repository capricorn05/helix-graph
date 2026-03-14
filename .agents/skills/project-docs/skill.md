---
name: project-docs
description: Use this when the task involves documenting code changes, writing or updating how-to guides, recording bug fixes, or updating the roadmap for this repository.
---

# Project Docs Skill

Follow this workflow:

1. Inspect the files changed and determine whether the work affects:
   - changelog
   - roadmap
   - bug fix notes
   - how-to documentation

2. Update the relevant documentation:
   - `docs/CHANGELOG.md`
   - `docs/ROADMAP.md`
   - `docs/fixes/*.md`
   - `docs/how-to/*.md`

3. For bug fixes, record:
   - issue summary
   - user/developer impact
   - root cause
   - exact fix
   - affected files
   - validation done

4. For how-to guides, include:
   - purpose
   - prerequisites
   - exact commands
   - expected result
   - troubleshooting notes

5. In the final response, include:
   - what docs were updated
   - what files were touched
   - whether anything still needs manual follow-up

Do not create duplicate docs if an existing file should be updated instead.
