# Preparation restart recovery

Base main: a408b946cfd8062ad3fd546b9e32cd31f8f0dacb; exact tree83123dc73105877cd2cd797c5a3b7d7643f15a4a matches the earlier294-test integration.

PR28 comment6096990320 was independently reproduced with the actual core/session in both count profiles: seed1,12 rerolls before recruitment leaves gold0, no board units, and no session restart. This change adds an explicit preparation restart confirmation after any accepted action. Cancel/Escape keep the current game; confirmation archives its exact replay/hash before replacing the match with the same seed/profile. Fresh untouched preparation and combat cannot restart. Retired-owner inputs and repeated confirmation cannot add another archive. Result restart remains available. Focus moves to the first offer after restart.

No engine, economic, profile, asset, or experimental-grace change. Header still identifies unapproved technical fixtures. Default source entry remains historical v1; v2 uses ?screen=v2.

Validation: focused session30PASS; full check296PASS/0FAIL/0SKIP plus typecheck/portability/tooling and production build. Actual Chromium151 headless,390×844 and1165×747, both count profiles:12 pointer rerolls, zero-gold state, cancel and Escape preserving canonical state, keyboard-confirmed restart, focus recovery, exact old replay download, new recruitment/deployment/start/pause, both old/new Node replay hashes. No page errors or horizontal overflow. This is browser automation, not human fun testing. Existing result restart/archive tests also pass.

Independent peer review of this new diff remains required before merging/deploying the recovery change.
