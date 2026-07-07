#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Fruit Sénégal — installation & démarrage automatiques
#
# Utilisation (depuis n'importe où, ex: Termux sur Android) :
#   bash install.sh
#
# Le script :
#   1. installe git et Node.js si nécessaire (Termux / Debian-Ubuntu) ;
#   2. clone le dépôt (ou le met à jour s'il existe déjà) ;
#   3. bascule sur la bonne branche ;
#   4. installe les dépendances ;
#   5. demande le mot de passe administrateur (mémorisé pour les fois suivantes) ;
#   6. lance l'application.
# ---------------------------------------------------------------------------
set -e

REPO_URL="https://github.com/souleymanendour1-ops/fruit.senegal.git"
BRANCH="claude/mobile-shopping-payment-app-gew0f2"
DIR_NAME="fruit.senegal"
PORT="${PORT:-3000}"

green() { printf '\033[0;32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$1"; }
red() { printf '\033[0;31m%s\033[0m\n' "$1"; }

# --- 1. Détection de l'environnement et installation des prérequis ----------
install_pkg() {
  local pkg="$1"
  if command -v pkg >/dev/null 2>&1; then
    pkg install -y "$pkg"
  elif command -v apt-get >/dev/null 2>&1; then
    sudo apt-get update -y && sudo apt-get install -y "$pkg"
  else
    red "Impossible d'installer automatiquement '$pkg'. Installez-le manuellement puis relancez."
    exit 1
  fi
}

if ! command -v git >/dev/null 2>&1; then
  yellow "Installation de git…"; install_pkg git
fi
if ! command -v node >/dev/null 2>&1; then
  yellow "Installation de Node.js…"; install_pkg nodejs
fi

green "git $(git --version | awk '{print $3}') · node $(node --version)"

# --- 2. Récupération du code ------------------------------------------------
# Si on est déjà dans le dépôt (présence de package.json + server/), on reste ;
# sinon on clone à côté.
if [ -f "package.json" ] && [ -d "server" ]; then
  green "Dépôt déjà présent dans le dossier courant."
  REPO_DIR="$(pwd)"
else
  if [ -d "$DIR_NAME/.git" ]; then
    green "Mise à jour du dépôt existant…"
    cd "$DIR_NAME"
  else
    yellow "Clonage du dépôt…"
    git clone "$REPO_URL" "$DIR_NAME"
    cd "$DIR_NAME"
  fi
  REPO_DIR="$(pwd)"
fi

# --- 3. Bonne branche -------------------------------------------------------
yellow "Passage sur la branche $BRANCH…"
git fetch origin "$BRANCH" || true
git checkout "$BRANCH"
git pull origin "$BRANCH" || true

# --- 4. Dépendances ---------------------------------------------------------
yellow "Installation des dépendances (npm install)…"
npm install

# --- 5. Mot de passe administrateur ----------------------------------------
PASS_FILE="$REPO_DIR/.adminpass"
if [ -f "$PASS_FILE" ]; then
  ADMIN_PASSWORD="$(cat "$PASS_FILE")"
  green "Mot de passe administrateur récupéré (.adminpass)."
else
  printf 'Choisissez un mot de passe administrateur : '
  read -r ADMIN_PASSWORD
  if [ -z "$ADMIN_PASSWORD" ]; then ADMIN_PASSWORD="admin123"; yellow "Mot de passe vide → 'admin123' par défaut."; fi
  printf '%s' "$ADMIN_PASSWORD" > "$PASS_FILE"
  chmod 600 "$PASS_FILE" 2>/dev/null || true
fi

# --- 6. Démarrage -----------------------------------------------------------
green ""
green "============================================================"
green "  Fruit Sénégal démarre…"
green "  Boutique : http://localhost:$PORT/"
green "  Admin    : http://localhost:$PORT/admin.html"
green "  (Ctrl + C pour arrêter)"
green "============================================================"
green ""

ADMIN_PASSWORD="$ADMIN_PASSWORD" PORT="$PORT" npm start
