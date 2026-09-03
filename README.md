# Viligue Filigrane

Application web de filigranage accessible sur
[viligue.fr/filigrane](https://viligue.fr/filigrane/).

Un PDF ou une image est traité directement par le navigateur de la personne qui
visite la page. Le document, son nom et le texte du filigrane ne sont pas
envoyés à Viligue ni à un service tiers.

## Garanties de confidentialité

- traitement intégralement effectué dans le navigateur ;
- aucun endpoint d'envoi ou d'import de document ;
- aucune requête `fetch`, XHR, WebSocket ou `sendBeacon` dans l'application ;
- aucune télémétrie et aucun service tiers ;
- aucun cookie, compte utilisateur ou base de données ;
- aucun `localStorage`, `sessionStorage`, IndexedDB, Cache API ou service worker ;
- réponses HTTP servies avec `Cache-Control: no-store` ;
- politique CSP avec `connect-src 'none'` et `form-action 'none'` ;
- document et résultat seulement conservés en mémoire vive pendant l'utilisation ;
- rechargement de la page = document oublié.

Le serveur reçoit nécessairement les requêtes ordinaires permettant de
télécharger la page et ses fichiers statiques. Ces requêtes ne contiennent
jamais le document choisi, son nom ou le texte saisi.

## Vérifier vous-même qu'aucun document n'est envoyé

Utilisez de préférence un document factice pour ce contrôle.

1. Ouvrez la page, puis les outils de développement du navigateur avec
   <kbd>F12</kbd>.
2. Dans l'onglet **Réseau / Network**, attendez la fin du chargement puis effacez
   la liste des requêtes.
3. Choisissez une image ou un PDF factice et écrivez un texte de test
   reconnaissable.
4. Activez le mode **Hors connexion / Offline** dans l'onglet Réseau.
5. Lancez le filigranage et téléchargez le résultat.

Le traitement doit aboutir sans nouvelle requête réseau. Le moteur PDF
nécessaire au traitement est intégré au JavaScript déjà chargé par la page.

Pour contrôler également les en-têtes publics :

```bash
curl -sI https://viligue.fr/filigrane/
```

La réponse doit notamment contenir :

```text
Cache-Control: no-store, no-cache, must-revalidate, max-age=0
Content-Security-Policy: ... connect-src 'none' ... form-action 'none' ...
```

Enfin, l'audit fourni dans ce dépôt recherche les API de transfert et de
stockage interdites dans le code client :

```bash
npm ci
npm run audit:privacy
```

## Fonctionnement du filigrane

Formats acceptés : PDF, JPEG, PNG et WebP, jusqu'à 80 Mo.

Le motif est volontairement fixe : texte répété, diagonal, courbe et
multicolore. Aucun réglage d'opacité, d'angle ou de position n'est proposé.

Pour un PDF, chaque page est rendue dans un canevas, le filigrane est dessiné
dans les pixels, puis les pages sont assemblées dans un nouveau PDF. Pour une
image, le principe est identique : décodage, fusion du filigrane et réencodage.

Le résultat ne contient donc pas de texte ou de calque de filigrane qu'il
suffirait de sélectionner et supprimer dans un éditeur PDF. Comme pour toute
image, une retouche volontaire des pixels reste théoriquement possible.

## Code de production

Les sources applicatives présentes dans ce dépôt sont celles utilisées pour
construire la version publiée sur `viligue.fr/filigrane`. Les secrets et les
fichiers propres à l'infrastructure d'hébergement sont volontairement exclus :
ils ne sont pas nécessaires pour examiner le traitement local ou reproduire
l'application.

## Développement

Prérequis : Node.js 22.13 ou une version plus récente.

```bash
npm ci
npm run audit:privacy
npm run typecheck
npm run build
npm run dev
```

## Technologies

- React et Vinext ;
- PDF.js pour rendre les PDF ;
- pdf-lib pour reconstruire les PDF aplatis ;
- Canvas pour incruster le motif dans les pixels.

Toutes les bibliothèques nécessaires sont livrées par le site lui-même. Aucun
CDN n'est utilisé.

## Origine du projet

Le projet a été conçu par Viligue et codé avec l'assistance de ChatGPT
(OpenAI). Le code généré a été relu, adapté et validé pour les besoins du
service.

## Licence

Le code source est publié sous licence MIT. Les éléments de marque Viligue ne
sont pas compris dans cette licence ; consultez [BRAND-ASSETS.md](BRAND-ASSETS.md).
