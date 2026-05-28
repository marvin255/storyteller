const fs = require('node:fs');
const path = require('node:path');

const SOURCE_ROOT = 'src';
const CONTRACTS_FOLDER = 'Contracts';

const sourceFolders = fs
    .readdirSync(path.join(__dirname, SOURCE_ROOT), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

const implementationFolders = sourceFolders.filter((folder) => folder !== CONTRACTS_FOLDER);

const implementationBoundaryRules = implementationFolders.flatMap((fromFolder) =>
    implementationFolders
        .filter((toFolder) => toFolder !== fromFolder)
        .map((toFolder) => ({
            name: `not-from-${fromFolder}-to-${toFolder}`,
            severity: 'error',
            comment:
                'Implementation folders must depend only on npm/node modules, themselves, nested files, and Contracts.',
            from: {
                path: `^${SOURCE_ROOT}/${fromFolder}/`,
            },
            to: {
                path: `^${SOURCE_ROOT}/${toFolder}/`,
            },
        })),
);

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    forbidden: [
        {
            name: 'not-to-unresolvable',
            severity: 'error',
            from: {},
            to: {
                couldNotResolve: true,
            },
        },
        {
            name: 'no-circular',
            severity: 'error',
            from: {},
            to: {
                circular: true,
            },
        },
        ...implementationBoundaryRules,
    ],
    options: {
        doNotFollow: {
            path: ['node_modules'],
        },
        tsConfig: {
            fileName: 'tsconfig.json',
        },
        enhancedResolveOptions: {
            conditionNames: ['import', 'require', 'node', 'default', 'types'],
            extensions: ['.ts', '.js', '.d.ts'],
            exportsFields: ['exports'],
            mainFields: ['module', 'main', 'types', 'typings'],
        },
        reporterOptions: {
            text: {
                highlightFocused: true,
            },
        },
    },
};
