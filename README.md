# RUSHES — Guide de déploiement

Application personnelle de suivi de contenu vidéo (TikTok, Instagram, YouTube Shorts, Facebook).  
Stack : Next.js 14 · Supabase · Vercel (déploiement gratuit)

---

## Prérequis

- Un compte [Supabase](https://supabase.com) (gratuit)
- Un compte [Vercel](https://vercel.com) (gratuit)
- Node.js 18+ installé localement
- Un compte [Anthropic](https://console.anthropic.com) pour la clé API (analyse IA)

---

## Étape 1 — Créer le projet Supabase

1. Connecte-toi sur [supabase.com](https://supabase.com) et crée un nouveau projet.
2. Dans le menu de gauche, va dans **SQL Editor**.
3. Copie-colle le contenu de `supabase/schema.sql` et clique **Run**.  
   Cela crée les tables `videos` et `ai_analyses` avec les règles de sécurité.
4. Dans **Settings > API**, note :
   - `Project URL` → c'est ton `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → c'est ton `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → c'est ton `SUPABASE_SERVICE_ROLE_KEY` (garde-le secret)

---

## Étape 2 — Configurer l'authentification Supabase

1. Dans Supabase, va dans **Authentication > Providers**.
2. Vérifie que **Email** est activé (il l'est par défaut).
3. Dans **Authentication > URL Configuration**, ajoute :
   - Site URL : `https://ton-projet.vercel.app` (tu la connaîtras après le déploiement Vercel)
   - Redirect URLs : `https://ton-projet.vercel.app/auth/callback`
4. Pour tester en local, ajoute aussi : `http://localhost:3000/auth/callback`

---

## Étape 3 — Configurer les variables d'environnement

Copie `.env.example` en `.env.local` et remplis les valeurs :

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=https://XXXXXXXXXXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
ANTHROPIC_API_KEY=sk-ant-...
```

---

## Étape 4 — Lancer en local

```bash
npm install
npm run dev
```

Ouvre [http://localhost:3000](http://localhost:3000).  
Entrez ton email → reçois le lien magique → connecte-toi.

---

## Étape 5 — Déployer sur Vercel

```bash
npm install -g vercel
vercel
```

Suis les instructions, puis ajoute les variables d'environnement dans le tableau de bord Vercel :  
**Project Settings > Environment Variables**

Ajoute les mêmes 5 variables, mais avec `NEXT_PUBLIC_SITE_URL` égal à ton URL Vercel finale (ex: `https://rushes-xyz.vercel.app`).

Ensuite retourne dans Supabase **Authentication > URL Configuration** et mets à jour avec ton URL Vercel définitive.

---

## Structure du projet

```
rushes/
├── app/
│   ├── api/
│   │   ├── videos/          # GET liste, POST création
│   │   │   └── [id]/        # PATCH mise à jour, DELETE suppression
│   │   └── analyse/         # POST génération IA, GET cache
│   ├── auth/callback/       # Callback magic link
│   ├── login/               # Page de connexion
│   └── page.tsx             # Dashboard principal
├── components/
│   └── Dashboard.tsx        # Composant principal (toutes les vues)
├── lib/
│   └── supabase.ts          # Clients Supabase (browser + server)
├── supabase/
│   └── schema.sql           # Schéma à exécuter une fois dans Supabase
├── middleware.ts             # Protection des routes (auth)
└── .env.example             # Template des variables d'environnement
```

---

## Données et vie privée

- Toutes les données sont dans **ton propre projet Supabase** (pas de serveur partagé).
- Les Row Level Security policies garantissent que seul ton compte peut lire/écrire tes vidéos.
- La clé API Anthropic est utilisée **côté serveur uniquement** (jamais exposée au navigateur).

---

## Phase 5 — Sync automatique des stats (GitHub Actions)

La route `app/api/cron/sync-stats` resynchronise les stats Zernio de toutes les
vidéos publiées sans action manuelle. Elle est déclenchée par un workflow
GitHub Actions (`.github/workflows/sync-stats.yml`), toutes les 6h.

### Étape A — Variable d'environnement sur Vercel
Ajoute `CRON_SECRET` dans **Project Settings > Environment Variables** : une
chaîne aléatoire de ton choix, par exemple générée avec :
```bash
openssl rand -hex 32
```

### Étape B — Secrets GitHub
Dans ton repo GitHub, va dans **Settings > Secrets and variables > Actions**
et ajoute :
- `RUSHES_APP_URL` = l'URL de ton app déployée (ex: `https://rushes-xyz.vercel.app`)
- `CRON_SECRET` = la même valeur que sur Vercel

Le workflow s'exécute automatiquement toutes les 6h, et tu peux aussi le
lancer manuellement depuis l'onglet **Actions** du repo (bouton "Run workflow").
