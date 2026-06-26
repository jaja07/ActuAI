#!/usr/bin/env python3
"""
scripts/mail_connector.py — Connecteur e-mail RÉEL (Microsoft Graph -> ActuAI).

Lit votre boîte Outlook.com via Microsoft Graph (OAuth 2.0, flux device-code) et
transmet chaque NOUVEAU message au webhook /api/ingest/email. Vous envoyez un
vrai mail depuis n'importe quel compte vers votre adresse Outlook connectée, et
l'application réagit toute seule (sécurité -> routage -> agent -> file HITL).

Pourquoi Graph et pas IMAP+mot de passe : Microsoft a supprimé l'authentification
"basique" sur Outlook.com ; OAuth 2.0 est désormais obligatoire.

PRÉREQUIS (voir scripts/MAIL_CONNECTOR_SETUP_FR.md) :
  - une App enregistrée dans Microsoft Entra (gratuit) -> un "client id"
    avec la permission déléguée Microsoft Graph "Mail.Read" et
    "Allow public client flows = Yes".
  - la lib msal (installée à la volée par uv avec --with msal).

UTILISATION (depuis la racine, stack Docker en marche) :
  uv run --with msal python scripts/mail_connector.py --client-id <APP_ID>
  (options) --backend http://localhost  --authority consumers  --interval 8

Le script affiche un code + une URL : ouvrez-la, connectez-vous à votre compte
Outlook, autorisez l'accès en lecture. Ensuite il sonde l'inbox en boucle.
Ctrl+C pour arrêter. Lecture seule (Mail.Read) : il ne modifie rien dans la boîte.
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone

import requests

try:
    import msal
except ImportError:
    sys.exit("msal manquant. Lancez avec :  uv run --with msal python scripts/mail_connector.py ...")

GRAPH = "https://graph.microsoft.com/v1.0"
SCOPES = ["Mail.Read"]


def main() -> int:
    p = argparse.ArgumentParser(description="Connecteur e-mail Microsoft Graph -> ActuAI")
    p.add_argument("--client-id", required=True, help="Application (client) ID de l'app Entra")
    p.add_argument("--backend", default="http://localhost", help="URL du backend (proxy nginx :80 en Docker)")
    p.add_argument("--authority", default="consumers",
                   help="'consumers' (comptes perso Outlook.com), 'common', ou un tenant id")
    p.add_argument("--interval", type=int, default=8, help="Intervalle de sondage (s)")
    args = p.parse_args()

    authority = (args.authority if args.authority.startswith("http")
                 else f"https://login.microsoftonline.com/{args.authority}")

    # --- OAuth 2.0 : flux device-code (aucun secret, client public) --------
    app = msal.PublicClientApplication(args.client_id, authority=authority)
    flow = app.initiate_device_flow(scopes=SCOPES)
    if "user_code" not in flow:
        return _fail(f"Echec device flow : {flow.get('error_description', flow)}")
    print("\n" + "=" * 60)
    print(flow["message"])   # "Ouvrez https://microsoft.com/devicelogin et entrez le code ..."
    print("=" * 60 + "\n")
    result = app.acquire_token_by_device_flow(flow)  # bloque jusqu'à la connexion
    if "access_token" not in result:
        return _fail(f"Echec d'authentification : {result.get('error_description')}")
    account = app.get_accounts()[0] if app.get_accounts() else None
    who = result.get("id_token_claims", {}).get("preferred_username", "compte connecté")
    print(f"Connecté en tant que {who}. Surveillance de la boîte de réception…")
    print(f"-> Envoyez un e-mail à cette adresse ; il apparaîtra dans ActuAI.\n")

    def token() -> str:
        if account:
            silent = app.acquire_token_silent(SCOPES, account=account)
            if silent and "access_token" in silent:
                return silent["access_token"]
        return result["access_token"]

    seen: set[str] = set()
    start = datetime.now(timezone.utc).isoformat()

    while True:
        try:
            r = requests.get(
                f"{GRAPH}/me/mailFolders/inbox/messages",
                headers={"Authorization": f"Bearer {token()}"},
                params={"$top": 15, "$orderby": "receivedDateTime desc",
                        "$select": "id,subject,from,bodyPreview,receivedDateTime"},
                timeout=20,
            )
            if r.status_code == 401:
                print("  (jeton expiré, réauthentification nécessaire — relancez le script)")
                return 1
            r.raise_for_status()
            messages = r.json().get("value", [])
            for m in reversed(messages):              # plus anciens d'abord
                mid = m["id"]
                if mid in seen:
                    continue
                seen.add(mid)
                if m.get("receivedDateTime", "") < start:
                    continue                          # ignore les mails antérieurs au démarrage
                sender = (m.get("from") or {}).get("emailAddress", {}).get("address", "inconnu")
                subject = m.get("subject", "") or "(sans objet)"
                body = m.get("bodyPreview", "") or ""
                ts = datetime.now().strftime("%H:%M:%S")
                try:
                    resp = requests.post(
                        f"{args.backend}/api/ingest/email",
                        json={"sender": sender, "subject": subject, "body": body},
                        timeout=30,
                    ).json()
                    status = resp.get("status", "?")
                    color = "\033[35m" if status == "blocked" else "\033[32m"
                    print(f"{ts}  {color}mail de {sender} : « {subject} » -> {status}\033[0m")
                    if resp.get("summary"):
                        print(f"          {resp['summary']}")
                except Exception as e:
                    print(f"{ts}  erreur d'envoi au backend : {e}")
        except requests.exceptions.RequestException as e:
            print(f"  erreur Graph : {e}")
        time.sleep(args.interval)


def _fail(msg: str) -> int:
    print(msg, file=sys.stderr)
    return 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nArrêté.")
        sys.exit(130)
