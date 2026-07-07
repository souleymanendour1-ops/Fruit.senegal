#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Fruit Sénégal — créer un LIEN PUBLIC TEMPORAIRE (à partager aux clients)
#
# À lancer DANS le dossier du projet, depuis Termux (Android) :
#   bash partager.sh
#
# Le script :
#   1. démarre le serveur de l'application en arrière-plan ;
#   2. installe « cloudflared » si nécessaire ;
#   3. ouvre un tunnel Cloudflare et affiche un lien https public
#      (ex: https://xxxx.trycloudflare.com) que vous partagez à vos clients.
#
# ⚠️ Le lien fonctionne UNIQUEMENT tant que ce script tourne et que le
#    téléphone reste allumé. Fermez avec Ctrl + C (le serveur s'arrête aussi).
#    Chaque lancement génère une nouvelle adresse.
# ---------------------------------------------------------------------------
set -e

PORT="${PORT:-3000}"
green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

# Vérifie qu'on est bien dans le dossier du projet
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
  red "Lancez ce script DANS le dossier du projet (là où se trouve package.json)."
  red "  cd fruit.senegal && bash partager.sh"
  exit 1
fi

# --- Dépendances de l'app ---------------------------------------------------
if [ ! -d "node_modules" ]; then
  yellow "Installation des dépendances…"; npm install
fi

# --- Mot de passe administrateur (mémorisé) ---------------------------------
PASS_FILE=".adminpass"
if [ -f "$PASS_FILE" ]; then
  ADMIN_PASSWORD="$(cat "$PASS_FILE")"
else
  printf 'Choisissez un mot de passe administrateur : '
  read -r ADMIN_PASSWORD
  [ -z "$ADMIN_PASSWORD" ] && ADMIN_PASSWORD="admin123"
  printf '%s' "$ADMIN_PASSWORD" > "$PASS_FILE"
  chmod 600 "$PASS_FILE" 2>/dev/null || true
fi

# --- Installer cloudflared si besoin ----------------------------------------
if ! command -v cloudflared >/dev/null 2>&1; then
  yellow "Installation de cloudflared…"
  if command -v pkg >/dev/null 2>&1; then
    pkg install -y cloudflared
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y && sudo apt-get install -y cloudflared
  else
    red "Impossible d'installer cloudflared automatiquement."
    red "Sur Termux :  pkg install cloudflared"
    exit 1
  fi
fi

# --- Démarrage du serveur en arrière-plan -----------------------------------
yellow "Démarrage du serveur (port $PORT)…"
ADMIN_PASSWORD="$ADMIN_PASSWORD" PORT="$PORT" npm start > .server.log 2>&1 &
SERVER_PID=$!

# Arrête proprement le serveur quand on ferme le script (Ctrl + C)
cleanup() {
  green ""
  yellow "Arrêt du serveur et du tunnel…"
  kill "$SERVER_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Attendre que le serveur réponde
for i in $(seq 1 20); do
  if curl -s -o /dev/null "http://localhost:$PORT/"; then break; fi
  sleep 0.5
done

green ""
green "============================================================"
green "  Serveur prêt. Création du lien public…"
green "  (Ctrl + C pour tout arrêter)"
green "============================================================"
green ""
yellow "➡️  Cherchez ci-dessous la ligne  https://xxxxx.trycloudflare.com"
yellow "    C'est le lien à partager à vos clients."
yellow "    Pour l'espace admin, ajoutez  /admin.html  à la fin du lien."
green ""

# --- Tunnel Cloudflare (au premier plan) ------------------------------------
cloudflared tunnel --url "http://localhost:$PORT"

cleanup
