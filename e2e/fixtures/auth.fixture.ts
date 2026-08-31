import { test as base, expect } from '@playwright/test';
import { ApiHelper } from '../helpers/api.helper';
import { getSharedAuth } from '../helpers/shared-auth';

type Fixtures = {
  apiHelper: ApiHelper;
  authedPage: ReturnType<typeof base.extend> extends infer T ? any : never;
};

export const test = base.extend<{
  apiHelper: ApiHelper;
}>({
  apiHelper: async ({}, use) => {
    const auth = await getSharedAuth();
    const helper = new ApiHelper('http://localhost:4000');
    helper.setToken(auth.accessToken);
    await use(helper);
  },

  // Override the default page fixture to inject auth via route interception
  page: async ({ page }, use) => {
    const auth = await getSharedAuth();

    // Intercept the refresh call (used by initialize()) to return our cached token
    await page.route('**/api/auth/refresh', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ accessToken: auth.accessToken }),
      });
    });

    // Intercept the /me call to return user data
    await page.route('**/api/auth/me', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: auth.user,
          organization: auth.organization,
          role: auth.role,
        }),
      });
    });

    await use(page);
  },
});

export { expect };
