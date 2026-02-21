import { test, expect } from '@playwright/test';

test.describe('AHA Designer - E2E Generation MVP', () => {
    test('generates edge AI architecture under 2 minutes', async ({ page }) => {
        // 1. Visit app (running on localhost:5173 with tauri dev)
        await page.goto('http://localhost:5173');

        // 2. Select Copilot tab
        await page.getByText('Copilot').click();

        // 3. Enter prompt for Edge AI
        const input = page.getByPlaceholder('I need an Edge AI grading system...');
        await input.fill('Design an Edge AI sorting system based on Jetson with two cameras');
        await page.getByRole('button', { name: 'Send' }).click();

        // 4. Assert response time (< 2 mins). For mock, it's 1.5s
        await expect(page.getByText('I have drafted a Jetson-based sorting system.')).toBeVisible({ timeout: 120000 });

        // 5. Verify graph nodes are rendered
        const jetsonNode = page.locator('.react-flow__node').filter({ hasText: 'Jetson Orin NX' });
        await expect(jetsonNode).toBeVisible();

        const cameraNodes = page.locator('.react-flow__node').filter({ hasText: 'IMX219 Camera' });
        await expect(cameraNodes).toHaveCount(2);

        // 6. Run Validation Loop
        await page.getByText('Properties').click();
        await page.getByRole('button', { name: 'Run Validation Loop' }).click();

        // 7. Verify Success
        await expect(page.getByText('Status: success')).toBeVisible();
    });
});
