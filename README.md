# Dangerzone stats

This repository contains a script that generates nightly statistics for the
Dangerzone project, by looking at the information from Github Releases.

Generate the files locally with:

```sh
uv run generate_stats.py
```

The publication to Github pages is done via the instructions in
`.github/workflows/publish.yml`.
