# 🍉 Fruit Sénégal

Application mobile (PWA) qui permet de **commander des produits depuis Alibaba, Shein, Temu et Amazon**, de les ajouter au panier, puis de **payer via Wave ou Orange Money**. L'administrateur valide le paiement, prend la commande en charge et communique la **date de livraison**.

> PWA = application web installable sur le téléphone (Android / iPhone) directement depuis le navigateur, sans passer par les stores. Idéal pour démarrer vite.

## ✨ Fonctionnalités

### Côté client
- 🏪 Accès direct aux boutiques **Alibaba, Shein, Temu, Amazon** (ouverture dans le navigateur).
- 🔗 **Commande par lien** : coller le lien d'un produit, indiquer prix / quantité / taille → ajout au panier.
- 🛍️ **Catalogue** de produits sélectionnés par l'administrateur.
- 🛒 Panier complet (modification des quantités, total avec frais de service).
- 💳 Paiement **Wave / Orange Money** avec instructions et numéro à copier, puis saisie de la **référence de transaction**.
- 📦 Suivi des commandes en temps réel (statut + date de livraison).
- 👤 Compte client (inscription / connexion par téléphone).

### Côté administrateur (`/admin.html`)
- 📊 Tableau de bord (commandes, paiements à valider, clients, chiffre d'affaires).
- ✅ **Validation des paiements** et prise en charge des commandes.
- 📅 Attribution de la **date de livraison** et message au client.
- 💰 Ajustement des prix réels (utile pour les commandes par lien) et des frais de service.
- 🛍️ Gestion du catalogue (ajout / modification / suppression de produits).
- ⚙️ Réglages : numéros Wave / Orange Money, devise, frais de service, etc.

## ⚡ Installation rapide (1 commande)

Sur Android (Termux) ou Linux, le script `install.sh` fait tout automatiquement
(installe git/Node si besoin, clone/met à jour le code, installe les dépendances,
demande le mot de passe administrateur, puis démarre l'application) :

```bash
pkg install -y git            # Termux uniquement, une seule fois
git clone https://github.com/souleymanendour1-ops/fruit.senegal.git
cd fruit.senegal && git checkout claude/mobile-shopping-payment-app-gew0f2
bash install.sh
```

Les fois suivantes, il suffit de relancer `bash install.sh` (le mot de passe est mémorisé).

> ℹ️ **Important** : lancez toujours les commandes **dans le dossier `fruit.senegal`**
> (et non dans `~/downloads`). Vérifiez avec `ls package.json` : le fichier doit s'afficher.

## 🌍 Créer un lien public temporaire (partager aux clients)

Pour que vos clients accèdent à la boutique **depuis leur propre téléphone**, il
faut un lien internet (et non `localhost`, qui ne marche que sur votre appareil).
Le script `partager.sh` démarre l'app et ouvre un tunnel **Cloudflare** gratuit
(sans compte) qui donne une adresse `https://xxxx.trycloudflare.com` :

```bash
cd fruit.senegal
bash partager.sh
```

- Le lien affiché (`https://xxxx.trycloudflare.com`) = **la boutique** à partager.
- Ajoutez `/admin.html` à ce lien pour **votre espace administrateur**.
- Vos données restent sur votre téléphone (base conservée).

> ⚠️ Le lien ne fonctionne **que tant que le script tourne** et que le téléphone
> est allumé. Chaque lancement crée une **nouvelle adresse**. Pour un service
> toujours en ligne avec une adresse fixe, passez à un hébergement cloud
> (voir la section « Évolutions possibles »).

## 🚀 Démarrage manuel

```bash
npm install
npm start
```

- Boutique : http://localhost:3000/
- Administration : http://localhost:3000/admin.html

### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `PORT` | Port d'écoute | `3000` |
| `ADMIN_PASSWORD` | Mot de passe de l'espace administrateur | `admin123` |

> ⚠️ **En production, changez impérativement `ADMIN_PASSWORD`** :
> ```bash
> ADMIN_PASSWORD="votre_mot_de_passe" npm start
> ```

## ⚙️ Première configuration (important)

1. Ouvrez `/admin.html`, connectez-vous avec le mot de passe.
2. Onglet **Réglages** → renseignez vos **numéros Wave et Orange Money** (ce sont ceux qui recevront les paiements des clients) et le pourcentage de **frais de service**.
3. (Optionnel) Onglet **Catalogue** → ajoutez des produits sélectionnés.

## 🔄 Parcours d'une commande

1. Le client parcourt une boutique ou colle un lien produit, puis ajoute au panier.
2. À la validation, il choisit Wave ou Orange Money, **paie sur votre numéro** et saisit la **référence de transaction**.
3. La commande arrive dans l'admin au statut **« Paiement à valider »**.
4. Vous vérifiez le paiement reçu, cliquez **« Valider le paiement »**, ajustez les prix si besoin, puis renseignez la **date de livraison**.
5. Le client suit l'avancement (Validé → En préparation → Expédié → Livré) dans l'app.

## 🛠️ Technologie

- **Backend** : Node.js + Express. Stockage **à double mode** : fichier JSON en local
  (zéro configuration) et **PostgreSQL** en ligne dès que `DATABASE_URL` est défini
  (données conservées durablement). Voir [`DEPLOIEMENT.md`](DEPLOIEMENT.md).
- **Frontend** : PWA en JavaScript (sans étape de build), installable sur mobile, fonctionnement hors-ligne basique via service worker.
- Mots de passe hachés (scrypt), sessions par jeton.

## 📁 Structure

```
server/
  index.js        # API Express + service des fichiers statiques
  db.js           # base de données fichier JSON
  auth.js         # hachage mots de passe + sessions
  data/           # données (générées au runtime, non versionnées)
public/
  index.html      # boutique (client)
  admin.html      # espace administrateur
  css/styles.css
  js/app.js       # logique boutique
  js/admin.js     # logique admin
  js/api.js       # helper d'appels API partagé
  manifest.webmanifest, sw.js, icons/   # PWA
```

## 📌 Notes & évolutions possibles

- L'accès aux sites partenaires se fait par **redirection** : ces plateformes n'autorisent pas l'intégration directe de leur catalogue de commande. Le modèle est donc un **service d'achat-intermédiaire** (concierge) + catalogue géré manuellement.
- Le paiement est **validé manuellement** (le client envoie la référence Wave / OM). Une intégration directe des **API marchandes Wave / Orange Money** pourra être ajoutée ultérieurement (nécessite un compte marchand et des clés API).
- Pour une mise en ligne permanente (adresse fixe, base persistante), suivez
  [`DEPLOIEMENT.md`](DEPLOIEMENT.md) (Render + PostgreSQL, offre gratuite).
- Empaquetage en application native (Google Play / App Store) possible plus tard via Capacitor / TWA.

## ⚖️ Avertissement

« Alibaba », « Shein », « Temu » et « Amazon » sont des marques de leurs propriétaires respectifs. Cette application est un service indépendant d'aide à la commande et n'est ni affiliée, ni approuvée par ces sociétés.
