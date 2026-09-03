# Confidentialité

## Données manipulées

L'application peut manipuler trois éléments choisis par l'utilisateur :

- les octets du PDF ou de l'image ;
- le nom local du fichier ;
- le texte destiné au filigrane.

Ces éléments restent dans la mémoire du navigateur. Ils ne sont placés dans
aucune requête HTTP et ne sont transmis ni à Viligue, ni à OpenAI, ni à un
service tiers.

## Durée de conservation

Il n'existe aucune conservation applicative :

- aucun cookie ;
- aucune base de données ;
- aucun stockage persistant dans le navigateur ;
- aucun cache applicatif ou service worker ;
- aucun compte ou historique ;
- aucune télémétrie.

Les aperçus utilisent des URL temporaires `blob:`. Elles sont révoquées
lorsqu'un nouveau document est choisi ou lorsque la page est quittée. Un
rechargement réinitialise l'application.

## Communications réseau

Le navigateur télécharge d'abord la page, le JavaScript, le CSS et les images
de l'interface. Après ce chargement, le filigranage lui-même ne nécessite
aucune communication réseau.

La politique de sécurité du contenu bloque les connexions initiées par le code
client avec `connect-src 'none'`. Les formulaires réseau sont également
bloqués avec `form-action 'none'`.

Comme pour tout site web, la couche d'hébergement reçoit les métadonnées
techniques ordinaires de la connexion nécessaires pour servir la page, telles
que l'adresse IP et l'agent utilisateur. Elle ne reçoit pas le contenu du
document sélectionné, son nom ou le texte du filigrane.

## Résultat généré

Le PDF de sortie est un nouveau document constitué d'images de pages. Les
métadonnées descriptives provenant du PDF source ne sont pas recopiées. Les
images de sortie sont réencodées après l'ajout du filigrane.

## Contrôle indépendant

La procédure reproductible de contrôle avec l'onglet Réseau et le mode hors
connexion est décrite dans le [README](README.md#vérifier-vous-même-quaucun-document-nest-envoyé).
Le script `npm run audit:privacy` fournit un second contrôle statique.
