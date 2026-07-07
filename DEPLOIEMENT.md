# 🚀 Mettre Fruit Sénégal en ligne (adresse permanente)

Ce guide met votre application **en ligne 24h/24**, avec une **adresse fixe** et des
**données conservées durablement** (base PostgreSQL). Contrairement au lien
temporaire (`partager.sh`), plus besoin de garder votre téléphone allumé.

L'hébergeur recommandé est **Render** (offre gratuite pour démarrer).

---

## Étape 1 — Créer un compte Render

1. Allez sur **https://render.com** et créez un compte (gratuit).
2. Connectez votre compte **GitHub** quand Render le propose.

## Étape 2 — Déployer avec le Blueprint

Le dépôt contient déjà un fichier `render.yaml` qui configure **tout automatiquement**
(le site + la base de données).

1. Dans Render, cliquez **New +** → **Blueprint**.
2. Sélectionnez le dépôt **`fruit.senegal`**.
3. Render détecte `render.yaml` et affiche les ressources à créer
   (un service web + une base PostgreSQL). Cliquez **Apply**.

> Si Render demande une branche, choisissez `claude/mobile-shopping-payment-app-gew0f2`
> (ou la branche sur laquelle le code est fusionné).

## Étape 3 — Définir le mot de passe administrateur

Pour des raisons de sécurité, le mot de passe n'est pas dans le code.

1. Dans Render, ouvrez le service **fruit-senegal** → onglet **Environment**.
2. Trouvez la variable **`ADMIN_PASSWORD`** et cliquez pour la définir.
3. Saisissez un **mot de passe solide** puis enregistrez.
   Render redéploie automatiquement.

## Étape 4 — C'est en ligne 🎉

Render vous donne une adresse du type :

```
https://fruit-senegal.onrender.com
```

- **Cette adresse = votre boutique** → à partager à vos clients (elle ne change plus).
- **Espace admin** → ajoutez `/admin.html` : `https://fruit-senegal.onrender.com/admin.html`
- Les commandes de vos clients arrivent dans votre admin et **restent enregistrées**,
  même après un redémarrage.

---

## ℹ️ Bon à savoir

- **Mise en veille (offre gratuite)** : après ~15 min sans visite, le service se met
  en veille ; la première visite suivante prend ~30 s à se réveiller. Normal sur
  l'offre gratuite ; passez à une offre payante pour l'éviter.
- **Base de données gratuite Render** : elle est prévue pour démarrer/tester. Si vous
  voulez une base gratuite **sans limite de durée**, créez-en une chez **Neon**
  (https://neon.tech), copiez son lien de connexion, et collez-le dans la variable
  **`DATABASE_URL`** du service Render (à la place de la base Render). L'application
  bascule dessus automatiquement.
- **Mettre à jour l'app** : chaque fois que vous poussez du nouveau code sur la
  branche, Render redéploie tout seul.

## 🔒 Sécurité

- Changez `ADMIN_PASSWORD` régulièrement.
- Ne partagez jamais l'adresse `/admin.html` ni le mot de passe à vos clients.

## Alternatives

Le même dépôt fonctionne aussi sur **Railway**, **Fly.io** ou tout hébergeur Node :
il suffit de définir la variable `DATABASE_URL` (PostgreSQL) et `ADMIN_PASSWORD`.
