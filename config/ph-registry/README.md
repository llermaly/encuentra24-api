# P.H. Registry Matching

This folder is the human-editable feedback loop for extracting P.H. names from
Encuentra24 listing titles and descriptions.

## Files

- `registry.csv` contains canonical P.H. names from Registro Publico.
- `aliases.csv` maps common listing spellings, typos, abbreviations, or former
  names to a canonical ID from `registry.csv`.
- `ignore.txt` contains normalized false positives that the detector should stop
  reporting.

## Workflow

1. Add the Registro Publico list to `registry.csv`.
2. Run:

   ```bash
   npm run dev -- ph analyze --scan candidates --format csv -o data/ph-registry/reports/ph-review.csv
   ```

3. Open the CSV report and handle each `unmatched` or `review` row:
   - Add true new P.H. names to `registry.csv`.
   - Add misspellings or alternate display names to `aliases.csv`.
   - Add non-P.H. false positives to `ignore.txt`.
4. Re-run the report until unmatched/review candidates are clean enough.

Use `--scan all` when the registry list is populated and you want to find names
that appear without an explicit `P.H.`, `edificio`, `condominio`, or similar
marker. `--scan candidates` is faster for early discovery.

The default JSON report path is ignored by git under `data/`, so reports can be
large and local. Keep the curated registry, aliases, and ignore files in this
folder.
