from fpdf import FPDF
from faker import Faker
from pathlib import Path
import random
from actuai_mock_data.config import settings

fake = Faker('fr_FR')

class PDF(FPDF):
    def header(self):
        self.set_font("helvetica", "B", 12)
        self.cell(0, 10, "DOCUMENTATION TECHNIQUE - AEROSPACE", border=False, align="C", new_x="LMARGIN", new_y="NEXT") # type: ignore
        self.ln(5)

def generate_technical_documents(num_docs: int = 5):
    print("Génération des documents PDF sur le disque réseau...")
    
    output_dir = Path(settings.mock_network_drive_dir) / "Fournisseurs_Archives"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    doc_types = ["Certificat_Matiere", "Rapport_8D", "PV_Controle"]
    
    for _ in range(num_docs):
        doc_type = random.choice(doc_types)
        po_number = f"PO-{fake.random_int(400000, 499999)}"
        part_ref = f"A350-TR-ACT-{fake.random_int(100, 999)}"
        # Indice de révision aérospatial (Mission 4 : contrôle documentaire).
        # Présent dans le nom de fichier ET le corps, pour que l'indexeur RAG
        # du backend puisse l'extraire en métadonnée.
        revision = random.choice("ABCD")

        pdf = PDF()
        pdf.add_page()
        pdf.set_font("helvetica", size=11)

        # Corps du document
        pdf.cell(0, 10, f"Type de Document : {doc_type.replace('_', ' ')}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 10, f"Référence Pièce : {part_ref}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 10, f"Numéro de Commande : {po_number}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 10, f"Révision : {revision}", new_x="LMARGIN", new_y="NEXT")
        pdf.cell(0, 10, f"Date de génération : {fake.date()}", new_x="LMARGIN", new_y="NEXT")
        pdf.ln(10)

        # Génération d'un texte factice simulant un rapport technique
        pdf.multi_cell(0, 7, f"Description technique :\n{fake.paragraph(nb_sentences=5)}")

        file_name = f"{doc_type}_{po_number}_rev{revision}.pdf"
        pdf.output(output_dir / file_name)
        
    print(f"{num_docs} fichiers PDF générés dans : {output_dir}")

if __name__ == "__main__":
    generate_technical_documents()