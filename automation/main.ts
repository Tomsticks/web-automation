
import { AutomationRunner } from './runner';

const mail = process.argv[2]
// Example usage demonstrating the automation capabilities
async function runExamples() {
  console.log(mail);
  
  const runner = new AutomationRunner();

  // Single site example
  console.log('🔥 Running single site automation...');
  await runner.runSingleSite(
    // edit website Url
    'https://www.jumia.com.ng',
    mail
  );

  // Batch processing example
  console.log('\n🔥 Running batch automation...');
  // const sites = [
  //   { url: 'https://site1.com', email: 'user1@example.com' },
  //   { url: 'https://site2.com', email: 'user2@example.com' },
  //   { url: 'https://site3.com', email: 'user3@example.com' }
  // ];

  // await runner.runBatch(sites);
}

// Production-ready function for immediate use
export async function automateNewsletterSignup(url: string, email: string) {
  const runner = new AutomationRunner();
  return await runner.runSingleSite(url, email);
}

// If running this file directly
if (require.main === module) {
  runExamples().catch(console.error);
}
