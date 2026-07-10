#!/bin/bash
cd ~/BosterBC/VOLZ/volz-scraper
set -e

LOG_PREFIX="[$(date '+%Y-%m-%d %H:%M:%S')]"
echo "$LOG_PREFIX 🚀 Démarrage du cron scraping"

echo "$LOG_PREFIX 📍 Scraping volz.app..."
node scripts/scrape-all.js

echo "$LOG_PREFIX 📍 Scraping h24voyages.com..."
node scripts/h24voyages/run-all.js

echo "$LOG_PREFIX 🔄 Transformation des données volz..."
node scripts/transform-volz.js

echo "$LOG_PREFIX ⚖️  Comparaison des prix..."
node scripts/compare.js

echo "$LOG_PREFIX 📤 Push vers GitHub..."
git add output/
if git diff --cached --quiet; then
  echo "$LOG_PREFIX ℹ️  Rien à commit"
else
  git commit -m "scraping auto $(date '+%Y-%m-%d %H:%M')"
  git push
  echo "$LOG_PREFIX ✅ Push réussi"

  echo "$LOG_PREFIX 🔄 Purge du cache jsDelivr..."
  for f in comparison.json rapport.json historique.json tous-les-vols.json volz/flights.json h24voyages/flights.json; do
    curl -s -o /dev/null "https://purge.jsdelivr.net/gh/MohtadiRomene/volz-scraper@main/output/$f"
  done
  echo "$LOG_PREFIX ✅ Cache purgé"
fi

echo "$LOG_PREFIX 🏁 Terminé"
