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

## Phase 4 — Pipeline de découpage vidéo (Render Worker)

### Prérequis supplémentaires
- Un compte [OpenAI](https://platform.openai.com) pour l'API Whisper (transcription)
- Un compte [Render](https://render.com) (free tier suffit pour usage perso)

### Étape A — Supabase Storage
1. Dans Supabase, va dans **Storage** et crée deux buckets :
   - `videos` — **privé** (toggle "Public" désactivé)
   - `clips` — **privé**
2. Exécute `supabase/phase4.sql` dans l'éditeur SQL pour créer la table `clip_jobs` et les policies.

### Étape B — Déployer le worker sur Render

**Option 1 — via render.yaml (recommandé)**
1. Pousse ton projet sur GitHub (le dépôt peut être privé).
2. Sur render.com, clique **New > Blueprint** et connecte ton repo.
3. Render détecte le `render.yaml` et crée le service `rushes-worker` automatiquement.
4. Dans les **Environment Variables** du service Render, ajoute :
   - `SUPABASE_URL` = ta valeur `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `WORKER_SECRET` = une chaîne aléatoire de ton choix

**Option 2 — manuellement**
1. Sur render.com, **New > Web Service** > connecte ton repo > Root Directory : `worker`
2. Build Command : `npm install`
3. Start Command : `npm start`
4. Free tier, puis ajoute les mêmes env vars.

### Étape C — Configurer Vercel
Dans tes **Environment Variables Vercel**, ajoute :
- `RENDER_WORKER_URL` = l'URL de ton service Render (ex: `https://rushes-worker.onrender.com`)
- `WORKER_SECRET` = la même chaîne que dans Render

### Note sur le free tier Render
L'instance s'endort après 15 min d'inactivité. Le premier appel après une période de veille prend ~30 secondes (le dashboard affiche "démarrage du worker…"). Pour usage perso, c'est largement acceptable.

### Coûts variables Phase 4
- Whisper API : ~$0.006/min audio → une vidéo d'1h ≈ $0.36
- Claude (sélection + légendes) : ~$0.01 par traitement de vidéo
- Supabase Storage : 1 GB gratuit inclus dans le free tier
