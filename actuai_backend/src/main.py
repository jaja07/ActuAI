from fastapi import FastAPI
from api.routers import triggers
from database.connection import init_db

app = FastAPI(
    title="ActuAI Backend", 
    description="API de l'orchestrateur LangGraph et Datalake"
)

@app.on_event("startup")
def on_startup():
    print("🚀 Démarrage du backend ActuAI...")
    init_db()
    # Tu pourrais aussi lancer l'ETL ici automatiquement si besoin

# Inclusion des routeurs
# app.include_router(triggers.router, prefix="/api/triggers", tags=["Triggers"])
# app.include_router(hitl.router, prefix="/api/hitl", tags=["Human in the Loop"])

@app.get("/health")
def health_check():
    return {"status": "ok", "system": "ActuAI Backend Online"}