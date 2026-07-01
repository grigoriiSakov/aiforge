# python-django

Designed for Django applications that use the standard `manage.py` workflow.

Default assumptions:

- `python manage.py check` for a lightweight implementation sanity check
- `python manage.py test` for tests
- `python -m ruff check .` for linting
- GitHub-style issue tracking by default

Use this profile as a starting point for Django monoliths, Django REST Framework APIs, and admin-heavy internal applications.
