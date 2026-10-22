# AL MASSIRA — Correctifs internes (21 octobre 2026)

## Modifications apportées au code
- Dépôt public des copies : vérification d’un élève enregistré ET de son code personnel haché ; rattachement de la copie à l’identifiant élève. L’administrateur peut fixer le code via l’interface.
- Accès Parent : création de code restreinte à l’administration.
- Accès aux documents stockés : authentification obligatoire et vérification du cours possédé par le professeur ; l’interface élève ne promet plus un téléchargement actuellement inaccessible. Un mécanisme d’accès élève aux documents reste à concevoir.
- Autorisations enseignants : limitation des modifications de cours et évaluations à leurs créateurs, et filtrage des copies liées à leurs évaluations. Les enseignants ne peuvent plus administrer les élèves, les rapports ou les comptes.
- PDF : vérification que le professeur est propriétaire de l’évaluation ; préparation du rendu Unicode via @pdf-lib/fontkit. La police Unicode est à fournir légalement dans assets/NotoNaskhArabic-Regular.ttf avant fonctionnement des PDF multilingues. Aucun fichier de police n’est livré dans le ZIP.
- Suppression de l’ancienne route alternative /api/submit.

## Tests réalisés
- Contrôles statiques des routes, des protections et des composants modifiés.
- Installation npm tentée : expiration du délai. Impossible d’effectuer le build ou les tests API intégrés.
- Aucune instance Supabase configurée : aucun test transactionnel réel.

## Restant à réaliser avant production
- Fournir une police Unicode légalement distribuable ; vérifier rendu arabe et retours à la ligne PDF.
- Définir un accès authentifié des élèves aux documents et isoler les cours par classe.
- Ajouter un verrouillage/rate limiting des codes élève/parent.
- Remplacer la table Prisma Record à données JSON par des tables relationnelles explicites, indexées et contraintes ; éviter les doublons lors de dépôts simultanés.
- Concevoir des tests automatisés d’autorisation et d’intégration (Supabase + Next.js), vérifier build et déploiement Vercel.
- Migrer les données existantes en préservant les identifiants et en attribuant les propriétaires aux anciens contenus.

**Ce paquet est une itération de sécurité, pas une version certifiée pour production.**
