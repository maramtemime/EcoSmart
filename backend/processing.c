#include "processing.h"
#include <ctype.h>

/* Compare deux textes sans tenir compte des majuscules/minuscules.
   Cette fonction remplace strcasecmp, qui ne fonctionne pas partout. */
static int comparer_sans_casse(const char *texte1, const char *texte2) {
    while (*texte1 && *texte2) {
        int c1 = tolower((unsigned char)*texte1);
        int c2 = tolower((unsigned char)*texte2);
        if (c1 != c2) return c1 - c2;
        texte1++;
        texte2++;
    }
    return tolower((unsigned char)*texte1) - tolower((unsigned char)*texte2);
}

/**
 * Charge les mesures depuis le fichier CSV de maniere dynamique.
 */
Mesure* charger_fichier_csv(const char *nom_fichier, int *nb_mesures, int *capacite) {
    FILE *fichier = fopen(nom_fichier, "r");
    if (fichier == NULL) {
        printf("[ERREUR] Impossible d'ouvrir le fichier : %s\n", nom_fichier);
        *nb_mesures = 0;
        *capacite = 0;
        return NULL;
    }

    *capacite = 10;
    *nb_mesures = 0;
    Mesure *tableau = (Mesure *)malloc((*capacite) * sizeof(Mesure));

    if (tableau == NULL) {
        printf("[ERREUR] Erreur d'allocation memoire initiale.\n");
        fclose(fichier);
        return NULL;
    }

    char ligne[256];

    // Ignorer l'en-tete du fichier CSV (batiment,ressource,valeur,seuil,date)
    fgets(ligne, sizeof(ligne), fichier);

    // Lecture ligne par ligne
    while (fgets(ligne, sizeof(ligne), fichier) != NULL) {
        // Redimensionnement dynamique du tableau si necessaire
        if (*nb_mesures >= *capacite) {
            *capacite *= 2;
            Mesure *temp = (Mesure *)realloc(tableau, (*capacite) * sizeof(Mesure));
            if (temp == NULL) {
                printf("[ERREUR] Erreur de reallocation memoire.\n");
                fclose(fichier);
                return tableau; // Retourne ce qui a ete charge jusqu'ici
            }
            tableau = temp;
        }

        // Extraction des donnees de la ligne CSV
        int lus = sscanf(ligne, " %49[^,],%19[^,],%f,%f, %19[^\n\r]",
                         tableau[*nb_mesures].batiment,
                         tableau[*nb_mesures].ressource,
                         &tableau[*nb_mesures].valeur,
                         &tableau[*nb_mesures].seuil,
                         tableau[*nb_mesures].date);

        if (lus == 5) {
            // Evaluation immediate du statut d'alerte
            tableau[*nb_mesures].alerte = (tableau[*nb_mesures].valeur > tableau[*nb_mesures].seuil) ? 1 : 0;
            (*nb_mesures)++;
        }
    }

    fclose(fichier);
    printf("[SUCCES] %d mesures chargees depuis %s\n", *nb_mesures, nom_fichier);
    return tableau;
}
