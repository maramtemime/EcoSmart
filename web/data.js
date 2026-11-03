/* =====================================================================
   EcoCampus - js/data.js
   Personne 1 (Rayen) : chargement et verification des donnees

   Lit data.json (genere par le module C), verifie chaque mesure et
   fournit aux autres modules un tableau propre et toujours au meme format.

   Format d'une mesure apres chargement :
   {
     id:        0,                   // position dans data.json
     batiment:  "ENIB",
     ressource: "electricite",       // electricite | eau | gaz
     valeur:    7037.7,
     seuil:     6072.59,
     unite:     "kWh",
     date:      Date,                // objet Date (tri, filtre par periode)
     dateTexte: "2024-01-01 00:00",  // texte pret a afficher
     alerte:    true                 // valeur > seuil
   }

   Utilisation (ex. dans interface.js) :
     const data = await loadData();
     if (!data) return;              // l'erreur est deja affichee
     afficherTableau(data.mesures);
   ===================================================================== */

// Chemin relatif a index.html
const CHEMIN_DATA = "data.json";

// Unites du CSV, utilisees si data.json ne les contient pas
const UNITES = { electricite: "kWh", eau: "m3", gaz: "m3" };

// Donnees partagees avec les autres modules (remplies par loadData)
const donnees = {
  mesures: [], // mesures valides
  stats: [], // statistiques par batiment calculees par le module C
  rejets: [], // mesures ecartees et la raison (pour le debogage)
};

/**
 * Charge data.json, verifie les mesures et remplit `donnees`.
 * Retourne `donnees`, ou null si le chargement a echoue.
 */
async function loadData(chemin = CHEMIN_DATA) {
  try {
    const json = await lireFichierJSON(chemin);

    if (!json || !Array.isArray(json.measures)) {
      throw new Error(
        `Format inattendu : la liste "measures" est absente de ${chemin}.`,
      );
    }

    const mesures = [];
    const rejets = [];
    let alertesCorrigees = 0;

    json.measures.forEach((brute, index) => {
      const resultat = verifierMesure(brute, index);
      if (resultat.erreur) {
        rejets.push({ index, raison: resultat.erreur, mesure: brute });
        return;
      }
      if (
        typeof brute.alerte === "boolean" &&
        brute.alerte !== resultat.mesure.alerte
      ) {
        alertesCorrigees++;
      }
      mesures.push(resultat.mesure);
    });

    if (mesures.length === 0) {
      throw new Error(
        `Aucune mesure valide dans ${chemin} (${rejets.length} rejetée(s)).`,
      );
    }

    donnees.mesures = mesures;
    donnees.stats = Array.isArray(json.stats) ? json.stats : [];
    donnees.rejets = rejets;

    const nbAlertes = mesures.filter((m) => m.alerte).length;
    console.info(
      `[data.js] ${mesures.length} mesures chargées, ${rejets.length} rejetée(s), ` +
        `${nbAlertes} en alerte, ${alertesCorrigees} alerte(s) corrigée(s).`,
    );
    if (rejets.length > 0)
      console.table(rejets.map((r) => ({ index: r.index, raison: r.raison })));

    return donnees;
  } catch (erreur) {
    console.error("[data.js]", erreur);
    afficherErreurChargement(erreur.message);
    return null;
  }
}

/**
 * Recupere le fichier avec fetch() et le convertit en objet JS.
 * Chaque cas d'echec produit un message clair pour l'utilisateur.
 */
async function lireFichierJSON(chemin) {
  let reponse;
  try {
    reponse = await fetch(chemin);
  } catch (e) {
    // fetch() echoue sans reponse : page ouverte en double-cliquant (file://) ou serveur arrete
    if (location.protocol === "file:") {
      throw new Error(
        `Impossible de lire ${chemin} : ouvrez le site avec un serveur local ` +
          `(ex. Live Server dans VS Code), pas en double-cliquant sur index.html.`,
      );
    }
    throw new Error(`Impossible de contacter le serveur pour lire ${chemin}.`);
  }

  if (!reponse.ok) {
    throw new Error(
      `Erreur de chargement de ${chemin} (HTTP ${reponse.status}). ` +
        `Vérifiez que le fichier existe à cet emplacement.`,
    );
  }

  try {
    return await reponse.json();
  } catch (e) {
    throw new Error(
      `${chemin} n'est pas un JSON valide. Relancez l'export depuis le programme C.`,
    );
  }
}

/**
 * Verifie une mesure brute de data.json.
 * Retourne { mesure } si elle est utilisable, sinon { erreur }.
 */
function verifierMesure(brute, index) {
  if (brute === null || typeof brute !== "object") {
    return { erreur: "mesure vide ou mal formée" };
  }

  // Le module C exporte "id_batiment" ; on accepte aussi "batiment"
  const batiment = lireTexte(brute.id_batiment ?? brute.batiment);
  const ressource = lireTexte(brute.ressource).toLowerCase();
  const valeur = lireNombre(brute.valeur);
  const seuil = lireNombre(brute.seuil);
  const date = lireDate(brute.date);

  if (!batiment) return { erreur: "bâtiment manquant" };
  if (!ressource) return { erreur: "ressource manquante" };
  if (!Number.isFinite(valeur) || valeur < 0)
    return { erreur: `valeur incorrecte (${brute.valeur})` };
  if (!Number.isFinite(seuil) || seuil <= 0)
    return { erreur: `seuil incorrect (${brute.seuil})` };
  if (!date) return { erreur: `date incorrecte (${brute.date})` };

  return {
    mesure: {
      id: index,
      batiment,
      ressource,
      valeur,
      seuil,
      unite: lireTexte(brute.unite) || UNITES[ressource] || "",
      date,
      dateTexte: formaterDate(date),
      // Recalculee ici plutot que lue dans le fichier : meme regle que le module C
      alerte: valeur > seuil,
    },
  };
}

// Texte nettoye, ou '' si la valeur n'est pas un texte
function lireTexte(valeur) {
  return typeof valeur === "string" ? valeur.trim() : "";
}

// Nombre, ou NaN si absent/incorrect (Number('') et Number(null) donneraient 0)
function lireNombre(valeur) {
  if (typeof valeur === "number") return valeur;
  if (typeof valeur === "string" && valeur.trim() !== "")
    return Number(valeur.trim().replace(",", "."));
  return NaN;
}

/**
 * Convertit le texte de la date en objet Date, ou null s'il est incorrect.
 * Formats acceptes :
 *   "2026-03-30 08:00"  (format saisi dans le menu du module C)
 *   "1/1/2024 0:00"     (format du CSV : mois/jour/annee)
 */
function lireDate(texte) {
  if (typeof texte !== "string") return null;

  // Le module C lit la date jusqu'a la fin de la ligne du CSV et y colle donc la colonne
  // suivante ("1/1/2024 0:00,Admin") : on ne garde que la partie avant la virgule.
  const brut = texte.split(",")[0].trim();

  let annee, mois, jour, heure, minute;
  let m = brut.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?$/);
  if (m) {
    [, annee, mois, jour, heure = 0, minute = 0] = m;
  } else {
    m = brut.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: (\d{1,2}):(\d{2}))?$/);
    if (!m) return null;
    [, mois, jour, annee, heure = 0, minute = 0] = m;
  }

  const date = new Date(annee, mois - 1, jour, heure, minute);
  // new Date() accepte le 31/02 en passant au mois suivant : on le refuse
  if (date.getMonth() !== mois - 1 || date.getDate() !== Number(jour))
    return null;
  return date;
}

// Date -> "2024-01-01 00:00"
function formaterDate(date) {
  const deux = (n) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${deux(date.getMonth() + 1)}-${deux(date.getDate())} ` +
    `${deux(date.getHours())}:${deux(date.getMinutes())}`
  );
}

/**
 * Affiche le message d'erreur dans la page.
 * Utilise l'element #erreur-chargement s'il existe dans index.html, sinon le cree.
 */
function afficherErreurChargement(message) {
  let zone = document.getElementById("erreur-chargement");
  if (!zone) {
    zone = document.createElement("div");
    zone.id = "erreur-chargement";
    document.body.prepend(zone);
  }
  zone.className = "erreur-chargement";
  zone.setAttribute("role", "alert");
  zone.textContent = message;
}

/* ---------- Aides pour les autres modules (filtres, graphiques) ---------- */

// Valeurs distinctes d'un champ, triees. Ex. : valeursUniques('batiment') -> ["ENIB", "Foyer", ...]
function valeursUniques(champ, mesures = donnees.mesures) {
  return [...new Set(mesures.map((m) => m[champ]))].sort();
}

// Premiere et derniere date des mesures (bornes du filtre par periode)
function periodeDonnees(mesures = donnees.mesures) {
  if (mesures.length === 0) return null;
  const temps = mesures.map((m) => m.date.getTime());
  return {
    debut: new Date(Math.min(...temps)),
    fin: new Date(Math.max(...temps)),
  };
}
