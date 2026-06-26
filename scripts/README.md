# scripts/ — Simulateur end-to-end

Rejoue un cas réel : un e-mail fictif entre dans le système et traverse toute la
chaîne jusqu'à l'écriture SAP, avec une narration de chaque étape.

```
email entrant
  -> Agent de sécurité L0   (bloque les injections de prompt)
  -> Superviseur            (route vers le bon agent)
  -> Agent spécialisé       (Transactionnel / Investigatif / Responder)
  -> file Human-in-the-Loop (un brouillon attend ; rien n'est écrit dans SAP)
  -> approbation humaine
  -> écriture SAP réelle     (PUT update-date) — uniquement après validation
```

## Prérequis (déjà actifs dans le setup local)

1. Mock SAP sur `http://localhost:8080`
2. Backend API sur `http://localhost:8000`
3. Datalake synchronisé **une fois** depuis SAP :
   ```bash
   cd actuai_backend/src
   uv run python -m etl.sap_connector
   ```
   (sinon l'agent transactionnel ne trouve pas la commande et crée une tâche de « triage »).

## Lancer

Depuis la racine du dépôt :

- **Windows / PowerShell**
  ```powershell
  ./scripts/demo_e2e.ps1
  ```
- **Multi-plateforme / Python**
  ```bash
  uv run python scripts/demo_e2e.py
  # ou : python scripts/demo_e2e.py
  ```

Options communes : `-Backend/--backend`, `-Mock/--mock`, `-User/--user`,
`-Password/--password`.

## Ce que le script démontre

| Étape | Ce qui se passe |
|---|---|
| 0 | Vérifie que backend + mock répondent |
| 1 | Connexion `expert / expert123` (comme dans l'UI) |
| 2 | Un e-mail **hostile** est **bloqué** par l'agent de sécurité L0 |
| 3 | Un e-mail **fournisseur** (retard) → l'agent transactionnel rédige un brouillon SAP |
| 4 | Le brouillon apparaît dans la **file de validation** |
| 5 | L'humain **approuve** → l'action est exécutée |
| 6 | La date de livraison **change réellement** côté SAP |
| 7 | Bonus : une **question client** → l'agent Responder rédige une réponse |

Après le script, ouvrez l'UI (`http://localhost:5173`) et cliquez **Refresh** :
les tâches non encore validées y sont visibles.
