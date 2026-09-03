# Contribuer

Les corrections et améliorations sont bienvenues à condition de préserver le
fonctionnement entièrement local.

## Avant une proposition de modification

```bash
npm ci
npm run audit:privacy
npm run typecheck
npm run build
```

Une contribution ne doit pas ajouter :

- d'API d'envoi, de télémétrie ou de suivi ;
- de ressource chargée depuis un CDN ou un domaine tiers ;
- de cookie ou de stockage persistant ;
- de fonction nécessitant la réception du document par un serveur ;
- de réglage permettant de rendre le filigrane volontairement trop faible.

Expliquez clairement tout changement qui touche au traitement des fichiers,
aux en-têtes de sécurité ou à la politique CSP.
