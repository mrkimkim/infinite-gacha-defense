# Default v2 entry

Stacked base: preparation-recovery fe423c7670f67da19ec9cc6a07e0cb9a2f05b860 (PR38). This separate change only defaults a missing screen query to v2. Explicit ?screen=v1 keeps the previous game; explicit ?screen=v2 and v2-layout keep their routes. Seed/rules parsing and runtime rules are unchanged. No grace experiment or new art.

Validation: full296PASS/0FAIL/0SKIP, typecheck/portability/tooling and production build. Actual Chromium151 at390×844 and1165×747 confirms root and explicitv2 have the same initial stateHash c2777b34a837c685c7bee57c4697b3b6afed986443400d1cafbf2ca4a7a9891e; explicitv1 renders the legacy .shop and no v2 UI; root with seed3/count80 preserves both parameters. No page errors or horizontal overflow. This is browser automation, not human play.

Independent review of this narrow entry change is required separately from PR38. Site deployment belongs to the parent task and has not been performed here.
