import { Browser, Page, chromium, Locator } from '@playwright/test'; // Import Locator
import { AutomationConfig, AutomationResult, PopupStrategy, SelectorStrategy } from './types';
import { DiagnosticEngine } from './diagnostics';
import { SelectorEngine } from './selectors';
import { log } from 'console';

export class NewsletterAutomation {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private diagnostics: DiagnosticEngine | null = null;
  private selectors: SelectorEngine | null = null;

  private emailInputStrategies: SelectorStrategy[] = [
    {
      primary: 'input[type="email"]',
      fallbacks: [
        'input[name*="email"]',
        'input[placeholder*="email" i]',
        'input[id*="email"]',
        '.email-input input',
        '.newsletter-email input',
        '[data-testid*="email"] input',
          'form input[type="email"]',
          'form input[name*="email" i]',
          'form input[placeholder*="email" i]',
          'form input[id*="email" i]',
          'form input[class*="email" i]'
      ]
    },
    {
      primary: 'input[name="EMAIL"]',
      fallbacks: [
        'input[name="email_address"]',
        'input[name="user_email"]',
        'input[class*="email"]'
      ]
    }
  ];

  private submitButtonStrategies: SelectorStrategy[] = [
    {
      primary: 'button[type="submit"]',
      fallbacks: [
        'input[type="submit"]',
        'button:has-text("Subscribe")',
        'button:has-text("Sign Up")',
        'button:has-text("Join")',
        '.submit-btn',
        '.newsletter-submit',
        '[data-testid*="submit"]'
      ]
    }
  ];

  // New: Checkbox strategies
  private checkboxStrategies: SelectorStrategy[] = [
    {
      primary: 'input[type="checkbox"]',
      fallbacks: [
        'input[type="checkbox"][name*="agree"]',
        'input[type="checkbox"][id*="terms"]',
        'input[type="checkbox"][class*="consent"]'
      ]
    }
  ];

  private popupStrategies: PopupStrategy[] = [
    {
      name: 'Newsletter Popup',
      selectors: {
        primary: '.newsletter-popup',
        fallbacks: ['.popup', '.modal', '[role="dialog"]']
      },
      action: 'wait'
    },
    {
      name: 'Close Button',
      selectors: {
        primary: '.close-btn',
        fallbacks: ['.close', '[aria-label="Close"]', 'button:has-text("×")']
      },
      action: 'click'
    }
  ];

  async initialize(): Promise<void> {
    this.browser = await chromium.launch({
      headless: true, // Set to true for production
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor'
      ]
    });

    this.page = await this.browser.newPage();
    this.diagnostics = new DiagnosticEngine(this.page);
    this.selectors = new SelectorEngine(this.page);

    // Set viewport and user agent
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });
  }

  async executeAutomation(config: AutomationConfig): Promise<AutomationResult> {
    const startTime = Date.now();
    const result: AutomationResult = {
      success: false,
      timestamp: new Date().toISOString(),
      url: config.url,
      executionTime: 0,
      strategiesUsed: [],
      errors: [],
      diagnostics: {
        pageTitle: '',
        popupDetected: false,
        iframeCount: 0,
        shadowDOMDetected: false,
        scrollLocked: false,
        modalActive: false
      }
    };

    if (!this.page || !this.diagnostics || !this.selectors) {
      // Instead of throwing, update result for better reporting
      result.errors.push('Automation not initialized. Page, diagnostics, or selectors are null.');
      result.success = false;
      result.executionTime = Date.now() - startTime;
      return result;
    }

    try {
      // Navigate to page
      await this.page.goto(config.url, {
        waitUntil: 'domcontentloaded',
        timeout: config.timeout
        
      });

      // Collect initial diagnostics
      result.diagnostics = await this.diagnostics.collectDiagnostics();

      // Handle popups and modals
      await this.handlePopupsAndModals(config, result);

      // Attempt newsletter signup with retry logic
      const signupSuccess = await this.attemptNewsletterSignup(config, result);

      if (signupSuccess) {
        result.success = true;
      } else {
        result.errors.push('Newsletter signup failed after all attempts');
      }

    } catch (error: any) { // Use any for error type if not specific
      result.errors.push(`Automation failed: ${error.message || error}`);
    } finally {
      result.executionTime = Date.now() - startTime;
    }

    return result;
  }

  private async handlePopupsAndModals(config: AutomationConfig, result: AutomationResult): Promise<void> {
    if (!this.page) return;

    // Wait for potential popups to appear
    await this.page.waitForTimeout(2000);

    // Intelligent scrolling to trigger popups
    await this.triggerPopupsWithScrolling(config);

    // Check for and handle various popup types
    for (const strategy of this.popupStrategies) {
      try {
        const element = await this.selectors!.findElement(strategy.selectors);
        if (element) {
          result.strategiesUsed.push(`Popup Strategy: ${strategy.name}`);

          if (strategy.action === 'click') {
            await element.click();
            await this.page.waitForTimeout(1000);
            // Re-collect diagnostics after closing a popup
            result.diagnostics = await this.diagnostics!.collectDiagnostics();
          }
        }
      } catch (error) {
        console.warn(`Popup strategy ${strategy.name} failed:`, error);
      }
    }
  }

  private async triggerPopupsWithScrolling(config: AutomationConfig): Promise<void> {
    if (!this.page) return;

    // Scroll strategies to trigger popups
    const scrollStrategies = [
      { direction: 'down', percentage: 25 },
      { direction: 'down', percentage: 50 },
      { direction: 'down', percentage: 75 },
      { direction: 'up', percentage: 0 }
    ];

    for (const strategy of scrollStrategies) {
      await this.page.evaluate((percent) => {
        window.scrollTo(0, document.body.scrollHeight * (percent / 100));
      }, strategy.percentage);

      await this.page.waitForTimeout(config.scrollDelay);

      // Check if popup appeared
      const diagnostics = await this.diagnostics!.collectDiagnostics();
      if (diagnostics.modalActive || diagnostics.scrollLocked) {
        break;
      }
    }
  }

  private async attemptNewsletterSignup(config: AutomationConfig, result: AutomationResult): Promise<boolean> {
    if (!this.page || !this.selectors) return false;

    for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
      try {
        // Find email input using multiple strategies
        let emailInput = await this.findEmailInput(result);

        if (!emailInput) {
          result.errors.push(`Attempt ${attempt + 1}: Email input not found`);
          continue;
        }

        // Fill email
        
        await emailInput.fill(config.email);
        await this.page.waitForTimeout(500);

        // New: Handle checkboxes
        await this.handleCheckboxes(result);

        // Find and click submit button
        let submitButton = await this.findSubmitButton(result);

        if (!submitButton) {
          result.errors.push(`Attempt ${attempt + 1}: Submit button not found`);
          continue;
        }

        await submitButton.click();

        // Wait for submission confirmation
        await this.page.waitForTimeout(2000);

        result.strategiesUsed.push(`Successful on attempt ${attempt + 1}`);
        return true;
        // Check for success indicators
        const success = await this.verifySubmissionSuccess();
        if (success) {
        
        }

      } catch (error: any) {
        result.errors.push(`Attempt ${attempt + 1} failed: ${error.message || error}`);
      }

      // Wait before retry
      if (attempt < config.retryAttempts - 1) {
        await this.page.waitForTimeout(1000);
      }
    }

    return false;
  }

  private async findEmailInput(result: AutomationResult): Promise<Locator | null> { // Use Locator type
    // Try main page first
    for (const strategy of this.emailInputStrategies) {
      const element = await this.selectors!.findElement(strategy);
      if (element) {
        result.strategiesUsed.push('Email input found on main page');
        return element;
      }
    }

    // Try iframes
    for (const strategy of this.emailInputStrategies) {
      const element = await this.selectors!.findInIframes(strategy);
      if (element) {
        result.strategiesUsed.push('Email input found in iframe');
        return element;
      }
    }


    for (const strategy of this.emailInputStrategies) {
      const element = await this.selectors!.findInShadowDOM(strategy);
      if (element) {
        result.strategiesUsed.push('Email input found in shadow DOM');
     
        return element; 
      }
    }

    return null;
  }

  private async findSubmitButton(result: AutomationResult): Promise<Locator | null> { // Use Locator type
    for (const strategy of this.submitButtonStrategies) {
      const element = await this.selectors!.findElement(strategy);
      if (element) {
        result.strategiesUsed.push('Submit button found on main page');
        return element;
      }
    }

    for (const strategy of this.submitButtonStrategies) {
      const element = await this.selectors!.findInIframes(strategy);
      if (element) {
        result.strategiesUsed.push('Submit button found in iframe');
        return element;
      }
    }

    for (const strategy of this.submitButtonStrategies) {
      const element = await this.selectors!.findInShadowDOM(strategy);
      if (element) {
        result.strategiesUsed.push('Submit button found in shadow DOM');
        return element;
      }
    }

    return null;
  }

  // New: Method to handle checkboxes
  private async handleCheckboxes(result: AutomationResult): Promise<void> {
    if (!this.page || !this.selectors) return;

    for (const strategy of this.checkboxStrategies) {
      try {
        // Find all potential checkboxes using the current strategy
        const checkboxes = await this.selectors!.findAllElements(strategy);

        for (const checkbox of checkboxes) {
          const isChecked = await checkbox.isChecked();
          if (!isChecked) {
            // Check if there's an associated label and try clicking that first
            const id = await checkbox.getAttribute('id');
            if (id) {
              const label = await this.page.locator(`label[for="${id}"]`).first();
              if (label) {
                try {
                  await label.click();
                  result.strategiesUsed.push(`Clicked checkbox label for ID: ${id}`);
                  await this.page.waitForTimeout(200); // Small pause after click
                  continue; // Move to next checkbox if label click was successful
                } catch (labelError) {
                  console.warn(`Could not click label for checkbox ID ${id}. Attempting direct click.`);
                }
              }
            }

            // If no label or label click failed, click the checkbox directly
            await checkbox.click();
            result.strategiesUsed.push(`Clicked checkbox directly: ${await checkbox.evaluate((el:any) => el.outerHTML)}`);
            await this.page.waitForTimeout(200); // Small pause after click
          }
        }
      } catch (error) {
        console.warn(`Error handling checkboxes with strategy ${JSON.stringify(strategy)}:`, error);
      }
    }
  }


  private async verifySubmissionSuccess(): Promise<boolean> {
    if (!this.page) return false;

    const successIndicators = [
      'text="Thank you"',
      'text="Success"',
      'text="Subscribed"',
      'text="Check your email"',
      '.success-message',
      '.confirmation'
    ];

    for (const indicator of successIndicators) {
      try {
        await this.page.waitForSelector(indicator, { timeout: 3000 });
        return true;
      } catch {
        continue;
      }
    }

    return false;
  }

  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
  }
}