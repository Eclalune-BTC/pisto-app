# Course project

Pisto is also the team project *Sistema Financiero para PYMES* for the UFG course "Aplicación de
Técnicas de Ingeniería de Software". The teacher grades each phase against a written guide and a
Word document from the team. This page holds what the repository needs from the course; product
decisions stay in their own guides.

## Phases

| Phase | Scope | Evidence |
| --- | --- | --- |
| Fase 2 | Design: requirements, user stories HU-01 to HU-15, class and relational model, prototypes (figures 9 to 25) | Team document *Cuarta Entrega*, kept outside the repository |
| Fase 3 (Sprint 1) | MVP: repository and README, API with sessions, roles, errors and realtime, migrations and seed, screens from the prototypes, exported API collection, live demo | [Fase 3 evidence](fase3-entrega.md), [Postman collection](postman/pisto.postman_collection.json), hosted demo in the [README](../README.md) |
| Fase 4 | Automated tests: unit tests of services and controllers, integration tests, end-to-end tests and BDD/Gherkin acceptance suites, as announced in the Fase 3 guide | Not started |

For Fase 4, start from what exists: `bun run check` already runs the unit and integration suites
(Bun test runner, PostgreSQL integration tests); there is no end-to-end or Gherkin suite yet. The
gates are in [testing and release](testing-release.md).

## Course rules that affect the repository

- Every team member must commit regularly from their own GitHub account. Check `git shortlog -sn`
  before a delivery, and never write commits in a teammate's name.
- Branches: `main` is what was delivered, `develop` integrates, `feature/*` holds one capability.
- The Phase 2 prototypes define the screens; the [design system](design-system.md) owns the tokens.
- The application carries no university name, logo or credit.
- Graders use the demo accounts and data from `bun run db:seed`, described in the README.

## Course documents

The Word and PDF documents stay outside the repository: their cover lists the students' names and
student IDs, and the repository is public. Each new document continues the format and the figure and
table numbering of the previous one; the Fase 3 document uses figures 27 to 77 and tables 7 to 16.

- Page: Letter; margins 2.5 cm top and bottom, 3 cm left and right; page number top right, except on
  the cover.
- Text: Times New Roman 12, justified, 1.5 line spacing. Headings follow APA: level 1 centered bold on
  a new page, level 2 left bold, level 3 bold italic.
- Figures: "Figura N. Title" above the image and "*Nota.* ..." below it. Screens show the desktop and
  phone views side by side on `#E4E6E1`, like the prototypes. Code comes from the public GitHub
  repository, pinned to a commit, with the relevant lines highlighted.
- Tables: "Tabla N – Title"; header `#156082` with white text, bands `#C1E4F5`, borders `#45B0E1`;
  then "Fuente: Elaboración propia."
