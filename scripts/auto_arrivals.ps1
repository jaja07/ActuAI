# scripts/auto_arrivals.ps1 — Flux d'arrivee automatique d'e-mails (demo).
#
# Simule l'arrivee continue d'e-mails (fournisseurs + clients) en appelant le
# webhook /api/ingest/email a intervalle regulier. La file de validation se
# remplit "toute seule" pendant que vous montrez l'UI (qui s'auto-rafraichit).
# En production, un connecteur Exchange/Graph remplacerait cette boucle.
#
# Couvre les 5 missions + la reponse client :
#   M1 retard (SAP) · M2 planning · M3 non-conformite (FNC)
#   M4 documentation · M5 tracabilite · ClientReply (Responder)
#
# Utilisation (depuis la racine, stack Docker en marche) :
#   ./scripts/auto_arrivals.ps1                 # toutes les 12 s, via le proxy :80
#   ./scripts/auto_arrivals.ps1 -IntervalSec 8
#   ./scripts/auto_arrivals.ps1 -Backend http://localhost:8000 -Mock http://localhost:8080
# Ctrl+C pour arreter.

param(
  [int]$IntervalSec = 12,
  [string]$Backend = "http://localhost",        # proxy nginx (port 80) en Docker
  [string]$Mock    = "http://localhost:8080"
)
$ErrorActionPreference = "Stop"
$senders = @(
  "claire.dubois.achats@outlook.com",
  "a.martin@nacelle-systems.fr",
  "achats@aero-supply.com",
  "supply@parker-aero.com"
)
Write-Host "Flux d'arrivees demarre (intervalle ${IntervalSec}s). Ctrl+C pour arreter." -ForegroundColor Cyan
while ($true) {
  try {
    $pos = Invoke-RestMethod "$Mock/api/bapi/purchase-orders/"
    $po  = $pos[(Get-Random -Maximum $pos.Count)].po_number
    $tpl = @(
      @{m="ClientReply"; subject="Question livraison"; body="Bonjour, quand la commande $po sera-t-elle livree ?"},
      @{m="M1"; subject="Retard fournisseur"; body="La commande $po est retardee de 8 jours."},
      @{m="M2"; subject="Impact planning";    body="Impact planning : la commande $po est retardee, quel risque sur la ligne d'assemblage et la production A350 ?"},
      @{m="M3"; subject="Non-conformite";     body="Non-conformite sur la commande $po, ouverture FNC pour defaut matiere."},
      @{m="M4"; subject="Documentation";      body="Please retrieve the latest document version of the Manufacturing Record DF and the material certificate."},
      @{m="M5"; subject="Tracabilite";        body="Reconstruct the traceability and verify the serial number SN-7781 for PO-A350-88123."}
    ) | Get-Random
    $body = @{ sender=($senders|Get-Random); subject=$tpl.subject; body=$tpl.body } | ConvertTo-Json
    Invoke-RestMethod -Method Post "$Backend/api/ingest/email" -ContentType "application/json" -Body $body | Out-Null
    Write-Host ("{0}  {1,-11} injecte  ({2})" -f (Get-Date -Format HH:mm:ss), $tpl.m, $po) -ForegroundColor Green
  } catch {
    Write-Host ("{0}  erreur: {1}" -f (Get-Date -Format HH:mm:ss), $_) -ForegroundColor Red
  }
  Start-Sleep -Seconds $IntervalSec
}
