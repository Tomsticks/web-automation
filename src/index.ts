import { log } from 'console';
import { chromium, Page, Frame, Browser, BrowserContext } from 'playwright';

interface AutomationConfig {
  targetUrl: string;
  testEmail?: string;
  headless?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  enableDiagnostics?: boolean;
}

interface DiagnosticData {
  timestamp: string;
  url: string;
  frameCount: number;
  shadowDomElements: number;
  popupDetected: boolean;
  scrollLocked: boolean;
  successStrategy: string | null;
  failureReasons: string[];
  performanceMetrics: {
    pageLoadTime: number;
    totalExecutionTime: number;
  };
}

class NewsletterAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private diagnostics: DiagnosticData;
  private config: Required<AutomationConfig>;
  private startTime: number = 0;

  constructor(config: AutomationConfig) {
    this.config = {
      targetUrl: config.targetUrl,
      testEmail: config.testEmail || `test+${Date.now()}@example.com`,
      headless: config.headless ?? true,
      maxRetries: config.maxRetries ?? 3,
      timeoutMs: config.timeoutMs ?? 5000,
      enableDiagnostics: config.enableDiagnostics ?? true
    };

    this.diagnostics = {
      timestamp: new Date().toISOString(),
      url: this.config.targetUrl,
      frameCount: 0,
      shadowDomElements: 0,
      popupDetected: false,
      scrollLocked: false,
      successStrategy: null,
      failureReasons: [],
      performanceMetrics: {
        pageLoadTime: 0,
        totalExecutionTime: 0
      }
    };
  }

  // Enhanced selector utility with intelligent fallback mechanisms
  private async trySelector(
    pageOrFrame: Page | Frame, 
    selector: string, 
    timeout: number = this.config.timeoutMs
  ): Promise<any> {
    const strategies = [
      selector,
      selector.replace(/"/g, "'"), // Quote variation
      selector.toLowerCase(), // Case insensitive
      selector.replace(/\s+/g, ' ').trim() // Normalize whitespace
    ];

    for (const strategy of strategies) {
      try {
        const element = await pageOrFrame.waitForSelector(strategy, { timeout });
        if (element) {
          console.log(`✅ Selector success: ${strategy}`);
          return element;
        }
      } catch (error) {
        console.warn(`⚠️ Selector failed: ${strategy}`);
      }
    }

    this.diagnostics.failureReasons.push(`All selector strategies failed for: ${selector}`);
    return null;
  }

  // Advanced shadow DOM handling with multiple strategies
  private async queryShadowDom(page: Page, selector: string): Promise<any> {
    const shadowStrategies = [
      `>>> ${selector}`,
      selector, // Direct query as fallback
    ];

    for (const strategy of shadowStrategies) {
      try {
        const element = await page.waitForSelector(strategy, { timeout: 3000 });
        if (element) {
          this.diagnostics.shadowDomElements++;
          console.log(`✅ Shadow DOM element found: ${strategy}`);
          return element;
        }
      } catch (error) {
        console.warn(`⚠️ Shadow DOM query failed: ${strategy}`);
      }
    }

    return null;
  }

  // Intelligent scrolling with popup detection
  private async adaptiveScroll(page: Page): Promise<boolean> {
    let popupTriggered = false;
    const scrollSteps = [0.3, 0.6, 0.9]; // Scroll to 30%, 60%, 90% of page

    for (const step of scrollSteps) {
      try {
        await page.evaluate((scrollPosition) => {
          window.scrollTo(0, document.body.scrollHeight * scrollPosition);
        }, step);

        await page.waitForTimeout(1500); // Allow for popup triggers

        // Check if popup appeared
        const popupSelectors = [
          '[class*="popup"]',
          '[class*="modal"]',
          '[class*="newsletter"]',
          '[id*="popup"]',
          '[data-popup]'
        ];

        for (const popupSelector of popupSelectors) {
          const popup = await this.trySelector(page, popupSelector, 1000);
          if (popup) {
            console.log(`🎯 Popup detected at ${step * 100}% scroll: ${popupSelector}`);
            this.diagnostics.popupDetected = true;
            popupTriggered = true;
            break;
          }
        }

        if (popupTriggered) break;
      } catch (error) {
        console.warn(`⚠️ Scroll step ${step} failed:`, error);
      }
    }

    return popupTriggered;
  }

  // Enhanced iframe handling with comprehensive fallbacks
  private async handleIframe(page: Page, email: string): Promise<boolean> {
    const frames = page.frames();
    this.diagnostics.frameCount = frames.length;

    console.log(`🔍 Checking ${frames.length} frames for newsletter forms`);

    for (const frame of frames) {
      try {
        if (frame.url() === 'about:blank') continue; // Skip empty frames

        console.log(`🔍 Analyzing frame: ${frame.url()}`);

        // Multiple email input strategies
        const emailSelectors = [
          'input[type="email"]',
          'input[name*="email"]',
          'input[placeholder*="email" i]',
          'input[id*="email"]',
          '.email-input input'
        ];

        let emailInput = null;
        for (const selector of emailSelectors) {
          emailInput = await this.trySelector(frame, selector, 2000);
          if (emailInput) break;
        }

        if (emailInput) {
          await emailInput.fill(email);
          console.log(`✅ Email filled in iframe: ${frame.url()}`);

          // Multiple submit button strategies
          const submitSelectors = [
            'button:has-text("Subscribe")',
            'button:has-text("Sign Up")',
            'button:has-text("Submit")',
            'input[type="submit"]',
            'button[type="submit"]',
            '.submit-btn',
            '.subscribe-btn'
          ];

          for (const selector of submitSelectors) {
            const submitBtn = await this.trySelector(frame, selector, 2000);
            if (submitBtn) {
              await submitBtn.click();
              console.log(`✅ Form submitted in iframe via: ${selector}`);
              this.diagnostics.successStrategy = `iframe-${selector}`;
              return true;
            }
          }
        }
      } catch (error) {
        console.warn(`⚠️ Iframe processing failed for ${frame.url()}:`, error);
        this.diagnostics.failureReasons.push(`Iframe error: ${frame.url()} - ${error}`);
      }
    }

    return false;
  }

  // Advanced modal and popup handling
  private async handleModalsAndPopups(page: Page): Promise<void> {
    // Check for scroll lock (indicates active modal)
    const scrollLocked = await page.evaluate(() => {
      return document.body.style.overflow === 'hidden' || 
             document.documentElement.style.overflow === 'hidden';
    });

    this.diagnostics.scrollLocked = scrollLocked;

    if (scrollLocked) {
      console.log('🔒 Scroll lock detected - active modal present');
    }

    // Handle various modal types
    const modalStrategies = [
      // GDPR/Cookie consent
      { selectors: ['button:has-text("Accept")', 'button:has-text("Allow")', '.cookie-accept'], type: 'GDPR' },
      // Age verification
      { selectors: ['button:has-text("Yes")', 'button:has-text("I am")', '.age-verify'], type: 'Age Verification' },
      // Generic close buttons
      { selectors: ['button[aria-label="Close"]', '.popup-close', '.modal-close', '[data-dismiss]'], type: 'Close Modal' }
    ];

    for (const strategy of modalStrategies) {
      for (const selector of strategy.selectors) {
        const element = await this.trySelector(page, selector, 2000);
        if (element) {
          await element.click();
          console.log(`✅ ${strategy.type} handled: ${selector}`);
          await page.waitForTimeout(1000); // Allow UI to settle
          break;
        }
      }
    }
  }

  // Main automation logic with retry mechanisms
  private async executeAutomation(): Promise<boolean> {
    if (!this.page) throw new Error('Page not initialized');

    const pageLoadStart = Date.now();
    await this.page.goto(this.config.targetUrl, { waitUntil: 'domcontentloaded' });
    this.diagnostics.performanceMetrics.pageLoadTime = Date.now() - pageLoadStart;

    console.log(`🌐 Loaded: ${this.config.targetUrl} (${this.diagnostics.performanceMetrics.pageLoadTime}ms)`);

    // Allow dynamic content to load
    await this.page.waitForTimeout(3000);

    // Handle modals and popups first
    await this.handleModalsAndPopups(this.page);

    // Try adaptive scrolling to trigger newsletter popups
    await this.adaptiveScroll(this.page);

    // Strategy 1: Direct form submission
    const directSuccess = await this.tryDirectSubmission();
    if (directSuccess) return true;

    // Strategy 2: Shadow DOM forms
    const shadowSuccess = await this.tryShadowDomSubmission();
    if (shadowSuccess) return true;

    // Strategy 3: Iframe forms
    const iframeSuccess = await this.handleIframe(this.page, this.config.testEmail);
    if (iframeSuccess) return true;

    // Strategy 4: Scroll-triggered popups
    const scrollSuccess = await this.tryScrollTriggeredSubmission();
    if (scrollSuccess) return true;

    this.diagnostics.failureReasons.push('All submission strategies exhausted');
    return false;
  }

  private async tryDirectSubmission(): Promise<boolean> {
    if (!this.page) return false;

    const emailSelectors = [
      'input[type="email"]',
      'input[name*="email" i]',
      'input[placeholder*="email" i]',
      'input[aria-label*="email" i]'
    ];

    for (const emailSelector of emailSelectors) {
      const emailInput = await this.trySelector(this.page, emailSelector, 3000);
      if (emailInput) {
        await emailInput.fill(this.config.testEmail);
        console.log(`✅ Email filled: ${emailSelector}`);

        // Handle optional checkboxes
        const checkbox = await this.trySelector(this.page, 'input[type="checkbox"]:not([disabled])', 2000);
        console.log(checkbox)
        if (checkbox) {
          const isChecked = await checkbox.isChecked();
          if (!isChecked) {
            await checkbox.check();
            console.log('☑️ Opt-in checkbox checked');
          }
        }

        const submitSelectors = [
          'button:has-text("Subscribe")',
          'button:has-text("Sign Up")',
          'button:has-text("Submit")',
          'input[type="submit"]',
          'button[type="submit"]'
        ];

        for (const submitSelector of submitSelectors) {
          const submitBtn = await this.trySelector(this.page, submitSelector, 2000);
          if (submitBtn) {
            await submitBtn.click();
            console.log(`✅ Direct submission successful: ${submitSelector}`);
            this.diagnostics.successStrategy = `direct-${submitSelector}`;
            return true;
          }
        }
      }
    }

    return false;
  }

  private async tryShadowDomSubmission(): Promise<boolean> {
    if (!this.page) return false;

    const emailInput = await this.queryShadowDom(this.page, 'input[type="email"]');
    if (emailInput) {
      await emailInput.fill(this.config.testEmail);
      const submitBtn = await this.queryShadowDom(this.page, 'button:has-text("Subscribe")');
      if (submitBtn) {
        await submitBtn.click();
        console.log('✅ Shadow DOM submission successful');
        this.diagnostics.successStrategy = 'shadow-dom';
        return true;
      }
    }

    return false;
  }

  private async tryScrollTriggeredSubmission(): Promise<boolean> {
    if (!this.page) return false;

    // Scroll to bottom to trigger exit-intent popups
    await this.page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });

    await this.page.waitForTimeout(2000);

    // Move mouse to trigger exit-intent
    await this.page.mouse.move(0, 0);
    await this.page.waitForTimeout(1000);

    // Try submission after scroll triggers
    return await this.tryDirectSubmission();
  }

  private generateDiagnosticReport(): void {
    if (!this.config.enableDiagnostics) return;

    this.diagnostics.performanceMetrics.totalExecutionTime = Date.now() - this.startTime;

    console.log('\n📊 DIAGNOSTIC REPORT');
    console.log('='.repeat(50));
    console.log(`🌐 URL: ${this.diagnostics.url}`);
    console.log(`⏱️ Total Execution: ${this.diagnostics.performanceMetrics.totalExecutionTime}ms`);
    console.log(`📄 Page Load: ${this.diagnostics.performanceMetrics.pageLoadTime}ms`);
    console.log(`🖼️ Frames Detected: ${this.diagnostics.frameCount}`);
    console.log(`🌑 Shadow DOM Elements: ${this.diagnostics.shadowDomElements}`);
    console.log(`🎯 Popup Detected: ${this.diagnostics.popupDetected ? 'Yes' : 'No'}`);
    console.log(`🔒 Scroll Locked: ${this.diagnostics.scrollLocked ? 'Yes' : 'No'}`);
    console.log(`✅ Success Strategy: ${this.diagnostics.successStrategy || 'None'}`);
    
    if (this.diagnostics.failureReasons.length > 0) {
      console.log(`❌ Failure Reasons:`);
      this.diagnostics.failureReasons.forEach((reason, index) => {
        console.log(`   ${index + 1}. ${reason}`);
      });
    }
    console.log('='.repeat(50));
  }

  // Public method to run automation with retry logic
  public async run(): Promise<boolean> {
    this.startTime = Date.now();
    
    try {
      this.browser = await chromium.launch({ 
        headless: this.config.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // Production-ready args
      });
      
      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      
      this.page = await this.context.newPage();

      // Enable request/response logging for diagnostics
      if (this.config.enableDiagnostics) {
        this.page.on('response', response => {
          if (response.status() >= 400) {
            console.warn(`⚠️ HTTP ${response.status()}: ${response.url()}`);
          }
        });
      }

      let success = false;
      let attempt = 1;

      while (attempt <= this.config.maxRetries && !success) {
        console.log(`\n🚀 Attempt ${attempt}/${this.config.maxRetries}`);
        
        try {
          success = await this.executeAutomation();
          
          if (success) {
            console.log(`✅ Newsletter automation successful on attempt ${attempt}`);
            break;
          } else {
            console.log(`❌ Attempt ${attempt} failed, retrying...`);
            await this.page.waitForTimeout(2000); // Brief pause between retries
          }
        } catch (error) {
          console.error(`❌ Attempt ${attempt} error:`, error);
          this.diagnostics.failureReasons.push(`Attempt ${attempt}: ${error}`);
        }

        attempt++;
      }

      // Final verification
      if (success) {
        await this.page.waitForTimeout(3000); // Allow for success confirmations
        console.log(`🎉 AUTOMATION COMPLETED SUCCESSFULLY`);
      }

      return success;

    } catch (error) {
      console.error('❌ Critical automation failure:', error);
      this.diagnostics.failureReasons.push(`Critical failure: ${error}`);
      return false;
    } finally {
      this.generateDiagnosticReport();
      await this.cleanup();
    }
  }

  private async cleanup(): Promise<void> {
    try {
      await this.browser?.close();
    } catch (error) {
      console.warn('⚠️ Cleanup warning:', error);
    }
  }
}

// Production-ready execution function
export async function runNewsletterAutomation(config: AutomationConfig): Promise<boolean> {
  const automation = new NewsletterAutomation(config);
  return await automation.run();
}

// Example usage and test cases
export const testConfigurations = [
  {
    targetUrl: 'https://puravidabracelets.com',
    enableDiagnostics: true,
    maxRetries: 3
  },
  {
    targetUrl: 'https://example.com',
    headless: false, // For debugging
    enableDiagnostics: true,
    maxRetries: 2
  }
];

// CLI execution
if (require.main === module) {
  (async () => {
    const config: AutomationConfig = {
      targetUrl: process.argv[2] || 'https://kjobs.vercel.app/',
      headless: process.argv.includes('--headless'),
      enableDiagnostics: true,
      maxRetries: 3
    };

    console.log('🎯 Starting Production Newsletter Automation');
    console.log(`📋 Config: ${JSON.stringify(config, null, 2)}`);
    
    const success = await runNewsletterAutomation(config);
    
    process.exit(success ? 0 : 1);
  })();
}
