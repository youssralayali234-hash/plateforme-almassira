# AL MASSIRA

Application de gestion scolaire — reconstruction Next.js.

## Architecture

| Couche | Technologie |
| --- | --- |
| Interface | Next.js 15, React 19, Tailwind CSS 3 |
| API | Next.js App Router Route Handlers |
| Données | PostgreSQL (Supabase) via Prisma ORM |
| Authentification | NextAuth.js 4 (Auth.js), Credentials |
| Fichiers | Supabase Storage, bucket privé `almassira-documents` |
| PDF | `pdf-lib` et `@pdf-lib/fontkit` |

**Aucun serveur Python/FastAPI, aucune ancienne interface `legacy.js`, aucun fichier JSON comme base de données.** Le schéma Prisma actuellement livré reste toutefois un stockage générique JSON *dans PostgreSQL* et doit être normalisé avant une mise en production.

## Structure du dépôt

```text
app/                         Pages, styles et routes API Next.js
  api/[...path]/route.ts      API métier
  api/auth/[...nextauth]/     Authentification
  uploads/[filename]/        Téléchargement contrôlé
components/Portal.tsx        Interface React
lib/                          Couche de données et sécurité
prisma/                       Schéma et initialisation
scripts/                      Contrôles locaux
 docs/                        État des corrections et limites
```

## Installation locale

1. Copier `.env.example` vers `.env.local`, renseigner de **vraies** clés Supabase et un `NEXTAUTH_SECRET` robuste.
2. Créer une base PostgreSQL Supabase et un bucket Storage **privé** `almassira-documents`.
3. Exécuter `npm install`, puis `npx prisma generate`, `npx prisma db push` et, si souhaité, `npm run db:seed`.
4. Lancer `npm run check:structure`, `npm run typecheck`, puis `npm run dev`.
5. Ouvrir `http://localhost:3000`.

## Vercel

Importer la racine de ce dépôt dans Vercel en sélectionnant Next.js. Configurer toutes les variables de `.env.example` pour les environnements adaptés, notamment `NEXTAUTH_URL`. Utiliser `npm run build` et vérifier les fonctionnalités avec une instance Supabase de test avant toute utilisation réelle.

## Limites connues — lire avant utilisation

- **Projet non certifié prêt pour la production.** La compilation complète et les tests Supabase ne sont pas validés ici.
- **Export PDF arabe non opérationnel sans police Unicode intégrée** et le rendu bidirectionnel RTL reste à tester. Aucun fichier de police n'est fourni dans cette archive.
- Le portail utilise encore une grande interface React centralisée dans `components/Portal.tsx` ; une découpe par fonctionnalités serait préférable lors d'une refonte plus longue.
- Vérifier l'anti-bruteforce des codes et la politique d'autorisation élève/parent avant de stocker des données personnelles.
- Ne pas considérer le seul résultat de `check:structure` comme un test fonctionnel.

Voir `docs/ETAT_DES_CORRECTIONS.md` pour l'historique technique.


## Ajustement esthétique (21 octobre 2026)
- Livre du logo rempli en vert, avec traits vert foncé.
- Accueil épuré sans descriptions des espaces.
- Quatre sélecteurs à coins asymétriques.
- Couleurs immédiates à la sélection : élève orange, professeur vert, parent rouge, administration violet.


## Ajustements visuels du 21 octobre 2026
- Livre intégralement vert et nom AL MASSIRA visibles ensemble dans la barre de navigation.
- Pied de page : @almassira2026.
- Dès le clic, barre de navigation et carte sélectionnée se colorent sur la page d’accueil AVANT l’ouverture de l’espace (850 ms).
- Espaces aux coins asymétriques, sans descriptions ou pictogrammes additionnels.


## Interface 2026
- Livre intégralement vert de 64 px et nom AL MASSIRA agrandi dans l’en-tête.
- Accueil à fond bleu ciel dégradé, panneau blanc et quatre accès asymétriques.
- Bleu pastel Élève, vert pastel Professeur, rose pastel Parent, violet pastel Administration.
- Couleur affichée dès le clic, puis accès automatique à l’espace après une brève transition.
- Signature `@almassira2026` une seule fois, au pied de page.
- Les espaces intérieurs et leurs fonctions sont conservés.

La compilation et les fonctions nécessitant Supabase doivent être testées localement.
