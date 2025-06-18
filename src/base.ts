import { chromium, Page, Browser, BrowserContext, Frame } from 'playwright';

interface BQLConfig {
  targetUrl: string;
  testEmail: string;
  headless?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  enableDiagnostics?: boolean;
  scrollLockDetection?: boolean;
  adaptiveScrolling?: boolean;
  debugMode?: boolean;
}

interface DiagnosticData {
  timestamp: string;
  url: string;
  frameCount: number;
  shadowDomElements: number;
  popupDetected: boolean;
  scrollLockDetected: boolean;
  formStrategiesAttempted: string[];
  successfulStrategy?: string;
  errorMessage?: string;
  performanceMetrics: {
    totalExecutionTime: number;
    retryCount: number;
    scrollEvents: number;
    domQueries: number;
  };
}

interface SelectorStrategy {
  name: string;
  selectors: string[];
  context: 'main' | 'iframe' | 'shadow';
  priority: number;
}

class BQLNewsletterAutomation {
  private browser!: Browser;
  private context!: BrowserContext;
  private page!: Page;
  private config: BQLConfig;
  private diagnostics: DiagnosticData;
  private startTime: number = 0;
  private domQueryCount: number = 0;

  // Advanced selector strategies with fallback mechanisms
  private readonly selectorStrategies: SelectorStrategy[] = [
    {
      name: 'standard-email-forms',
      selectors: [
        'form input[type="email"]',
        'form input[name*="email" i]',
        'form input[placeholder*="email" i]',
        'form input[id*="email" i]',
        'form input[class*="email" i]'
      ],
      context: 'main',
      priority: 1
    },
    {
      name: 'newsletter-specific',
      selectors: [
        'form[class*="newsletter"] input[type="email"]',
        'form[id*="newsletter"] input[type="email"]',
        'div[class*="newsletter"] input[type="email"]',
        'section[class*="newsletter"] input[type="email"]',
        '[data-newsletter] input[type="email"]'
      ],
      context: 'main',
      priority: 2
    },
    {
      name: 'subscription-forms',
      selectors: [
        'form[class*="subscribe"] input[type="email"]',
        'form[id*="subscribe"] input[type="email"]',
        'div[class*="subscribe"] input[type="email"]',
        '[data-subscribe] input[type="email"]',
        'form[class*="signup"] input[type="email"]'
      ],
      context: 'main',
      priority: 3
    },
    {
      name: 'popup-modal-forms',
      selectors: [
        'div[role="dialog"] input[type="email"]',
        '.modal input[type="email"]',
        '.popup input[type="email"]',
        '[aria-modal="true"] input[type="email"]',
        '.overlay input[type="email"]'
      ],
      context: 'main',
      priority: 4
    },
    {
      name: 'iframe-embedded',
      selectors: [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[placeholder*="email" i]'
      ],
      context: 'iframe',
      priority: 5
    },
    {
      name: 'shadow-dom-components',
      selectors: [
        'input[type="email"]',
        'input[name*="email" i]'
      ],
      context: 'shadow',
      priority: 6
    }
  ];

  constructor(config: BQLConfig) {
    this.config = {
      headless: false, // Changed to false for better debugging
      maxRetries: 5,
      timeoutMs: 30000,
      enableDiagnostics: true,
      scrollLockDetection: true,
      adaptiveScrolling: true,
      debugMode: true,
      ...config,
    };

    this.diagnostics = {
      timestamp: new Date().toISOString(),
      url: this.config.targetUrl,
      frameCount: 0,
      shadowDomElements: 0,
      popupDetected: false,
      scrollLockDetected: false,
      formStrategiesAttempted: [],
      performanceMetrics: {
        totalExecutionTime: 0,
        retryCount: 0,
        scrollEvents: 0,
        domQueries: 0
      }
    };
  }

  public async run(): Promise<boolean> {
    this.startTime = Date.now();
    
    try {
      await this.initializeBrowser();
      await this.navigateToTarget();
      
      console.log(`🌐 BQL Automation started for: ${this.config.targetUrl}`);
      
      const success = await this.executeNewsletterSignup();
      
      if (success) {
        console.log('✅ Newsletter signup completed successfully');
        return true;
      } else {
        throw new Error('❌ All signup strategies failed');
      }
      
    } catch (err: any) {
      this.diagnostics.errorMessage = err.message;
      console.error('❌ BQL Automation Error:', err.message);
      return false;
    } finally {
      await this.cleanup();
    }
  }

  private async initializeBrowser(): Promise<void> {
    this.browser = await chromium.launch({ 
      headless: this.config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    
    this.page = await this.context.newPage();
    
    // Enable console logging for debugging
    if (this.config.debugMode) {
      this.page.on('console', msg => console.log(`🔍 Browser Console: ${msg.text()}`));
    }
  }

  private async navigateToTarget(): Promise<void> {
    await this.page.goto(this.config.targetUrl, { 
      timeout: this.config.timeoutMs,
      waitUntil: 'domcontentloaded'
    });
    
    // Wait for page to stabilize
    await this.page.waitForTimeout(2000);
  }

  private async executeNewsletterSignup(): Promise<boolean> {
    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        console.log(`🚀 BQL Attempt ${attempt}/${this.config.maxRetries}: Analyzing page structure...`);
        this.diagnostics.performanceMetrics.retryCount = attempt;

        // Step 1: Detect and handle scroll lock (indicating active modal)
        const scrollLocked = await this.detectScrollLock();
        if (scrollLocked) {
          console.log('🔒 Scroll lock detected - modal/popup likely active');
          this.diagnostics.scrollLockDetected = true;
        }

        // Step 2: Advanced popup detection and handling
        await this.handleAdvancedPopups();

        // Step 3: Execute form strategies in priority order
        const success = await this.executeFormStrategies();
        if (success) return true;

        // Step 4: Adaptive scrolling to trigger lazy-loaded content
        if (this.config.adaptiveScrolling) {
          await this.performAdaptiveScrolling();
        }

        // Step 5: Wait before retry
        await this.page.waitForTimeout(2000);

      } catch (err: any) {
        console.warn(`⚠️ Attempt ${attempt} failed: ${err.message}`);
        if (this.config.debugMode) {
          console.log(`🔍 Debug info: ${JSON.stringify(await this.gatherDebugInfo(), null, 2)}`);
        }
      }
    }
    
    return false;
  }

  private async executeFormStrategies(): Promise<boolean> {
    // Sort strategies by priority
    const sortedStrategies = this.selectorStrategies.sort((a, b) => a.priority - b.priority);

    for (const strategy of sortedStrategies) {
      try {
        console.log(`🎯 Executing strategy: ${strategy.name}`);
        this.diagnostics.formStrategiesAttempted.push(strategy.name);

        let success = false;

        switch (strategy.context) {
          case 'main':
            success = await this.executeMainFrameStrategy(strategy);
            break;
          case 'iframe':
            success = await this.executeIframeStrategy(strategy);
            break;
          case 'shadow':
            success = await this.executeShadowDomStrategy(strategy);
            break;
        }

        if (success) {
          this.diagnostics.successfulStrategy = strategy.name;
          console.log(`✅ Strategy '${strategy.name}' succeeded`);
          return true;
        }

      } catch (err: any) {
        console.warn(`⚠️ Strategy '${strategy.name}' failed: ${err.message}`);
      }
    }

    return false;
  }

  private async executeMainFrameStrategy(strategy: SelectorStrategy): Promise<boolean> {
    for (const selector of strategy.selectors) {
      const emailInput = await this.queryElement(selector);
      if (emailInput) {
        const submitButton = await this.findSubmitButton(emailInput);
        if (submitButton) {
          await emailInput.fill(this.config.testEmail);
          await this.page.waitForTimeout(500);
          await submitButton.click();
          console.log(`📧 Form submitted using selector: ${selector}`);
          return true;
        }
      }
    }
    return false;
  }

  private async executeIframeStrategy(strategy: SelectorStrategy): Promise<boolean> {
    const frames = this.page.frames();
    this.diagnostics.frameCount = frames.length;

    for (const frame of frames) {
      if (frame.url().includes('about:blank')) continue;

      try {
        for (const selector of strategy.selectors) {
          const emailInput = await frame.$(selector);
          if (emailInput) {
            const submitButton = await this.findSubmitButtonInFrame(frame, emailInput);
            if (submitButton) {
              await emailInput.fill(this.config.testEmail);
              await frame.waitForTimeout(500);
              await submitButton.click();
              console.log(`📧 Form submitted in iframe using selector: ${selector}`);
              return true;
            }
          }
        }
      } catch (err: any) {
        console.warn(`⚠️ Iframe strategy failed for frame: ${frame.url()}`);
      }
    }
    return false;
  }

  private async executeShadowDomStrategy(strategy: SelectorStrategy): Promise<boolean> {
    const shadowHosts = await this.page.$$('*');
    
    for (const host of shadowHosts) {
      try {
        const hasShadowRoot = await host.evaluate(el => !!el.shadowRoot);
        if (hasShadowRoot) {
          this.diagnostics.shadowDomElements++;
          
          for (const selector of strategy.selectors) {
            const emailInput = await host.evaluate((el, sel) => {
              const shadowRoot = el.shadowRoot;
              return shadowRoot ? shadowRoot.querySelector(sel) : null;
            }, selector);

            if (emailInput) {
              // Handle shadow DOM form submission
              const success = await this.handleShadowDomForm(host, selector);
              if (success) return true;
            }
          }
        }
      } catch (err: any) {
        // Continue to next host
      }
    }
    return false;
  }

  private async handleShadowDomForm(host: any, selector: string): Promise<boolean> {
    try {
      await host.evaluate((el:any, email:any, sel:any) => {
        const shadowRoot = el.shadowRoot;
        if (shadowRoot) {
          const emailInput = shadowRoot.querySelector(sel) as HTMLInputElement;
          const submitBtn = shadowRoot.querySelector('button[type="submit"], button') as HTMLButtonElement;
          
          if (emailInput && submitBtn) {
            emailInput.value = email;
            submitBtn.click();
            return true;
          }
        }
        return false;
      }, this.config.testEmail, selector);
      
      console.log(`📧 Shadow DOM form submitted`);
      return true;
    } catch (err: any) {
      return false;
    }
  }

  private async detectScrollLock(): Promise<boolean> {
    if (!this.config.scrollLockDetection) return false;

    try {
      const scrollLocked = await this.page.evaluate(() => {
        const body = document.body;
        const html = document.documentElement;
        
        // Check for common scroll-lock indicators
        const hasOverflowHidden = window.getComputedStyle(body).overflow === 'hidden' ||
                                  window.getComputedStyle(html).overflow === 'hidden';
        
        const hasScrollLockClass = body.classList.contains('scroll-lock') ||
                                  body.classList.contains('no-scroll') ||
                                  html.classList.contains('scroll-lock');
        
        return hasOverflowHidden || hasScrollLockClass;
      });

      return scrollLocked;
    } catch (err: any) {
      return false;
    }
  }

  private async handleAdvancedPopups(): Promise<void> {
    const popupSelectors = [
      'div[role="dialog"]',
      '.modal',
      '.popup',
      '[aria-modal="true"]',
      '.overlay',
      '[data-popup]',
      '[data-modal]',
      '.newsletter-popup',
      '.subscribe-popup'
    ];

    for (const selector of popupSelectors) {
      const popup = await this.queryElement(selector);
      if (popup) {
        this.diagnostics.popupDetected = true;
        console.log(`🎯 Popup detected: ${selector}`);
        
        // First try to find forms within the popup
        const popupForm = await popup.$('input[type="email"]');
        if (popupForm) {
          const submitBtn = await this.findSubmitButton(popupForm);
          if (submitBtn) {
            await popupForm.fill(this.config.testEmail);
            await submitBtn.click();
            console.log(`📧 Popup form submitted`);
            return;
          }
        }

        // If no form, try to close the popup
        await this.closePopup(popup);
      }
    }
  }

  private async closePopup(popup: any): Promise<void> {
    const closeSelectors = [
      'button[aria-label*="close" i]',
      'button[aria-label*="dismiss" i]',
      '.close',
      '.close-btn',
      '[data-close]',
      'button:has-text("×")',
      'button:has-text("Close")'
    ];

    for (const selector of closeSelectors) {
      const closeBtn = await popup.$(selector);
      if (closeBtn) {
        await closeBtn.click();
        console.log(`✖️ Popup closed using: ${selector}`);
        await this.page.waitForTimeout(1000);
        return;
      }
    }
  }

  private async performAdaptiveScrolling(): Promise<void> {
    const scrollSteps = [0.25, 0.5, 0.75, 1.0];
    
    for (const step of scrollSteps) {
      await this.page.evaluate((scrollPercent) => {
        const scrollHeight = document.documentElement.scrollHeight;
        const targetScroll = scrollHeight * scrollPercent;
        window.scrollTo(0, targetScroll);
      }, step);
      
      this.diagnostics.performanceMetrics.scrollEvents++;
      await this.page.waitForTimeout(1500);
      
      console.log(`🌀 Adaptive scroll: ${Math.round(step * 100)}%`);
    }
  }

  private async findSubmitButton(emailInput: any): Promise<any> {
    const form = await emailInput.evaluateHandle((input: HTMLInputElement) => {
      return input.closest('form') || input.parentElement;
    });

    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Subscribe")',
      'button:has-text("Sign Up")',
      'button:has-text("Join")',
      'button:has-text("Submit")',
      'button',
      '[data-submit]'
    ];

    for (const selector of submitSelectors) {
      const btn = await form.$(selector);
      if (btn) return btn;
    }

    return null;
  }

  private async findSubmitButtonInFrame(frame: Frame, emailInput: any): Promise<any> {
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Subscribe")',
      'button:has-text("Sign Up")',
      'button'
    ];

    for (const selector of submitSelectors) {
      const btn = await frame.$(selector);
      if (btn) return btn;
    }

    return null;
  }

  private async queryElement(selector: string): Promise<any> {
    this.domQueryCount++;
    this.diagnostics.performanceMetrics.domQueries = this.domQueryCount;
    
    try {
      return await this.page.$(selector);
    } catch (err: any) {
      return null;
    }
  }

  private async gatherDebugInfo(): Promise<any> {
    try {
      return await this.page.evaluate(() => {
        return {
          title: document.title,
          url: window.location.href,
          forms: document.querySelectorAll('form').length,
          inputs: document.querySelectorAll('input[type="email"]').length,
          iframes: document.querySelectorAll('iframe').length,
          modals: document.querySelectorAll('[role="dialog"], .modal, .popup').length,
          scrollHeight: document.documentElement.scrollHeight,
          scrollTop: document.documentElement.scrollTop
        };
      });
    } catch (err: any) {
      return { error: err.message };
    }
  }

  private async cleanup(): Promise<void> {
    this.diagnostics.performanceMetrics.totalExecutionTime = Date.now() - this.startTime;
    
    if (this.config.enableDiagnostics) {
      this.printDiagnostics();
    }
    
    if (this.browser) {
      await this.browser.close();
    }
  }

  private printDiagnostics(): void {
    console.log('\n🧪 BQL Diagnostics Report:');
    console.log('=' .repeat(50));
    console.log(JSON.stringify(this.diagnostics, null, 2));
    console.log('=' .repeat(50));
  }

  // Public method for external diagnostic access
  public getDiagnostics(): DiagnosticData {
    return this.diagnostics;
  }
}

export default BQLNewsletterAutomation;
export { BQLConfig, DiagnosticData };