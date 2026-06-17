import pandas as pd
from faker import Faker
import random
from pathlib import Path
from datetime import timedelta
from actuai_mock_data.config import settings

fake = Faker('fr_FR')

def generate_weekly_dashboard(num_rows: int = 20):
    print("📊 Génération du tableau de bord Excel partagé...")
    
    # Création du dossier cible s'il n'existe pas
    output_dir = Path(settings.mock_excel_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    data = []
    suppliers = ["Safran", "Thales", "Liebherr", "Moog"]
    statuses = ["En cours", "Bloqué Qualité", "En transit", "AOG Risk"]
    
    for _ in range(num_rows):
        data.append({
            "Part Reference": f"A350-TR-ACT-{fake.random_int(100, 999)}",
            "Supplier": random.choice(suppliers),
            "Expected Date": fake.date_between(start_date='-5d', end_date='+15d').strftime("%Y-%m-%d"),
            "Current Status": random.choice(statuses),
            "Manual Notes": fake.sentence(nb_words=6) if random.random() > 0.5 else ""
        })
        
    df = pd.DataFrame(data)
    file_path = output_dir / "Suivi_Hebdo_Actuation.xlsx"
    
    # Écriture du fichier Excel
    df.to_excel(file_path, index=False, engine='openpyxl')
    print(f"✅ Fichier Excel généré : {file_path}")

if __name__ == "__main__":
    generate_weekly_dashboard()