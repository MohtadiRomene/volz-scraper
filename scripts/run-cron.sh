#!/bin/bash
cd ~/BosterBC/VOLZ/volz-scraper
set -e

echo "🚀 [$(date)] Démarrage du cron scraping"

echo "📍 Scraping volz.app..."
node scripts/scrape-all.js

echo "📍 Scraping h24voyages.com..."
node scripts/h24voyages/run-all.js

echo "🔄 Transformation des données volz..."
node scripts/transform-volz.js

echo "⚖️  Comparaison des prix..."
node scripts/compare.js

echo "📤 Push vers GitHub..."
git add output/
git commit -m "scraping $(date +%Y-%m-%d_%H:%M) - auto update" || echo "Rien à commit"
git push

echo "✅ [$(date)] Terminé"
