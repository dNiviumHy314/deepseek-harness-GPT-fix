# Disabled upstream workflows

These files are preserved copies of workflows inherited from the official DeepSeek Harness repository.

They are intentionally outside `.github/workflows/`, so GitHub Actions does not discover or run them in this personal fork. They may reference optional upstream secret names or publication services, but this fork does not configure or use those secrets.

Do not move any file back into `.github/workflows/` without reviewing its permissions, triggers, external services, artifact paths, and secret usage.
