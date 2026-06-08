import { describe, expect, test } from '@jest/globals';

import { getApplicationConfig } from '../../src/Config/getApplicationConfig.js';

describe('getApplicationConfig', () => {
    test('loads the strict JSON application config', async () => {
        await expect(getApplicationConfig()).resolves.toEqual({});
    });
});
