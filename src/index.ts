


import BQLRunner from './BQLRunner';
import { BQLConfig } from './base';

// Example usage demonstrating production-grade BQL automation
async function runBQLExamples() {
  const runner = new BQLRunner();

  // Single target example
  const singleConfig: BQLConfig = {
    targetUrl: 'https://www.jumia.com.ng',
    testEmail: `miracleolaniyan@yahoo.com`,
    headless: false, // Set to true for production
    maxRetries: 5,
    timeoutMs: 30000,
    enableDiagnostics: true,
    scrollLockDetection: true,
    adaptiveScrolling: true,
    debugMode: true
  };

  console.log('🚀 Running single BQL automation...');
  const singleResult = await runner.runSingleTarget(singleConfig);
  console.log(`Result: ${singleResult ? 'SUCCESS' : 'FAILED'}`);

  // Multiple targets example
  // const multipleConfigs: BQLConfig[] = [
  //   {
  //     targetUrl: 'https://example1.com',
  //     testEmail: `test1+${Date.now()}@example.com`,
  //     headless: true,
  //     maxRetries: 3,
  //     enableDiagnostics: true
  //   },
  //   {
  //     targetUrl: 'https://example2.com',
  //     testEmail: `test2+${Date.now()}@example.com`,
  //     headless: true,
  //     maxRetries: 3,
  //     enableDiagnostics: true
  //   }
  // ];

  // console.log('\n🚀 Running multiple BQL automations...');
  // const multipleResults = await runner.runMultipleTargets(multipleConfigs);
  
  // console.log('\n📊 Results Summary:');
  // for (const [url, success] of multipleResults) {
  //   console.log(`${url}: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
  // }

  // Display diagnostics
  console.log('\n🧪 Diagnostic Summary:');
  const allDiagnostics = runner.getAllDiagnostics();
  for (const [url, diagnostics] of allDiagnostics) {
    console.log(`\n${url}:`);
    console.log(`- Success Rate: ${diagnostics.successfulStrategy ? '100%' : '0%'}`);
    console.log(`- Strategies Attempted: ${diagnostics.formStrategiesAttempted.length}`);
    console.log(`- Execution Time: ${diagnostics.performanceMetrics.totalExecutionTime}ms`);
    console.log(`- DOM Queries: ${diagnostics.performanceMetrics.domQueries}`);
  }
}
runBQLExamples()

// Export for use in other modules
// export { runBQLExamples };

// Uncomment to run examples
runBQLExamples().catch(console.error);
