import BQLNewsletterAutomation, { BQLConfig } from './base';

class BQLRunner {
  private automations: Map<string, BQLNewsletterAutomation> = new Map();

  public async runSingleTarget(config: BQLConfig): Promise<boolean> {
    const automation = new BQLNewsletterAutomation(config);
    const success = await automation.run();
    
    // Store for later diagnostic access
    this.automations.set(config.targetUrl, automation);
    
    return success;
  }

  public async runMultipleTargets(configs: BQLConfig[]): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const config of configs) {
      console.log(`\n🚀 Starting BQL automation for: ${config.targetUrl}`);
      const success = await this.runSingleTarget(config);
      results.set(config.targetUrl, success);
      
      // Brief pause between targets
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    return results;
  }

  public getAutomationDiagnostics(url: string) {
    const automation = this.automations.get(url);
    return automation ? automation.getDiagnostics() : null;
  }

  public getAllDiagnostics() {
    const diagnostics = new Map();
    for (const [url, automation] of this.automations) {
      diagnostics.set(url, automation.getDiagnostics());
    }
    return diagnostics;
  }
}

export default BQLRunner;
