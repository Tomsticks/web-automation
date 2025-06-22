
import { NewsletterAutomation } from './newsletter-automation';
import { createConfig } from './config';
import { AutomationResult } from './types';

export class AutomationRunner {
  private automation: NewsletterAutomation;

  constructor() {
    this.automation = new NewsletterAutomation();
  }

  async runSingleSite(url: string, email: string): Promise<AutomationResult> {
    const config = createConfig({ url, email });
    
    try {
      await this.automation.initialize();
      const result = await this.automation.executeAutomation(config);
      
      // Log detailed results
      this.logResults(result);
      
      return result;
    } finally {
      await this.automation.cleanup();
    }
  }

  async runBatch(sites: Array<{url: string, email: string}>): Promise<AutomationResult[]> {
    const results: AutomationResult[] = [];
    
    for (const site of sites) {
      try {
        console.log(`\n🚀 Processing: ${site.url}`);
        const result = await this.runSingleSite(site.url, site.email);
        results.push(result);
        
        // Brief pause between sites
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error(`❌ Failed to process ${site.url}:`, error);
        results.push({
          success: false,
          timestamp: new Date().toISOString(),
          url: site.url,
          executionTime: 0,
          strategiesUsed: [],
          errors: [`Runner error: ${error}`],
          diagnostics: {
            pageTitle: '',
            popupDetected: false,
            iframeCount: 0,
            shadowDOMDetected: false,
            scrollLocked: false,
            modalActive: false
          }
        });
      }
    }

    this.logBatchSummary(results);
    return results;
  }

  private logResults(result: AutomationResult): void {
    console.log('\n📊 AUTOMATION RESULTS');
    console.log('═'.repeat(50));
    console.log(`🎯 URL: ${result.url}`);
    console.log(`✅ Success: ${result.success ? '✅ YES' : '❌ NO'}`);
    console.log(`⏱️  Execution Time: ${result.executionTime}ms`);
    console.log(`🔧 Strategies Used: ${result.strategiesUsed.length}`);
    
    if (result.strategiesUsed.length > 0) {
      result.strategiesUsed.forEach(strategy => {
        console.log(`   • ${strategy}`);
      });
    }

    console.log('\n🔍 DIAGNOSTICS:');
    console.log(`   📄 Page Title: ${result.diagnostics.pageTitle}`);
    console.log(`   🪟 Popup Detected: ${result.diagnostics.popupDetected ? '✅' : '❌'}`);
    console.log(`   🖼️  Iframe Count: ${result.diagnostics.iframeCount}`);
    console.log(`   🌑 Shadow DOM: ${result.diagnostics.shadowDOMDetected ? '✅' : '❌'}`);
    console.log(`   🔒 Scroll Locked: ${result.diagnostics.scrollLocked ? '✅' : '❌'}`);
    console.log(`   🔔 Modal Active: ${result.diagnostics.modalActive ? '✅' : '❌'}`);

    if (result.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      result.errors.forEach(error => {
        console.log(`   • ${error}`);
      });
    }
    console.log('═'.repeat(50));
  }

  private logBatchSummary(results: AutomationResult[]): void {
    const successful = results.filter(r => r.success).length;
    const total = results.length;
    const successRate = ((successful / total) * 100).toFixed(1);

    console.log('\n📈 BATCH SUMMARY');
    console.log('═'.repeat(50));
    console.log(`📊 Success Rate: ${successRate}% (${successful}/${total})`);
    console.log(`⏱️  Average Execution Time: ${Math.round(results.reduce((sum, r) => sum + r.executionTime, 0) / total)}ms`);
    console.log('═'.repeat(50));
  }
}
