const cron = require('node-cron');
const pool = require('../config/database');
const PricingEngine = require('../utils/pricingEngine');

/**
 * TÂCHE PLANIFIÉE : Mise à jour des prix quotidienne
 * S'exécute automatiquement tous les jours à minuit
 */
function startPriceUpdateJob() {
  const useIA = process.env.USE_AI_PRICING === 'true';
  
  // Planifier la tâche : tous les jours à 00:00 (minuit)
  cron.schedule('0 0 * * *', async () => {
    console.log('\n' + '='.repeat(60));
    console.log(`🕐 [CRON JOB] Démarrage à ${new Date().toLocaleString('fr-FR')}`);
    console.log(`   Mode : ${useIA ? '🤖 IA Activée' : '📏 Règles fixes'}`);
    console.log('='.repeat(60));
    
    try {
      const startTime = Date.now();
      
      // Mettre à jour tous les prix
      const result = await PricingEngine.updateAllProductsPrices(pool, useIA);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log('\n✅ [CRON JOB] Mise à jour terminée avec succès');
      console.log(`   📦 Produits mis à jour : ${result.updated}`);
      console.log(`   🤖 Calculés par IA : ${result.usedIA}`);
      console.log(`   📏 Calculés par règles : ${result.usedRules}`);
      console.log(`   ⏱️  Durée : ${duration}s`);
      console.log('='.repeat(60) + '\n');
      
    } catch (error) {
      console.error('\n❌ [CRON JOB] Erreur lors de la mise à jour :');
      console.error(error);
      console.log('='.repeat(60) + '\n');
    }
  });
  
  console.log('\n⏰ Tâche planifiée activée :');
  console.log(`   📅 Fréquence : Tous les jours à 00:00 (minuit)`);
  console.log(`   🤖 Mode IA : ${useIA ? 'ACTIVÉ ✅' : 'DÉSACTIVÉ ⚠️'}`);
  
  // Option : exécuter immédiatement au démarrage (pour test)
  if (process.env.RUN_CRON_ON_STARTUP === 'true') {
    console.log('   🚀 Exécution immédiate au démarrage...\n');
    setTimeout(async () => {
      try {
        const result = await PricingEngine.updateAllProductsPrices(pool, useIA);
        console.log(`✅ Mise à jour initiale : ${result.updated} produits`);
      } catch (error) {
        console.error('❌ Erreur mise à jour initiale:', error.message);
      }
    }, 5000); // Attendre 5 secondes après le démarrage
  }
}

module.exports = { startPriceUpdateJob };