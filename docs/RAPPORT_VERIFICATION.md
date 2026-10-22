# AL MASSIRA — Vérification avant connexion Supabase

Date : 21 octobre 2026.

## Contrôles effectués
- Présence des fichiers Next.js App Router et de l'interface React/TypeScript.
- Présence de la configuration Tailwind, TypeScript et PostCSS.
- Présence des routes API métiers et Auth.js, du client Prisma et du schéma PostgreSQL.
- Présence du modèle de configuration `.env.example` sans identifiants réels.
- Contrôle des importations relatives des fichiers TypeScript et JavaScript.
- Contrôle de l'intégrité de l'archive ZIP.
- Vérification de l'absence du backend Python et du moteur d'interface ancien.

## Contrôles non réalisables ici
- `npm install --offline` échoue : plusieurs dépendances ne sont pas en cache (`@pdf-lib/fontkit` notamment).
- Par conséquent, ni compilation Next.js, ni vérification TypeScript complète, ni parcours utilisateur en navigateur.
- Aucun accès à un projet Supabase configuré : aucune vérification d'accès à PostgreSQL, Storage ou des flux d'authentification.

## Points à résoudre avant la production
- PDF : le code attend `assets/NotoNaskhArabic-Regular.ttf`, absent de cette archive. Le rendu des textes arabes et RTL n'est pas validé.
- Le modèle Prisma repose sur une table générique `almassira_records` contenant du JSON PostgreSQL : une normalisation relationnelle est recommandée.
- Faire auditer les règles d'autorisation, la protection des codes élèves/parents et la validation des entrées API.
- Tester toutes les opérations de création, consultation, modification et suppression contre une instance Supabase de développement.

**Statut : dépôt préparé et contrôlé statiquement, pas certifié fonctionnel ni prêt à recevoir des données personnelles réelles.**
