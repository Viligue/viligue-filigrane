# Sécurité

## Invariants du projet

Toute contribution doit conserver les propriétés suivantes :

- aucune transmission du document, de son nom ou du texte saisi ;
- aucune dépendance à un serveur pour effectuer le traitement ;
- aucune télémétrie ou ressource tierce ;
- aucun stockage persistant côté navigateur ;
- aucun cookie ou compte utilisateur ;
- filigrane fusionné aux pixels du résultat ;
- CSP contenant `connect-src 'none'` et `form-action 'none'` ;
- réponses marquées `Cache-Control: no-store`.

La commande suivante vérifie automatiquement plusieurs de ces invariants :

```bash
npm run audit:privacy
```

Elle complète la revue humaine mais ne la remplace pas.

## Limites connues

- Une retouche d'image avancée peut toujours altérer des pixels.
- L'aplatissement d'un PDF supprime notamment la sélection de texte, les liens
  et certains éléments d'accessibilité du document original.
- Les PDF reconstruits peuvent être plus volumineux que leur source.
- Les limites de mémoire dépendent du navigateur et de l'appareil.

## Signaler une vulnérabilité

N'incluez pas de document personnel ou de pièce d'identité dans un rapport.
Utilisez un document factice et décrivez les étapes permettant de reproduire le
problème.

Pour un problème susceptible d'exposer des données, utilisez de préférence la
fonction **Private vulnerability reporting** ou un **Security Advisory** du
dépôt GitHub plutôt qu'une issue publique.
