from actuai_mock_data.generators.excel import generate_weekly_dashboard
from actuai_mock_data.generators.documents import generate_technical_documents
from actuai_mock_data.generators.emails import generate_supplier_emails

def run_all():
    print("Lancement de la simulation des sources non-structurées...\n")
    generate_weekly_dashboard(num_rows=15)
    generate_technical_documents(num_docs=10)
    generate_supplier_emails(num_emails=3)
    print("\nSimulation terminée.")

if __name__ == "__main__":
    run_all()