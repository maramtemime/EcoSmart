#include "processing.h"

void afficher_menu() {
    printf("\n============================================\n");
    printf("         ECOCAMPUS - MODULE C (v1.0)        \n");
    printf("============================================\n");
    printf("1. Charger les mesures depuis measures_in.csv\n");
    printf("2. Afficher toutes les mesures\n");
    printf("3. Ajouter une mesure\n");
    printf("4. Supprimer une mesure\n");
    printf("5. Rechercher des mesures (Batiment / Ressource)\n");
    printf("6. Trier les mesures (Consommation / Date)\n");
    printf("7. Calculer & Afficher les Statistiques\n");
    printf("8. Calculer la Moyenne Mobile (Bonus)\n");
    printf("9. Exporter les donnees dans data.json\n");
    printf("0. Quitter\n");
    printf("============================================\n");
    printf("Choix : ");
}

int main(void) {
    Mesure *mesures = NULL;
    int nb_mesures = 0;
    int capacite = 0;
    int choix = -1;

    while (choix != 0) {
        afficher_menu();
        if (scanf("%d", &choix) != 1) {
            while (getchar() != '\n'); // Purge du tampon
            continue;
        }

        switch (choix) {
            case 1: {
                if (mesures != NULL) free(mesures);
                mesures = charger_fichier_csv("measures_in.csv", &nb_mesures, &capacite);
                // Export automatique : des que le CSV est charge, on ecrit data.json
                if (mesures != NULL) exporter_json("data.json", mesures, nb_mesures);
                break;
            }
            case 2:
                afficher_mesures(mesures, nb_mesures);
                break;

            case 3: {
                Mesure m;
                printf("Batiment (ex: ISET_Bizerte, ENIB) : ");
                scanf("%49s", m.batiment);
                printf("Ressource (electricite/eau/chauffage) : ");
                scanf("%19s", m.ressource);
                printf("Valeur consommee : ");
                scanf("%f", &m.valeur);
                printf("Seuil d'alerte : ");
                scanf("%f", &m.seuil);
                printf("Date (ex: 2026-03-30 10:00) : ");
                scanf(" %[^\n]", m.date);

                ajouter_mesure(&mesures, &nb_mesures, &capacite, m);
                break;
            }
            case 4: {
                int index;
                afficher_mesures(mesures, nb_mesures);
                printf("Entrez l'index (ID) a supprimer : ");
                scanf("%d", &index);
                supprimer_mesure(mesures, &nb_mesures, index);
                break;
            }
            case 5: {
                int sous_choix;
                printf("1. Rechercher par Batiment\n2. Rechercher par Ressource\nChoix : ");
                scanf("%d", &sous_choix);
                if (sous_choix == 1) {
                    char bat[50];
                    printf("Nom du batiment : ");
                    scanf("%49s", bat);
                    rechercher_par_batiment(mesures, nb_mesures, bat);
                } else if (sous_choix == 2) {
                    char res[20];
                    printf("Type de ressource : ");
                    scanf("%19s", res);
                    rechercher_par_ressource(mesures, nb_mesures, res);
                }
                break;
            }
            case 6: {
                int sous_choix;
                printf("1. Tri par consommation (Croissant)\n");
                printf("2. Tri par consommation (Decroissant)\n");
                printf("3. Tri par date\nChoix : ");
                scanf("%d", &sous_choix);
                if (sous_choix == 1) trier_par_consommation(mesures, nb_mesures, 1);
                else if (sous_choix == 2) trier_par_consommation(mesures, nb_mesures, 0);
                else if (sous_choix == 3) trier_par_date(mesures, nb_mesures);
                break;
            }
            case 7: {
                int nb_stats = 0;
                Statistique *stats = calculer_statistiques(mesures, nb_mesures, &nb_stats);
                afficher_statistiques(stats, nb_stats);
                if (stats) free(stats);
                break;
            }
            case 8: {
                char bat[50];
                int fenetre;
                printf("Nom du batiment : ");
                scanf("%49s", bat);
                printf("Taille de la fenetre (ex: 3 pour les 3 dernieres mesures) : ");
                scanf("%d", &fenetre);
                float mm = calculer_moyenne_mobile(mesures, nb_mesures, bat, fenetre);
                printf("Moyenne mobile (%d dernieres valeurs) pour %s = %.2f\n", fenetre, bat, mm);
                break;
            }
            case 9:
                exporter_json("data.json", mesures, nb_mesures);
                break;

            case 0:
                printf("Fermeture du programme.\n");
                break;

            default:
                printf("Choix invalide.\n");
        }
    }

    if (mesures != NULL) {
        free(mesures);
    }

    return 0;
}